import { describe, it, expect } from 'vitest';
import {
  SIGN_RECORD_VERSION,
  completeDrill,
  emptySignRecord,
  loadSignRecord,
  masteryPips,
  masteryTier,
  migrateSignRecord,
  recordSignAnswer,
  serializeSignRecord,
  shakySignIds,
  summariseSignMastery,
  tierLabel,
} from './sign-progress';
import type { SignRecord } from './sign-progress';
import { GRADUATED_BOX, newCard, reviewCard } from './scheduler';
import type { CardState } from './scheduler';

const T0 = Date.UTC(2026, 7, 11, 9, 0, 0);

/** A sign answered `times` in a row correctly. */
function solid(id: string, category: string, times = GRADUATED_BOX): CardState {
  let card = newCard(id, category, T0);
  for (let i = 0; i < times; i += 1) card = reviewCard(card, true, T0);
  return card;
}

function cardsFrom(entries: CardState[]): Record<string, CardState> {
  return Object.fromEntries(entries.map((c) => [c.questionId, c]));
}

describe('emptySignRecord', () => {
  it('is usable and carries the current schema version', () => {
    const record = emptySignRecord();
    expect(record.schemaVersion).toBe(SIGN_RECORD_VERSION);
    expect(record.cards).toEqual({});
    expect(record.categories).toEqual({});
    expect(record.drillsCompleted).toBe(0);
    expect(record.lastDrilledAt).toBeNull();
  });
});

describe('recordSignAnswer', () => {
  it('creates a card on first sighting and returns both sides of the review', () => {
    const result = recordSignAnswer(emptySignRecord(), {
      signId: 'r1-1-stop',
      category: 'regulatory',
      correct: true,
      at: T0,
    });
    expect(result.before.seen).toBe(0);
    expect(result.after.seen).toBe(1);
    expect(result.after.box).toBe(1);
    expect(result.state.cards['r1-1-stop']?.correct).toBe(1);
    expect(result.state.categories['regulatory']).toEqual({ seen: 1, correct: 1 });
    expect(result.state.lastDrilledAt).toBe(T0);
  });

  it('sends a miss back to the ten-minute box and counts it against the category', () => {
    const first = recordSignAnswer(emptySignRecord(), {
      signId: 'w1-1-turn',
      category: 'warning',
      correct: true,
      at: T0,
    });
    const second = recordSignAnswer(first.state, {
      signId: 'w1-1-turn',
      category: 'warning',
      correct: false,
      at: T0 + 1000,
    });
    expect(second.after.box).toBe(0);
    expect(second.after.lapses).toBe(1);
    expect(second.state.categories['warning']).toEqual({ seen: 2, correct: 1 });
  });

  it('does not mutate the record it was handed', () => {
    const before = emptySignRecord();
    recordSignAnswer(before, { signId: 'r1-1-stop', category: 'regulatory', correct: true, at: T0 });
    expect(before.cards).toEqual({});
    expect(before.categories).toEqual({});
  });
});

describe('completeDrill', () => {
  it('counts the drill and stamps the time', () => {
    const record = completeDrill(emptySignRecord(), T0);
    expect(record.drillsCompleted).toBe(1);
    expect(record.lastDrilledAt).toBe(T0);
    expect(completeDrill(record, T0 + 10).drillsCompleted).toBe(2);
  });
});

describe('mastery tiers', () => {
  it('calls an unseen sign new, with no pips lit', () => {
    expect(masteryTier(undefined)).toBe('new');
    expect(masteryPips(undefined)).toBe(0);
    expect(masteryTier(newCard('x', 'warning', T0))).toBe('new');
  });

  it('calls a sign solid once it has been right three times running', () => {
    const card = solid('r1-1-stop', 'regulatory');
    expect(card.box).toBe(GRADUATED_BOX);
    expect(masteryTier(card)).toBe('solid');
    expect(masteryPips(card)).toBe(3);
  });

  it('calls everything in between review, and lights a pip per box', () => {
    const once = reviewCard(newCard('a', 'warning', T0), true, T0);
    expect(masteryTier(once)).toBe('review');
    expect(masteryPips(once)).toBe(1);
    const missed = reviewCard(once, false, T0);
    expect(masteryTier(missed)).toBe('review');
    expect(masteryPips(missed)).toBe(0);
  });

  it('never lights more than three pips, however high the box climbs', () => {
    expect(masteryPips(solid('a', 'warning', 6))).toBe(3);
  });

  it('gives every tier a word, because colour is never the only carrier', () => {
    expect(tierLabel('solid')).toBe('Solid');
    expect(tierLabel('review')).toBe('Review');
    expect(tierLabel('new')).toBe('New');
  });
});

