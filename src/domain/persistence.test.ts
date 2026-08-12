import { describe, it, expect, vi } from 'vitest';
import {
  CURRENT_SCHEMA_VERSION,
  STORAGE_KEY,
  createSafeStorage,
  loadProgress,
  migrateProgress,
  serializeProgress,
} from './persistence';
import { ATTEMPT_HISTORY_LIMIT, emptyProgress, recordAttempt } from './progress';
import type { StudyProgress } from './progress';

const T0 = Date.UTC(2026, 7, 11, 9, 0, 0);

function populated(): StudyProgress {
  let state = emptyProgress();
  for (let i = 0; i < 3; i += 1) {
    state = recordAttempt(state, {
      questionId: `q${String(i)}`,
      topic: 'railroad',
      area: 'rules-of-road',
      chosenIndex: 0,
      correct: i % 2 === 0,
      at: T0 + i,
    }).state;
  }
  return state;
}

describe('the persisted envelope', () => {
  it('is keyed and versioned', () => {
    expect(STORAGE_KEY).toBe('tn-drive:progress');
    expect(CURRENT_SCHEMA_VERSION).toBe(1);
    const envelope: unknown = JSON.parse(serializeProgress(populated()));
    expect(envelope).toMatchObject({ version: CURRENT_SCHEMA_VERSION });
  });

  it('round-trips a real study record without loss', () => {
    const state = populated();
    const result = loadProgress(serializeProgress(state));
    expect(result.status).toBe('ok');
    expect(result.state).toEqual(state);
  });
});

describe('loadProgress degrades to something recoverable, never a white screen', () => {
  it('treats a missing key as a first run', () => {
    const result = loadProgress(null);
    expect(result.status).toBe('empty');
    expect(result.state).toEqual(emptyProgress());
  });

  it('treats unparseable text as corrupt and hands back an empty record', () => {
    const result = loadProgress('}{not json');
    expect(result.status).toBe('corrupt');
    expect(result.state).toEqual(emptyProgress());
    expect(result.detail).toBeTruthy();
  });

  it('rejects the executable-floor garbage payload (X19)', () => {
    const result = loadProgress('{"garbage":true}');
    expect(result.status).toBe('corrupt');
    expect(result.state).toEqual(emptyProgress());
  });

  it('rejects a payload whose fields are the wrong shape', () => {
    const result = loadProgress(
      JSON.stringify({ version: 1, state: { cards: [], topics: {}, attempts: {} } }),
    );
    expect(result.status).toBe('corrupt');
  });

  it('refuses a future schema version rather than guessing (X20)', () => {
    const result = loadProgress(JSON.stringify({ version: 99, state: emptyProgress() }));
    expect(result.status).toBe('future');
    expect(result.foundVersion).toBe(99);
    expect(result.state).toEqual(emptyProgress());
  });

  it('trims an over-long attempt log written by an older build', () => {
    const attempts = Array.from({ length: 260 }, (_, i) => ({
      questionId: `q${String(i)}`,
      topic: 'railroad',
      area: 'rules-of-road',
      chosenIndex: 0,
      correct: true,
      at: T0 + i,
    }));
    const result = loadProgress(
      JSON.stringify({ version: 1, state: { ...emptyProgress(), attempts } }),
    );
    expect(result.status).toBe('ok');
    expect(result.state.attempts).toHaveLength(ATTEMPT_HISTORY_LIMIT);
    expect(result.state.attempts[0]!.questionId).toBe('q60');
  });
});

