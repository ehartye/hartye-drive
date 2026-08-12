/**
 * The spaced-repetition scheduler.
 *
 * ── The interval policy, and why it is this one ────────────────────────────
 *
 * A Leitner ladder of six fixed boxes: **10 minutes · 1 day · 1 week ·
 * 2 weeks · 1 month · 3 months**. A correct answer moves a card up exactly one
 * box; a wrong answer sends it straight back to the ten-minute box.
 *
 * 1. **The horizon is weeks, not years.** This app is studied between booking
 *    a Driver Service Center appointment and sitting the test — days to a
 *    couple of months. An SM-2-style per-card ease factor is tuned for
 *    decade-scale retention of tens of thousands of items; over ~500 items and
 *    a six-week horizon its extra state changes almost no scheduling decision
 *    while making the behaviour impossible to state to the learner. The ladder
 *    tops out at three months because nothing beyond that horizon matters for
 *    passing.
 *
 * 2. **The app makes the schedule a promise, so the schedule must be sayable.**
 *    The answer-revealed screen tells the learner in words when a card comes
 *    back ("in about ten minutes, then tomorrow, then next week"). Only a fixed
 *    ladder can make that promise honestly; a computed ease factor cannot be
 *    stated in advance without lying.
 *
 * 3. **Ten minutes, not "later".** The relapse step is deliberately inside the
 *    same sitting. Re-testing a missed item once within the session, and again
 *    a day later, is the highest-yield correction available for a knowledge
 *    test — and it is what makes the session feel like it is teaching rather
 *    than quizzing.
 *
 * 4. **A miss is a hard reset, not one step down.** Every question in this bank
 *    has three options (grounding §7), so a wrong answer means the learner did
 *    worse than a coin flip on a 1-in-3 guess. That is strong evidence the item
 *    was never actually known, and treating it as a small slip would let a
 *    genuinely weak card drift out to a two-week interval.
 *
 * 5. **Graduation at three in a row.** `GRADUATED_BOX` is the point where a
 *    card leaves the weakness queue and the session builder stops spending
 *    slots on it — three consecutive correct answers spread over ~8 days.
 *
 * Everything here is pure: no DOM, no clock, no storage. `now` is always
 * passed in, so a thirty-day study history can be simulated in a unit test.
 */

export const MINUTE_MS = 60_000;
export const DAY_MS = 86_400_000;

/** The ladder. Index = box. Strictly increasing, by test. */
const LADDER = [
  10 * MINUTE_MS,
  1 * DAY_MS,
  7 * DAY_MS,
  14 * DAY_MS,
  30 * DAY_MS,
  90 * DAY_MS,
] as const;

export const BOX_INTERVALS_MS: readonly number[] = LADDER;

/**
 * A position on the ladder. Written as a literal union rather than `number` so
 * every table lookup below is total — there is no "box off the end of the
 * ladder" case to guess at, at compile time or at runtime.
 */
export type Box = 0 | 1 | 2 | 3 | 4 | 5;

/** The last index of the ladder. `BOX_INTERVALS_MS.length - 1`, by test. */
export const MAX_BOX = 5;

/** Three consecutive correct answers retires a card from the weakness queue. */
export const GRADUATED_BOX = 3;

export interface CardState {
  questionId: string;
  /** Denormalised so the session builder can weigh topics without the bank. */
  topic: string;
  /** Position on the ladder, 0…MAX_BOX. */
  box: number;
  /** Consecutive correct answers. Reset to 0 by any miss. */
  streak: number;
  /** Lifetime misses after the first sighting — how weak this card really is. */
  lapses: number;
  seen: number;
  correct: number;
  /** Epoch ms. A card is due when `dueAt <= now`. */
  dueAt: number;
  /** Epoch ms of the last answer; 0 while unseen. */
  lastSeenAt: number;
}

/**
 * The assertion is the point: after clamping, the value provably is a `Box`,
 * and saying so lets every table below be indexed without a runtime fallback
 * that could never fire.
 */
const clampBox = (box: number): Box => Math.min(MAX_BOX, Math.max(0, Math.trunc(box))) as Box;