describe('summariseSignMastery', () => {
  const cards = cardsFrom([
    solid('a', 'regulatory'),
    solid('b', 'regulatory'),
    reviewCard(newCard('c', 'warning', T0), true, T0),
  ]);

  it('counts solid, review and not-yet-seen across the registry', () => {
    const summary = summariseSignMastery(cards, ['a', 'b', 'c', 'd']);
    expect(summary).toEqual({ total: 4, solid: 2, review: 1, unseen: 1, percentSolid: 50 });
  });

  it('ignores cards for signs no longer in the registry', () => {
    const summary = summariseSignMastery(cards, ['a']);
    expect(summary).toEqual({ total: 1, solid: 1, review: 0, unseen: 0, percentSolid: 100 });
  });

  it('reports zero rather than NaN for an empty registry', () => {
    expect(summariseSignMastery({}, [])).toEqual({
      total: 0,
      solid: 0,
      review: 0,
      unseen: 0,
      percentSolid: 0,
    });
  });
});

describe('shakySignIds', () => {
  it('returns signs the learner has met but not mastered, weakest first', () => {
    const strong = reviewCard(newCard('b', 'warning', T0), true, T0);
    const weak = reviewCard(newCard('a', 'warning', T0), false, T0);
    const cards = cardsFrom([solid('z', 'regulatory'), strong, weak]);
    expect(shakySignIds(cards, ['a', 'b', 'z'])).toEqual(['a', 'b']);
  });

  it('is empty when nothing has been seen — a new learner is not shaky, they are new', () => {
    expect(shakySignIds({}, ['a', 'b'])).toEqual([]);
  });
});

/* ------------------------------------------------------- envelope + storage */

describe('serialize / load', () => {
  it('round-trips a record', () => {
    const record = recordSignAnswer(emptySignRecord(), {
      signId: 'r1-1-stop',
      category: 'regulatory',
      correct: true,
      at: T0,
    }).state;
    const result = loadSignRecord(serializeSignRecord(record));
    expect(result.status).toBe('ok');
    expect(result.state).toEqual(record);
  });

  it('treats an absent key as empty, not as an error', () => {
    expect(loadSignRecord(null).status).toBe('empty');
    expect(loadSignRecord('').status).toBe('empty');
  });

  it('recovers from a payload that is not JSON', () => {
    const result = loadSignRecord('{not json');
    expect(result.status).toBe('corrupt');
    expect(result.state).toEqual(emptySignRecord());
    expect(result.detail).toMatch(/JSON/);
  });

  it('recovers from a payload with no state at all', () => {
    const result = loadSignRecord(JSON.stringify({ version: 1 }));
    expect(result.status).toBe('corrupt');
    expect(result.detail).toMatch(/missing/);
  });

  it('leaves a record written by a newer build alone', () => {
    const result = loadSignRecord(
      JSON.stringify({ state: emptySignRecord(), version: SIGN_RECORD_VERSION + 5 }),
    );
    expect(result.status).toBe('future');
    expect(result.foundVersion).toBe(SIGN_RECORD_VERSION + 5);
    expect(result.state).toEqual(emptySignRecord());
  });

  it('reports a wrong-shaped payload as corrupt rather than trusting it', () => {
    const result = loadSignRecord(
      JSON.stringify({ state: { cards: { a: 7 }, categories: {} }, version: SIGN_RECORD_VERSION }),
    );
    expect(result.status).toBe('corrupt');
  });

  it('salvages an unversioned payload rather than discarding a learner’s work', () => {
    const card = solid('r1-1-stop', 'regulatory');
    const result = loadSignRecord(
      JSON.stringify({
        state: {
          cards: { 'r1-1-stop': card, junk: { nope: true } },
          categories: { regulatory: { seen: 3, correct: 3 }, bad: { seen: 'x' } },
        },
      }),
    );
    expect(result.status).toBe('migrated');
    expect(result.fromVersion).toBe(0);
    expect(Object.keys(result.state.cards)).toEqual(['r1-1-stop']);
    expect(result.state.categories).toEqual({ regulatory: { seen: 3, correct: 3 } });
  });

  it('refuses to guess at a schema version it has never seen', () => {
    expect(() => migrateSignRecord(emptySignRecord(), 42)).toThrow(/schema version 42/);
  });

  it('accepts a current-version record through the migration door unchanged', () => {
    const record: SignRecord = emptySignRecord();
    expect(migrateSignRecord(record, SIGN_RECORD_VERSION)).toEqual(record);
  });
});
