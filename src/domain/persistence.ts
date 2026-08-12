/**
 * Persistence: the schema envelope, its migrations, and a `localStorage`
 * wrapper that cannot throw.
 *
 * Everything a learner has done lives in one `localStorage` key under an
 * integer `schemaVersion` (grounding §6). Three failure modes are treated as
 * expected rather than exceptional, because all three happen in the field:
 *
 *  - **corrupt** — a half-written or hand-edited payload;
 *  - **future** — the learner used a newer build on this device, then a cached
 *    older one; the old build must not guess at a shape it has never seen;
 *  - **unwritable** — private browsing or a full quota, which becomes
 *    session-only mode rather than an unhandled rejection.
 *
 * Every one of them resolves to a usable empty record plus a status the UI can
 * explain. There is no path here that produces a white screen.
 *
 * Pure and DOM-free: `loadProgress` takes a string, not a `Storage`.
 */
import { ATTEMPT_HISTORY_LIMIT, CURRENT_SCHEMA_VERSION, boundAttempts, emptyProgress } from './progress';
import type { Attempt, StudyProgress } from './progress';
import type { CardState } from './scheduler';
import type { TopicStat } from './session';

export { CURRENT_SCHEMA_VERSION } from './progress';

export const STORAGE_KEY = 'tn-drive:progress';

export type LoadStatus = 'empty' | 'ok' | 'migrated' | 'corrupt' | 'future';

export interface LoadResult {
  status: LoadStatus;
  /** Always usable. Empty when the stored payload could not be trusted. */
  state: StudyProgress;
  /** Present on `corrupt` — short, quotable, never a stack trace. */
  detail?: string;
  /** Present on `migrated`. */
  fromVersion?: number;
  /** Present on `future`. */
  foundVersion?: number;
}

/* ------------------------------------------------------------- shape guards */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

function isCard(value: unknown): value is CardState {
  return (
    isRecord(value) &&
    typeof value.questionId === 'string' &&
    typeof value.topic === 'string' &&
    isNumber(value.box) &&
    isNumber(value.streak) &&
    isNumber(value.lapses) &&
    isNumber(value.seen) &&
    isNumber(value.correct) &&
    isNumber(value.dueAt) &&
    isNumber(value.lastSeenAt)
  );
}

function isTopicStat(value: unknown): value is TopicStat {
  return isRecord(value) && isNumber(value.seen) && isNumber(value.correct);
}

function isAttempt(value: unknown): value is Attempt {
  return (
    isRecord(value) &&
    typeof value.questionId === 'string' &&
    typeof value.topic === 'string' &&
    typeof value.area === 'string' &&
    isNumber(value.chosenIndex) &&
    typeof value.correct === 'boolean' &&
    isNumber(value.at)
  );
}

function isStudyProgress(value: unknown): value is StudyProgress {
  if (!isRecord(value)) return false;
  if (!isRecord(value.cards) || !Object.values(value.cards).every(isCard)) return false;
  if (!isRecord(value.topics) || !Object.values(value.topics).every(isTopicStat)) return false;
  if (!Array.isArray(value.attempts) || !value.attempts.every(isAttempt)) return false;
  if (!isNumber(value.sessionsCompleted)) return false;
  if (value.lastStudiedAt !== null && !isNumber(value.lastStudiedAt)) return false;
  return true;
}

/* -------------------------------------------------------------- migrations */

/**
 * Schema 0 is any payload written before the store was versioned: the shape is
 * broadly right but fields added later are missing. It is upgraded rather than
 * discarded — a learner should not lose three weeks of work to a field name.
 */