export function intervalForBox(box: number): number {
  return LADDER[clampBox(box)];
}

/** A card the learner has never met. Due immediately — that is what "new" means. */
export function newCard(questionId: string, topic: string, now: number): CardState {
  return {
    questionId,
    topic,
    box: 0,
    streak: 0,
    lapses: 0,
    seen: 0,
    correct: 0,
    dueAt: now,
    lastSeenAt: 0,
  };
}

/** Apply one answer. Promotion is one box; demotion is all the way down. */
export function reviewCard(card: CardState, wasCorrect: boolean, now: number): CardState {
  const box = wasCorrect ? clampBox(card.box + 1) : 0;
  return {
    ...card,
    box,
    streak: wasCorrect ? card.streak + 1 : 0,
    lapses: wasCorrect ? card.lapses : card.lapses + 1,
    seen: card.seen + 1,
    correct: card.correct + (wasCorrect ? 1 : 0),
    dueAt: now + intervalForBox(box),
    lastSeenAt: now,
  };
}

export function isDue(card: CardState, now: number): boolean {
  return card.dueAt <= now;
}

/** Retired from the weakness queue — right three times running. */
export function isGraduated(card: CardState): boolean {
  return card.box >= GRADUATED_BOX;
}

/**
 * Most overdue first; ties broken by weakness (lower box), then by id so the
 * order is identical across reloads. A total order — required, because the
 * session a learner sees must not depend on `Array.prototype.sort` internals.
 */
export function compareByDue(a: CardState, b: CardState): number {
  if (a.dueAt !== b.dueAt) return a.dueAt - b.dueAt;
  if (a.box !== b.box) return a.box - b.box;
  return a.questionId < b.questionId ? -1 : a.questionId > b.questionId ? 1 : 0;
}

/* ------------------------------------------------------------------ wording */

/** When the card next arrives, as the learner would say it. */
const ARRIVAL = [
  'in about ten minutes',
  'tomorrow',
  'next week',
  'in two weeks',
  'in a month',
  'in three months',
] as const;

/** The interval as a noun, for "moves to …". */
const INTERVAL_NOUN = [
  'a ten-minute interval',
  'a one-day interval',
  'a one-week interval',
  'a two-week interval',
  'a one-month interval',
  'a three-month interval',
] as const;

const ORDINALS = [
  '',
  'First',
  'Second',
  'Third',
  'Fourth',
  'Fifth',
  'Sixth',
  'Seventh',
  'Eighth',
  'Ninth',
  'Tenth',
  'Eleventh',
] as const;

const CARDINAL_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five'] as const;

export function arrivalPhrase(box: number): string {
  return ARRIVAL[clampBox(box)];
}

export function intervalNoun(box: number): string {
  return INTERVAL_NOUN[clampBox(box)];
}

/** Sanity: the wording tables and the ladder must stay the same length. */
export const LADDER_LENGTH = LADDER.length;

/**
 * The sentence the answer-revealed screen prints. `before` and `after` are the
 * card either side of `reviewCard`, so the wording can tell a promotion from a
 * card that has topped out — the difference between "moves to" and "stays at".
 */
export function describeReview(before: CardState, after: CardState, wasCorrect: boolean): string {
  if (!wasCorrect) {
    return (
      `You'll see this one ${arrivalPhrase(0)}, then ${arrivalPhrase(1)}, ` +
      `then ${arrivalPhrase(2)}. It leaves the queue once you get it right ` +
      `${CARDINAL_WORDS[GRADUATED_BOX]} times running.`
    );
  }

  const ordinal = ORDINALS.at(after.streak);
  const lead =
    after.streak === 1
      ? 'First time right.'
      : ordinal
        ? `${ordinal} time right in a row.`
        : `${String(after.streak)} times right in a row.`;

  if (after.box === before.box) {
    return `${lead} This one stays at ${intervalNoun(after.box)}.`;
  }
  if (after.box === 1) {
    return `${lead} This one comes back tomorrow.`;
  }
  return `${lead} This one moves to ${intervalNoun(after.box)}.`;
}
