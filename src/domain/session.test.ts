import { describe, it, expect } from 'vitest';
import { DAY_MS, newCard, reviewCard } from './scheduler';
import type { CardState } from './scheduler';
import {
  DEFAULT_SESSION_SIZE,
  REVIEW_SHARE,
  buildSession,
  isWeakTopic,
  rankTopicsByWeakness,
  sessionRationale,
  smoothedAccuracy,
} from './session';
import type { SessionCandidate, TopicStat } from './session';

const T0 = Date.UTC(2026, 7, 11, 9, 0, 0);

function bank(topics: Record<string, number>): SessionCandidate[] {
  const out: SessionCandidate[] = [];
  for (const [topic, count] of Object.entries(topics)) {
    for (let i = 0; i < count; i += 1) {
      out.push({ id: `${topic}-${String(i).padStart(2, '0')}`, topic, area: 'rules-of-road' });
    }
  }
  return out;
}

function cardsFrom(entries: CardState[]): Record<string, CardState> {
  return Object.fromEntries(entries.map((c) => [c.questionId, c]));
}

/** A card that is overdue by `days`, having been answered wrong once. */
function overdue(id: string, topic: string, days: number): CardState {
  const card = reviewCard(newCard(id, topic, T0 - days * DAY_MS), false, T0 - days * DAY_MS);
  return card;
}

describe('smoothedAccuracy', () => {
  it('puts an untouched topic at even odds rather than at zero', () => {
    expect(smoothedAccuracy(undefined)).toBeCloseTo(0.5);
    expect(smoothedAccuracy({ seen: 0, correct: 0 })).toBeCloseTo(0.5);
  });

  it('moves toward the observed rate as evidence accumulates', () => {
    expect(smoothedAccuracy({ seen: 2, correct: 0 })).toBeCloseTo(0.25);
    expect(smoothedAccuracy({ seen: 20, correct: 2 })).toBeCloseTo(3 / 22);
    expect(smoothedAccuracy({ seen: 20, correct: 20 })).toBeCloseTo(21 / 22);
  });
});

describe('isWeakTopic', () => {
  it('needs evidence before it calls a topic weak', () => {
    expect(isWeakTopic({ seen: 1, correct: 0 })).toBe(false);
    expect(isWeakTopic(undefined)).toBe(false);
  });

  it('flags a topic the learner keeps missing', () => {
    expect(isWeakTopic({ seen: 8, correct: 2 })).toBe(true);
  });

  it('does not flag a topic the learner is solid on', () => {
    expect(isWeakTopic({ seen: 8, correct: 8 })).toBe(false);
  });
});

describe('rankTopicsByWeakness', () => {
  const topics: Record<string, TopicStat> = {
    railroad: { seen: 10, correct: 3 },
    'school-buses': { seen: 10, correct: 5 },
    parking: { seen: 10, correct: 9 },
  };

  it('lists the weakest first', () => {
    expect(rankTopicsByWeakness(topics, ['parking', 'railroad', 'school-buses'])).toEqual([
      'railroad',
      'school-buses',
      'parking',
    ]);
  });

  it('is stable for topics with identical evidence', () => {
    const tied = { a: { seen: 4, correct: 2 }, b: { seen: 4, correct: 2 } };
    expect(rankTopicsByWeakness(tied, ['b', 'a'])).toEqual(['a', 'b']);
  });
});