function migrateV0toV1(raw: unknown): StudyProgress {
  const source = isRecord(raw) ? raw : {};

  const cards: Record<string, CardState> = {};
  if (isRecord(source.cards)) {
    for (const [id, value] of Object.entries(source.cards)) {
      if (!isRecord(value) || typeof value.questionId !== 'string') continue;
      const seen = isNumber(value.seen) ? value.seen : 0;
      const correct = isNumber(value.correct) ? value.correct : 0;
      cards[id] = {
        questionId: value.questionId,
        topic: typeof value.topic === 'string' ? value.topic : '',
        box: isNumber(value.box) ? value.box : 0,
        streak: isNumber(value.streak) ? value.streak : 0,
        // `lapses` did not exist at v0; the record itself implies it.
        lapses: isNumber(value.lapses) ? value.lapses : Math.max(0, seen - correct),
        seen,
        correct,
        dueAt: isNumber(value.dueAt) ? value.dueAt : 0,
        lastSeenAt: isNumber(value.lastSeenAt) ? value.lastSeenAt : 0,
      };
    }
  }

  const topics: Record<string, TopicStat> = {};
  if (isRecord(source.topics)) {
    for (const [id, value] of Object.entries(source.topics)) {
      if (!isTopicStat(value)) continue;
      topics[id] = { seen: value.seen, correct: value.correct };
    }
  }

  const attempts = boundAttempts(
    Array.isArray(source.attempts) ? source.attempts.filter(isAttempt) : [],
  );

  const lastTouch = Math.max(
    0,
    ...Object.values(cards).map((c) => c.lastSeenAt),
    ...attempts.map((a) => a.at),
  );

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    cards,
    topics,
    attempts,
    sessionsCompleted: isNumber(source.sessionsCompleted) ? source.sessionsCompleted : 0,
    lastStudiedAt: isNumber(source.lastStudiedAt)
      ? source.lastStudiedAt
      : lastTouch > 0
        ? lastTouch
        : null,
  };
}

/**
 * Every prior schema version has a path to the current one. Unknown or future
 * versions throw, because silently guessing at a shape is how a learner's
 * record gets quietly destroyed.
 */
export function migrateProgress(persisted: unknown, fromVersion: number): StudyProgress {
  if (fromVersion === CURRENT_SCHEMA_VERSION) {
    if (!isStudyProgress(persisted)) throw new Error('Persisted study record has the wrong shape');
    return { ...persisted, attempts: boundAttempts(persisted.attempts) };
  }
  if (fromVersion === 0) return migrateV0toV1(persisted);
  throw new Error(`Cannot migrate study record from schema version ${String(fromVersion)}`);
}

/* -------------------------------------------------------------- load / save */

export function serializeProgress(state: StudyProgress): string {
  return JSON.stringify({ state, version: CURRENT_SCHEMA_VERSION });
}

export function loadProgress(raw: string | null): LoadResult {
  if (raw === null || raw === '') return { status: 'empty', state: emptyProgress() };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: 'corrupt', state: emptyProgress(), detail: 'The saved record is not valid JSON.' };
  }

  if (!isRecord(parsed) || !isRecord(parsed.state)) {
    return {
      status: 'corrupt',
      state: emptyProgress(),
      detail: 'The saved record is missing its study data.',
    };
  }

  const version = isNumber(parsed.version) ? parsed.version : 0;
  if (version > CURRENT_SCHEMA_VERSION) {
    return { status: 'future', state: emptyProgress(), foundVersion: version };
  }

  try {
    const state = migrateProgress(parsed.state, version);
    return version === CURRENT_SCHEMA_VERSION
      ? { status: 'ok', state }
      : { status: 'migrated', state, fromVersion: version };
  } catch (error) {
    return {
      status: 'corrupt',
      state: emptyProgress(),
      detail: error instanceof Error ? error.message : 'The saved record could not be read.',
    };
  }
}

/* ------------------------------------------------------------ safe storage */

export interface SafeStorage {
  getItem(name: string): string | null;
  setItem(name: string, value: string): void;
  removeItem(name: string): void;
}

/**
 * `localStorage` throws in private mode, over quota, and when a browser policy
 * blocks it. Every access goes through here, so a write failure becomes
 * session-only mode (practices C5) instead of an unhandled rejection. The
 * failure is reported **once** — a store that cannot write will fail on every
 * keystroke, and the learner needs telling exactly one time.
 */
export function createSafeStorage(
  backing: Storage | null,
  onFailure: (error: unknown) => void,
): SafeStorage {
  let reported = false;
  const report = (error: unknown) => {
    if (reported) return;
    reported = true;
    onFailure(error);
  };

  return {
    getItem(name) {
      if (!backing) {
        report(new Error('No storage available'));
        return null;
      }
      try {
        return backing.getItem(name);
      } catch (error) {
        report(error);
        return null;
      }
    },
    setItem(name, value) {
      if (!backing) {
        report(new Error('No storage available'));
        return;
      }
      try {
        backing.setItem(name, value);
      } catch (error) {
        report(error);
      }
    },
    removeItem(name) {
      if (!backing) {
        report(new Error('No storage available'));
        return;
      }
      try {
        backing.removeItem(name);
      } catch (error) {
        report(error);
      }
    },
  };
}

export { ATTEMPT_HISTORY_LIMIT };
