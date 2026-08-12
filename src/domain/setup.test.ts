import { describe, it, expect } from 'vitest';
import {
  SETUP_SCHEMA_VERSION,
  completeSetup,
  dailyPace,
  daysUntilTest,
  emptySetup,
  isSetupComplete,
  loadSetup,
  migrateSetup,
  probeStorage,
  serializeSetup,
} from './setup';

const AUG_11 = Date.UTC(2026, 7, 11, 12, 0, 0);

describe('setup record', () => {
  it('starts incomplete, with no goal chosen for the learner', () => {
    const setup = emptySetup();
    expect(setup.schemaVersion).toBe(SETUP_SCHEMA_VERSION);
    expect(setup.goal).toBe('class-d');
    expect(setup.testDate).toBeNull();
    expect(isSetupComplete(setup)).toBe(false);
  });

  it('is complete once onboarding is answered, and keeps the answers', () => {
    const setup = completeSetup(emptySetup(), {
      goal: 'signs',
      testDate: '2026-09-12',
      at: AUG_11,
    });
    expect(isSetupComplete(setup)).toBe(true);
    expect(setup.goal).toBe('signs');
    expect(setup.testDate).toBe('2026-09-12');
    expect(setup.completedAt).toBe(AUG_11);
  });

  it('treats an unparseable test date as no date rather than storing rubbish', () => {
    const setup = completeSetup(emptySetup(), { goal: 'class-d', testDate: '12/09/26', at: AUG_11 });
    expect(setup.testDate).toBeNull();
  });

  it('rejects a well-formed date that is not a real day', () => {
    const setup = completeSetup(emptySetup(), { goal: 'class-d', testDate: '2026-02-30', at: AUG_11 });
    expect(setup.testDate).toBeNull();
    expect(daysUntilTest('2026-13-01', AUG_11)).toBeNull();
  });
});

describe('setup persistence', () => {
  it('round-trips through the envelope', () => {
    const setup = completeSetup(emptySetup(), {
      goal: 'class-d',
      testDate: '2026-09-12',
      at: AUG_11,
    });
    const result = loadSetup(serializeSetup(setup));
    expect(result.status).toBe('ok');
    expect(result.state).toEqual(setup);
  });

  it('reads a missing key as empty, not as an error', () => {
    expect(loadSetup(null).status).toBe('empty');
    expect(loadSetup('').status).toBe('empty');
    expect(isSetupComplete(loadSetup(null).state)).toBe(false);
  });

  it('degrades a garbage payload to a usable empty record', () => {
    const result = loadSetup('{"garbage":true');
    expect(result.status).toBe('corrupt');
    expect(result.detail).toBeTruthy();
    expect(isSetupComplete(result.state)).toBe(false);
  });

  it('degrades a payload of the wrong shape to a usable empty record', () => {
    const result = loadSetup(JSON.stringify({ version: 1, state: { goal: 42 } }));
    expect(result.status).toBe('corrupt');
    expect(result.state.goal).toBe('class-d');
  });

  it('reports a payload with no envelope as corrupt', () => {
    const result = loadSetup(JSON.stringify(['not', 'an', 'envelope']));
    expect(result.status).toBe('corrupt');
  });

  it('refuses to guess at a future schema version', () => {
    const result = loadSetup(JSON.stringify({ version: 99, state: { goal: 'class-d' } }));
    expect(result.status).toBe('future');
    expect(result.foundVersion).toBe(99);
    expect(isSetupComplete(result.state)).toBe(false);
  });

  it('migrates an unversioned payload rather than discarding the answers', () => {
    const raw = JSON.stringify({
      state: { goal: 'signs', testDate: '2026-09-12', completedAt: AUG_11 },
    });
    const result = loadSetup(raw);
    expect(result.status).toBe('migrated');
    expect(result.fromVersion).toBe(0);
    expect(result.state.goal).toBe('signs');
    expect(result.state.testDate).toBe('2026-09-12');
    expect(isSetupComplete(result.state)).toBe(true);
  });

  it('salvages what it can from a half-written v0 payload', () => {
    const state = migrateSetup({ goal: 'nonsense', testDate: 7, completedAt: 'soon' }, 0);
    expect(state.goal).toBe('class-d');
    expect(state.testDate).toBeNull();
    expect(state.completedAt).toBeNull();
  });

  it('throws rather than guessing at an unknown version', () => {
    expect(() => migrateSetup({}, 42)).toThrow(/schema version 42/);
  });
});

describe('pace', () => {
  it('counts whole days to the test, in the learner’s own day', () => {
    expect(daysUntilTest('2026-09-12', AUG_11)).toBe(32);
    expect(daysUntilTest('2026-08-11', AUG_11)).toBe(0);
    expect(daysUntilTest('2026-08-10', AUG_11)).toBe(-1);
    expect(daysUntilTest(null, AUG_11)).toBeNull();
  });

  it('turns days left into questions a day, rounded up so the bank is covered', () => {
    expect(dailyPace(506, 32)).toBe(16);
    expect(dailyPace(506, 1)).toBe(506);
    // The day of the test, and any day after it, is not a pace — it is a nudge.
    expect(dailyPace(506, 0)).toBeNull();
    expect(dailyPace(506, -3)).toBeNull();
    expect(dailyPace(0, 10)).toBe(0);
    expect(dailyPace(506, null)).toBeNull();
  });
});

describe('probeStorage', () => {
  const working = (): Storage => {
    const map = new Map<string, string>();
    return {
      get length() {
        return map.size;
      },
      clear: () => {
        map.clear();
      },
      key: () => null,
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
      removeItem: (k: string) => {
        map.delete(k);
      },
    };
  };

  it('is true when a write survives a read, and leaves nothing behind', () => {
    const storage = working();
    expect(probeStorage(storage)).toBe(true);
    expect(storage.length).toBe(0);
  });

  it('is false when there is no storage at all', () => {
    expect(probeStorage(null)).toBe(false);
  });

  it('is false when the write throws — private browsing or a full quota', () => {
    const storage = working();
    storage.setItem = () => {
      throw new DOMException('QuotaExceededError');
    };
    expect(probeStorage(storage)).toBe(false);
  });

  it('is false when the write is silently swallowed', () => {
    const storage = working();
    storage.setItem = () => {
      /* accepted, then dropped — Safari has done exactly this */
    };
    expect(probeStorage(storage)).toBe(false);
  });
});
