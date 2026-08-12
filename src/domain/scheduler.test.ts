import { describe, it, expect } from 'vitest';
import {
  BOX_INTERVALS_MS,
  DAY_MS,
  GRADUATED_BOX,
  MAX_BOX,
  MINUTE_MS,
  compareByDue,
  describeReview,
  intervalForBox,
  isDue,
  isGraduated,
  newCard,
  reviewCard,
} from './scheduler';
import type { CardState } from './scheduler';

const T0 = Date.UTC(2026, 7, 11, 9, 0, 0);

/** Answer a card `n` times in a row, jumping the clock to each due date. */
function drill(card: CardState, verdicts: boolean[], from = T0): CardState {
  let current = card;
  let clock = from;
  for (const verdict of verdicts) {
    clock = Math.max(clock, current.dueAt);
    current = reviewCard(current, verdict, clock);
  }
  return current;
}

describe('the interval ladder', () => {
  it('expands: ten minutes, a day, a week, two weeks, a month, three months', () => {
    expect(BOX_INTERVALS_MS).toEqual([
      10 * MINUTE_MS,
      1 * DAY_MS,
      7 * DAY_MS,
      14 * DAY_MS,
      30 * DAY_MS,
      90 * DAY_MS,
    ]);
  });

  it('is strictly increasing — a promotion must never shorten the wait', () => {
    for (let box = 1; box <= MAX_BOX; box += 1) {
      expect(BOX_INTERVALS_MS[box]!).toBeGreaterThan(BOX_INTERVALS_MS[box - 1]!);
    }
  });

  it('clamps a box outside the ladder rather than returning undefined', () => {
    expect(intervalForBox(-4)).toBe(BOX_INTERVALS_MS[0]);
    expect(intervalForBox(99)).toBe(BOX_INTERVALS_MS[MAX_BOX]);
  });
});

describe('newCard', () => {
  it('is due immediately and carries no history', () => {
    const card = newCard('row-017', 'right-of-way', T0);
    expect(card).toEqual({
      questionId: 'row-017',
      topic: 'right-of-way',
      box: 0,
      streak: 0,
      lapses: 0,
      seen: 0,
      correct: 0,
      dueAt: T0,
      lastSeenAt: 0,
    });
    expect(isDue(card, T0)).toBe(true);
  });
});

describe('promotion on repeated success', () => {
  it('walks up one box per correct answer', () => {
    let card = newCard('q1', 'signs', T0);
    card = reviewCard(card, true, T0);
    expect(card.box).toBe(1);
    expect(card.dueAt).toBe(T0 + DAY_MS);

    card = reviewCard(card, true, card.dueAt);
    expect(card.box).toBe(2);
    expect(card.dueAt).toBe(T0 + DAY_MS + 7 * DAY_MS);

    card = reviewCard(card, true, card.dueAt);
    expect(card.box).toBe(3);
  });

  it('graduates on the third consecutive correct answer, at a two-week interval', () => {
    const card = drill(newCard('q1', 'signs', T0), [true, true, true]);
    expect(card.streak).toBe(3);
    expect(card.box).toBe(GRADUATED_BOX);
    expect(intervalForBox(card.box)).toBe(14 * DAY_MS);
    expect(isGraduated(card)).toBe(true);
  });

  it('is not graduated before three in a row', () => {
    expect(isGraduated(drill(newCard('q1', 'signs', T0), [true, true]))).toBe(false);
  });

  it('holds at the top box instead of running off the end of the ladder', () => {
    const card = drill(newCard('q1', 'signs', T0), [true, true, true, true, true, true, true]);
    expect(card.box).toBe(MAX_BOX);
    expect(card.streak).toBe(7);
    expect(card.seen).toBe(7);
    expect(card.correct).toBe(7);
  });
});

describe('demotion on failure', () => {
  it('resets a mature card to the ten-minute box, because a miss is not a slip', () => {
    const mature = drill(newCard('q1', 'signs', T0), [true, true, true, true]);
    expect(mature.box).toBe(4);

    const missed = reviewCard(mature, false, mature.dueAt);
    expect(missed.box).toBe(0);
    expect(missed.streak).toBe(0);
    expect(missed.lapses).toBe(1);
    expect(missed.dueAt).toBe(mature.dueAt + 10 * MINUTE_MS);
  });

  it('counts every lapse, so a chronically weak card is distinguishable', () => {
    const card = drill(newCard('q1', 'signs', T0), [false, true, false, false]);
    expect(card.lapses).toBe(3);
    expect(card.seen).toBe(4);
    expect(card.correct).toBe(1);
  });

  it('brings a missed card back inside the same sitting', () => {
    const card = reviewCard(newCard('q1', 'signs', T0), false, T0);
    expect(isDue(card, T0 + 9 * MINUTE_MS)).toBe(false);
    expect(isDue(card, T0 + 10 * MINUTE_MS)).toBe(true);
  });
});