describe('migration from schema 0 — the unversioned payload every pre-release build wrote', () => {
  it('is applied on load and reported as a migration', () => {
    const legacy = {
      cards: {
        'row-017': {
          questionId: 'row-017',
          topic: 'right-of-way',
          box: 2,
          streak: 2,
          seen: 4,
          correct: 3,
          dueAt: T0,
          lastSeenAt: T0 - 1000,
        },
      },
      topics: { 'right-of-way': { seen: 4, correct: 3 } },
      attempts: [],
    };
    const result = loadProgress(JSON.stringify({ version: 0, state: legacy }));
    expect(result.status).toBe('migrated');
    expect(result.fromVersion).toBe(0);
    expect(result.state.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    // `lapses` did not exist at v0 and is backfilled from the record itself.
    expect(result.state.cards['row-017']!.lapses).toBe(1);
    expect(result.state.sessionsCompleted).toBe(0);
    expect(result.state.lastStudiedAt).toBe(T0 - 1000);
  });

  it('treats a payload with no version at all as schema 0', () => {
    const result = loadProgress(JSON.stringify({ state: { cards: {}, topics: {}, attempts: [] } }));
    expect(result.status).toBe('migrated');
    expect(result.fromVersion).toBe(0);
  });

  it('drops a v0 card that is not a card, rather than poisoning the scheduler', () => {
    const result = loadProgress(
      JSON.stringify({
        version: 0,
        state: { cards: { good: { questionId: 'good', topic: 't' }, bad: 'nope' }, topics: {}, attempts: [] },
      }),
    );
    expect(result.status).toBe('migrated');
    expect(Object.keys(result.state.cards)).toEqual(['good']);
    expect(result.state.cards.good!.box).toBe(0);
  });

  it('leaves lastStudiedAt null when a v0 record has never been studied', () => {
    const result = loadProgress(
      JSON.stringify({ version: 0, state: { cards: {}, topics: {}, attempts: [] } }),
    );
    expect(result.state.lastStudiedAt).toBeNull();
  });

  it('keeps a v0 record’s own counters when it already had them', () => {
    const result = loadProgress(
      JSON.stringify({
        version: 0,
        state: { cards: {}, topics: {}, attempts: [], sessionsCompleted: 4, lastStudiedAt: T0 },
      }),
    );
    expect(result.state.sessionsCompleted).toBe(4);
    expect(result.state.lastStudiedAt).toBe(T0);
  });

  it('discards v0 fields that are not the right shape at all', () => {
    const result = loadProgress(
      JSON.stringify({
        version: 0,
        state: { cards: 'nope', topics: { good: { seen: 1, correct: 1 }, bad: 7 }, attempts: 'nope' },
      }),
    );
    expect(result.state.cards).toEqual({});
    expect(result.state.topics).toEqual({ good: { seen: 1, correct: 1 } });
    expect(result.state.attempts).toEqual([]);
  });

  it('turns a v0 payload that is not an object at all into an empty record', () => {
    expect(migrateProgress('nope', 0)).toEqual(emptyProgress());
  });

  it('is exposed directly so every prior version has a unit-tested path (C2)', () => {
    const migrated = migrateProgress({ cards: {}, topics: {}, attempts: [] }, 0);
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('leaves a current-version payload alone', () => {
    const state = populated();
    expect(migrateProgress(state, CURRENT_SCHEMA_VERSION)).toEqual(state);
  });

  it('throws for a version it cannot reach, so the caller must handle it', () => {
    expect(() => migrateProgress(emptyProgress(), 99)).toThrow(/schema/i);
  });
});

describe('createSafeStorage — a locked store is session-only mode, not a crash (C5, X21)', () => {
  function memoryStore(): Storage {
    const map = new Map<string, string>();
    return {
      get length() {
        return map.size;
      },
      clear: () => map.clear(),
      key: (i: number) => [...map.keys()][i] ?? null,
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
    };
  }

  it('reads and writes through when storage works', () => {
    const onFailure = vi.fn();
    const storage = createSafeStorage(memoryStore(), onFailure);
    storage.setItem('a', '1');
    expect(storage.getItem('a')).toBe('1');
    storage.removeItem('a');
    expect(storage.getItem('a')).toBeNull();
    expect(onFailure).not.toHaveBeenCalled();
  });

  it('swallows a throwing setItem and reports it once', () => {
    const onFailure = vi.fn();
    const backing = memoryStore();
    backing.setItem = () => {
      throw new DOMException('QuotaExceededError');
    };
    const storage = createSafeStorage(backing, onFailure);
    expect(() => {
      storage.setItem('a', '1');
      storage.setItem('a', '2');
    }).not.toThrow();
    expect(onFailure).toHaveBeenCalledTimes(1);
  });

  it('survives a throwing getItem and a throwing removeItem', () => {
    const onFailure = vi.fn();
    const backing = memoryStore();
    backing.getItem = () => {
      throw new Error('blocked');
    };
    backing.removeItem = () => {
      throw new Error('blocked');
    };
    const storage = createSafeStorage(backing, onFailure);
    expect(storage.getItem('a')).toBeNull();
    expect(() => storage.removeItem('a')).not.toThrow();
    expect(onFailure).toHaveBeenCalled();
  });

  it('reports failure when there is no storage object at all', () => {
    const onFailure = vi.fn();
    const storage = createSafeStorage(null, onFailure);
    expect(storage.getItem('a')).toBeNull();
    storage.setItem('a', '1');
    expect(onFailure).toHaveBeenCalled();
  });

  it('will not throw on removeItem with no storage either', () => {
    const onFailure = vi.fn();
    const storage = createSafeStorage(null, onFailure);
    expect(() => {
      storage.removeItem('a');
    }).not.toThrow();
    expect(onFailure).toHaveBeenCalledTimes(1);
  });
});