describe('buildSession', () => {
  const candidates = bank({ railroad: 20, 'school-buses': 20, parking: 20, signals: 20 });

  it('returns a session of the requested size with no repeats', () => {
    const plan = buildSession({ candidates, cards: {}, topics: {}, now: T0, size: 12, seed: 7 });
    expect(plan.picks).toHaveLength(12);
    expect(new Set(plan.picks.map((p) => p.questionId)).size).toBe(12);
    for (const pick of plan.picks) {
      expect(candidates.some((c) => c.id === pick.questionId)).toBe(true);
    }
  });

  it('never exceeds the bank', () => {
    const tiny = bank({ railroad: 3 });
    const plan = buildSession({ candidates: tiny, cards: {}, topics: {}, now: T0, size: 12, seed: 1 });
    expect(plan.picks).toHaveLength(3);
  });

  it('returns nothing for a session of zero', () => {
    expect(buildSession({ candidates, cards: {}, topics: {}, now: T0, size: 0, seed: 1 }).picks).toEqual(
      [],
    );
  });

  it('caps reviews so a session is never nothing but old failures', () => {
    const cards = cardsFrom(candidates.slice(0, 20).map((c, i) => overdue(c.id, c.topic, i + 1)));
    const plan = buildSession({ candidates, cards, topics: {}, now: T0, size: 12, seed: 3 });

    const due = plan.picks.filter((p) => p.reason === 'due');
    expect(due.length).toBe(Math.ceil(12 * REVIEW_SHARE));
    expect(plan.picks.length).toBe(12);
    expect(plan.picks.some((p) => p.reason !== 'due')).toBe(true);
  });

  it('lifts the cap when there is nothing else left to show', () => {
    const seen = cardsFrom(candidates.map((c, i) => overdue(c.id, c.topic, (i % 5) + 1)));
    const plan = buildSession({ candidates, cards: seen, topics: {}, now: T0, size: 12, seed: 3 });
    expect(plan.picks).toHaveLength(12);
    expect(plan.picks.every((p) => p.reason === 'due')).toBe(true);
  });

  it('takes the most overdue reviews first', () => {
    const cards = cardsFrom([
      overdue('railroad-00', 'railroad', 1),
      overdue('railroad-01', 'railroad', 9),
      overdue('railroad-02', 'railroad', 5),
    ]);
    const plan = buildSession({ candidates, cards, topics: {}, now: T0, size: 12, seed: 3 });
    const due = plan.picks.filter((p) => p.reason === 'due').map((p) => p.questionId);
    expect(due).toEqual(['railroad-01', 'railroad-02', 'railroad-00']);
  });

  it('leaves a card alone until it is actually due', () => {
    const notYet = reviewCard(newCard('railroad-00', 'railroad', T0), true, T0);
    const plan = buildSession({
      candidates,
      cards: cardsFrom([notYet]),
      topics: {},
      now: T0 + 60_000,
      size: 12,
      seed: 3,
    });
    expect(plan.picks.some((p) => p.questionId === 'railroad-00')).toBe(false);
  });

  it('spends its new slots on the weakest topics first', () => {
    const topics: Record<string, TopicStat> = {
      railroad: { seen: 12, correct: 2 },
      'school-buses': { seen: 12, correct: 4 },
      parking: { seen: 12, correct: 12 },
      signals: { seen: 12, correct: 12 },
    };
    const plan = buildSession({ candidates, cards: {}, topics, now: T0, size: 8, seed: 5 });
    const counts = plan.picks.reduce<Record<string, number>>((acc, p) => {
      acc[p.topic] = (acc[p.topic] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts.railroad).toBeGreaterThanOrEqual(counts.parking ?? 0);
    expect((counts.railroad ?? 0) + (counts['school-buses'] ?? 0)).toBeGreaterThan(
      (counts.parking ?? 0) + (counts.signals ?? 0),
    );
    expect(plan.picks.filter((p) => p.reason === 'weak-topic').length).toBeGreaterThan(0);
  });

  it('spreads a first-ever session across the whole bank instead of one topic', () => {
    const plan = buildSession({ candidates, cards: {}, topics: {}, now: T0, size: 12, seed: 2 });
    const topicsUsed = new Set(plan.picks.map((p) => p.topic));
    expect(topicsUsed.size).toBe(4);
    expect(plan.picks.every((p) => p.reason === 'new')).toBe(true);
  });

  it('falls back to refreshers once new material runs out', () => {
    // Everything is seen and graduated, so nothing is due and nothing is new.
    const graduated = candidates.slice(0, 6).map((c) => {
      let card = newCard(c.id, c.topic, T0 - 30 * DAY_MS);
      for (let i = 0; i < 3; i += 1) card = reviewCard(card, true, T0 - (3 - i) * DAY_MS);
      return card;
    });
    const plan = buildSession({
      candidates: candidates.slice(0, 6),
      cards: cardsFrom(graduated),
      topics: {},
      now: T0,
      size: 4,
      seed: 9,
    });
    expect(plan.picks).toHaveLength(4);
    expect(plan.picks.every((p) => p.reason === 'refresher')).toBe(true);
  });

  it('shows the least recently seen refresher first', () => {
    const cards = [
      { ...newCard('railroad-00', 'railroad', T0), lastSeenAt: T0 - 3 * DAY_MS, dueAt: T0 + DAY_MS, seen: 1, box: 4 },
      { ...newCard('railroad-01', 'railroad', T0), lastSeenAt: T0 - 9 * DAY_MS, dueAt: T0 + DAY_MS, seen: 1, box: 4 },
    ];
    const plan = buildSession({
      candidates: candidates.slice(0, 2),
      cards: cardsFrom(cards),
      topics: {},
      now: T0,
      size: 2,
      seed: 1,
    });
    expect(plan.picks.map((p) => p.questionId)).toEqual(['railroad-01', 'railroad-00']);
  });

  it('ignores stored cards whose question has left the bank', () => {
    const cards = cardsFrom([overdue('retired-99', 'railroad', 4)]);
    const plan = buildSession({ candidates, cards, topics: {}, now: T0, size: 5, seed: 1 });
    expect(plan.picks.some((p) => p.questionId === 'retired-99')).toBe(false);
    expect(plan.picks).toHaveLength(5);
  });

  it('is deterministic for a given seed and varies with the seed', () => {
    const once = buildSession({ candidates, cards: {}, topics: {}, now: T0, size: 12, seed: 42 });
    const again = buildSession({ candidates, cards: {}, topics: {}, now: T0, size: 12, seed: 42 });
    const other = buildSession({ candidates, cards: {}, topics: {}, now: T0, size: 12, seed: 43 });
    expect(again.picks).toEqual(once.picks);
    expect(other.picks).not.toEqual(once.picks);
  });

  it('interleaves reviews with new material rather than front-loading failures', () => {
    const cards = cardsFrom(candidates.slice(0, 8).map((c, i) => overdue(c.id, c.topic, i + 1)));
    const plan = buildSession({ candidates, cards, topics: {}, now: T0, size: 12, seed: 4 });
    const reasons = plan.picks.map((p) => p.reason);
    expect(reasons[0]).toBe('due');
    expect(reasons.slice(0, 4)).toContain('new');
  });

  it('names the weakest topics that actually made it into the session', () => {
    const topics: Record<string, TopicStat> = {
      railroad: { seen: 12, correct: 2 },
      'school-buses': { seen: 12, correct: 4 },
      parking: { seen: 12, correct: 12 },
      signals: { seen: 12, correct: 12 },
    };
    const plan = buildSession({ candidates, cards: {}, topics, now: T0, size: 8, seed: 5 });
    expect(plan.weakestTopics.slice(0, 2)).toEqual(['railroad', 'school-buses']);
  });

  it('has a default session size', () => {
    expect(DEFAULT_SESSION_SIZE).toBe(12);
  });
});

describe('sessionRationale — the line under the question', () => {
  const label = (id: string) => ({ railroad: 'Railroad crossings', 'school-buses': 'School buses' })[id] ?? id;

  it('names the two weakest topics when there are any', () => {
    expect(sessionRationale(['railroad', 'school-buses'], label)).toBe(
      'queued because Railroad crossings and School buses are your weakest topics',
    );
  });

  it('names a single weak topic in the singular', () => {
    expect(sessionRationale(['railroad'], label)).toBe(
      'queued because Railroad crossings is your weakest topic',
    );
  });

  it('says something honest before there is any evidence', () => {
    expect(sessionRationale([], label)).toBe(
      'queued to cover the exam blueprint evenly until there is enough history to target',
    );
  });
});