describe('due ordering', () => {
  const at = (questionId: string, dueAt: number, box: number): CardState => ({
    ...newCard(questionId, 'signs', T0),
    dueAt,
    box,
  });

  it('puts the most overdue card first', () => {
    const cards = [at('c', T0 + 5, 0), at('a', T0 - 100, 0), at('b', T0, 0)];
    expect([...cards].sort(compareByDue).map((c) => c.questionId)).toEqual(['a', 'b', 'c']);
  });

  it('breaks a tie by weakness — the lower box comes first', () => {
    const cards = [at('strong', T0, 4), at('weak', T0, 0), at('middling', T0, 2)];
    expect([...cards].sort(compareByDue).map((c) => c.questionId)).toEqual([
      'weak',
      'middling',
      'strong',
    ]);
  });

  it('breaks a full tie by id, so the order is stable across reloads', () => {
    const cards = [at('q-b', T0, 1), at('q-a', T0, 1)];
    expect([...cards].sort(compareByDue).map((c) => c.questionId)).toEqual(['q-a', 'q-b']);
  });

  it('reports a card as equal to itself, so the order is reflexive', () => {
    const card = newCard('q1', 'signs', T0);
    expect(compareByDue(card, card)).toBe(0);
  });

  it('is a total order — sorting twice gives the same answer', () => {
    const cards = [at('c', T0 + 5, 1), at('a', T0 - 100, 3), at('b', T0, 0), at('d', T0, 0)];
    const once = [...cards].sort(compareByDue).map((c) => c.questionId);
    const twice = [...cards].reverse().sort(compareByDue).map((c) => c.questionId);
    expect(twice).toEqual(once);
  });
});

describe('describeReview — the promise the screen makes to the learner', () => {
  it('names the ladder on a miss, exactly as the session screen states it', () => {
    const before = newCard('q1', 'signs', T0);
    const after = reviewCard(before, false, T0);
    expect(describeReview(before, after, false)).toBe(
      "You'll see this one in about ten minutes, then tomorrow, then next week. " +
        'It leaves the queue once you get it right three times running.',
    );
  });

  it('counts the streak out loud on the way up', () => {
    let before = drill(newCard('q1', 'signs', T0), [true, true]);
    let after = reviewCard(before, true, before.dueAt);
    expect(describeReview(before, after, true)).toBe(
      'Third time right in a row. This one moves to a two-week interval.',
    );

    before = newCard('q2', 'signs', T0);
    after = reviewCard(before, true, T0);
    expect(describeReview(before, after, true)).toBe(
      'First time right. This one comes back tomorrow.',
    );
  });

  it('says the card is holding once it tops out, rather than inventing a promotion', () => {
    const before = drill(newCard('q1', 'signs', T0), [true, true, true, true, true]);
    expect(before.box).toBe(MAX_BOX);
    const after = reviewCard(before, true, before.dueAt);
    expect(describeReview(before, after, true)).toBe(
      'Sixth time right in a row. This one stays at a three-month interval.',
    );
  });

  it('keeps counting past the ordinals it has words for', () => {
    const before = drill(newCard('q1', 'signs', T0), Array<boolean>(11).fill(true));
    const after = reviewCard(before, true, before.dueAt);
    expect(describeReview(before, after, true)).toBe(
      '12 times right in a row. This one stays at a three-month interval.',
    );
  });
});

describe('a simulated 30-day study history stays stable', () => {
  it('drives a mixed learner without producing a card outside the ladder', () => {
    // Deterministic pseudo-learner. Three cards in four are material they know
    // and always get right; the fourth is a blind spot they only land one time
    // in four. A real bank has both, and the ladder has to handle both.
    const cards = new Map<string, CardState>();
    for (let n = 0; n < 40; n += 1) {
      cards.set(`q${String(n)}`, newCard(`q${String(n)}`, `topic-${String(n % 5)}`, T0));
    }
    const answers = (day: number, n: number) => (n % 4 !== 0 ? true : (day + n) % 4 === 0);

    for (let day = 0; day < 30; day += 1) {
      const now = T0 + day * DAY_MS + 18 * 60 * 60 * 1000;
      const due = [...cards.values()].filter((c) => isDue(c, now)).sort(compareByDue);
      for (const card of due.slice(0, 12)) {
        const n = Number(card.questionId.slice(1));
        cards.set(card.questionId, reviewCard(card, answers(day, n), now));
      }
    }

    for (const card of cards.values()) {
      expect(card.box).toBeGreaterThanOrEqual(0);
      expect(card.box).toBeLessThanOrEqual(MAX_BOX);
      expect(card.correct).toBeLessThanOrEqual(card.seen);
      expect(card.dueAt).toBeGreaterThan(card.lastSeenAt);
      expect(Number.isFinite(card.dueAt)).toBe(true);
    }

    const touched = [...cards.values()].filter((c) => c.seen > 0);
    expect(touched.length).toBe(40);
    // Thirty days of honest practice must actually retire some material, or the
    // ladder is not expanding — the whole point of spacing.
    expect(touched.some(isGraduated)).toBe(true);
    // …and must keep the ones the learner keeps missing in the short boxes.
    expect(touched.some((c) => c.box === 0 && c.lapses > 0)).toBe(true);
  });
});
