/**
 * Exam attempts: the stored record, its envelope and its migrations.
 *
 * Two things live here, and they answer two different questions.
 *
 *  - **`attempts`** — every finished sitting, newest last, bounded at 200
 *    (grounding §6) so a diligent learner cannot walk into the ~5 MB
 *    `localStorage` ceiling. Each one holds the whole paper and every answer,
 *    because the full review (all 30, in exam order, with citations) has to be
 *    rebuildable months later without the seed happening to resample the same
 *    questions.
 *  - **`active`** — the sitting in progress, if there is one. It is persisted
 *    on purpose: a reload, a phone call or a crash mid-exam must not silently
 *    destroy an attempt. The clock keeps running while you are away, exactly as
 *    it would at a Driver Service Center, so an attempt whose hour has elapsed
 *    is not resumable — it is over.
 *
 * The exam record is a **separate key** from the study record. They have
 * different shapes, different lifetimes and different bounds, and versioning
 * them together would mean every exam change forced a migration of a learner's
 * spaced-repetition ladder.
 *
 * Pure and DOM-free: `loadExamRecord` takes a string, not a `Storage`.
 */
import { EXAM_TIME_LIMIT_SECONDS, isExamRunning, scoreExam } from './exam';
import type {
  ExamAnswer,
  ExamArea,
  ExamAreaScore,
  ExamEndReason,
  ExamQuestionRef,
  ExamReport,
  ExamState,
  ExamVerdict,
} from './exam';

export const EXAM_STORAGE_KEY = 'tn-drive:exams';

/** grounding §6 / practices C4. */
export const EXAM_HISTORY_LIMIT = 200;

export const EXAM_RECORD_VERSION = 1;

export interface ExamAttempt {
  id: string;
  seed: number;
  startedAt: number;
  endedAt: number;
  endReason: ExamEndReason;
  verdict: ExamVerdict;
  correct: number;
  wrong: number;
  answered: number;
  outOf: number;
  elapsedSeconds: number;
  byArea: ExamAreaScore[];
  /** The whole paper, so the review survives a re-cut of the bank. */
  questions: ExamQuestionRef[];
  answers: ExamAnswer[];
}

export interface ExamRecord {
  schemaVersion: number;
  /** Oldest first, newest last. Never longer than `EXAM_HISTORY_LIMIT`. */
  attempts: ExamAttempt[];
  active: ExamState | null;
}

export type ExamLoadStatus = 'empty' | 'ok' | 'migrated' | 'corrupt' | 'future';

export interface ExamLoadResult {
  status: ExamLoadStatus;
  /** Always usable. Empty when the stored payload could not be trusted. */
  state: ExamRecord;
  detail?: string;
  fromVersion?: number;
  foundVersion?: number;
}

export function emptyExamRecord(): ExamRecord {
  return { schemaVersion: EXAM_RECORD_VERSION, attempts: [], active: null };
}

/* --------------------------------------------------------------- recording */

/**
 * A finished sitting, scored and frozen. Returns `null` while the attempt is
 * still open — an unfinished exam is not a result and must not be filed as one.
 */
export function attemptFromState(state: ExamState, areas: readonly ExamArea[]): ExamAttempt | null {
  if (state.endReason === null || state.endedAt === null) return null;
  const report = scoreExam(state, areas);
  return {
    id: state.id,
    seed: state.seed,
    startedAt: state.startedAt,
    endedAt: state.endedAt,
    endReason: state.endReason,
    verdict: report.verdict,
    correct: report.correct,
    wrong: report.wrong,
    answered: report.answered,
    outOf: report.outOf,
    elapsedSeconds: report.elapsedSeconds,
    byArea: report.byArea,
    questions: state.questions,
    answers: state.answers,
  };
}

/**
 * The stored attempt, put back into the shape the engine scores. Nothing
 * derived is persisted — the report is recomputed from the paper and the
 * answers, so a change to the scoring rules can never disagree with history.
 */
export function stateFromAttempt(attempt: ExamAttempt): ExamState {
  return {
    id: attempt.id,
    seed: attempt.seed,
    startedAt: attempt.startedAt,
    deadlineAt: attempt.startedAt + EXAM_TIME_LIMIT_SECONDS * 1000,
    questions: attempt.questions,
    answers: attempt.answers,
    endedAt: attempt.endedAt,
    endReason: attempt.endReason,
  };
}

export function reportFromAttempt(attempt: ExamAttempt, areas: readonly ExamArea[]): ExamReport {
  return scoreExam(stateFromAttempt(attempt), areas);
}

/** Keeps the newest `EXAM_HISTORY_LIMIT`; also used defensively on load. */
export function boundExamAttempts(attempts: readonly ExamAttempt[]): ExamAttempt[] {
  return attempts.length <= EXAM_HISTORY_LIMIT
    ? [...attempts]
    : attempts.slice(attempts.length - EXAM_HISTORY_LIMIT);
}

export function recordExamAttempt(record: ExamRecord, attempt: ExamAttempt): ExamRecord {
  return {
    ...record,
    attempts: boundExamAttempts([...record.attempts, attempt]),
    active: null,
  };
}

export function setActiveExam(record: ExamRecord, state: ExamState | null): ExamRecord {
  return { ...record, active: state };
}

export function latestAttempt(record: ExamRecord): ExamAttempt | undefined {
  return record.attempts.at(-1);
}

export function attemptById(record: ExamRecord, id: string): ExamAttempt | undefined {
  return record.attempts.find((attempt) => attempt.id === id);
}

/**
 * The attempt that was never finished, if there is one. Clock-free, so a
 * component can ask during render — whether its hour has since run out is
 * `resumableExam`'s question, not this one's.
 */
export function openAttempt(record: ExamRecord): ExamState | null {
  const active = record.active;
  return active && active.endReason === null ? active : null;
}

/** The attempt a reload can pick back up: open, and still inside its hour. */
export function resumableExam(record: ExamRecord, now: number): ExamState | null {
  const active = openAttempt(record);
  if (!active) return null;
  return isExamRunning(active, now) ? active : null;
}

/* ------------------------------------------------------------ shape guards */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

function isQuestionRef(value: unknown): value is ExamQuestionRef {
  return (
    isRecord(value) &&
    typeof value.questionId === 'string' &&
    typeof value.topic === 'string' &&
    typeof value.area === 'string'
  );
}

function isAnswer(value: unknown): value is ExamAnswer {
  return (
    isQuestionRef(value) &&
    isNumber((value as unknown as ExamAnswer).chosenIndex) &&
    typeof (value as unknown as ExamAnswer).correct === 'boolean' &&
    isNumber((value as unknown as ExamAnswer).at)
  );
}

function isAreaScore(value: unknown): value is ExamAreaScore {
  return (
    isRecord(value) &&
    typeof value.area === 'string' &&
    isNumber(value.asked) &&
    isNumber(value.correct)
  );
}

function isAttempt(value: unknown): value is ExamAttempt {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    isNumber(value.seed) &&
    isNumber(value.startedAt) &&
    isNumber(value.endedAt) &&
    typeof value.endReason === 'string' &&
    typeof value.verdict === 'string' &&
    isNumber(value.correct) &&
    isNumber(value.wrong) &&
    isNumber(value.answered) &&
    isNumber(value.outOf) &&
    isNumber(value.elapsedSeconds) &&
    Array.isArray(value.byArea) &&
    value.byArea.every(isAreaScore) &&
    Array.isArray(value.questions) &&
    value.questions.every(isQuestionRef) &&
    Array.isArray(value.answers) &&
    value.answers.every(isAnswer)
  );
}

function isActiveExam(value: unknown): value is ExamState {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    isNumber(value.seed) &&
    isNumber(value.startedAt) &&
    isNumber(value.deadlineAt) &&
    Array.isArray(value.questions) &&
    value.questions.every(isQuestionRef) &&
    Array.isArray(value.answers) &&
    value.answers.every(isAnswer) &&
    (value.endedAt === null || isNumber(value.endedAt)) &&
    (value.endReason === null || typeof value.endReason === 'string')
  );
}

function isExamRecordState(value: unknown): value is ExamRecord {
  if (!isRecord(value)) return false;
  if (!Array.isArray(value.attempts) || !value.attempts.every(isAttempt)) return false;
  if (value.active !== null && !isActiveExam(value.active)) return false;
  return true;
}

/* --------------------------------------------------------------- migrations */

/**
 * Version 0 is any payload written before the exam record was versioned. It is
 * salvaged rather than discarded: an unreadable attempt is dropped, the
 * readable ones are kept, and a half-written attempt in progress is abandoned
 * rather than resumed — resuming a broken exam is worse than losing it.
 */
function migrateV0toV1(raw: unknown): ExamRecord {
  const source = isRecord(raw) ? raw : {};
  const attempts = Array.isArray(source.attempts) ? source.attempts.filter(isAttempt) : [];
  return {
    schemaVersion: EXAM_RECORD_VERSION,
    attempts: boundExamAttempts(attempts),
    active: isActiveExam(source.active) ? source.active : null,
  };
}

export function migrateExamRecord(persisted: unknown, fromVersion: number): ExamRecord {
  if (fromVersion === EXAM_RECORD_VERSION) {
    if (!isExamRecordState(persisted)) throw new Error('Stored exam history has the wrong shape');
    return {
      schemaVersion: EXAM_RECORD_VERSION,
      attempts: boundExamAttempts(persisted.attempts),
      active: persisted.active,
    };
  }
  if (fromVersion === 0) return migrateV0toV1(persisted);
  throw new Error(`Cannot migrate exam history from schema version ${String(fromVersion)}`);
}

/* -------------------------------------------------------------- load / save */

export function serializeExamRecord(record: ExamRecord): string {
  return JSON.stringify({ state: record, version: EXAM_RECORD_VERSION });
}

export function loadExamRecord(raw: string | null): ExamLoadResult {
  if (raw === null || raw === '') return { status: 'empty', state: emptyExamRecord() };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      status: 'corrupt',
      state: emptyExamRecord(),
      detail: 'The saved exam history is not valid JSON.',
    };
  }

  if (!isRecord(parsed) || !isRecord(parsed.state)) {
    return {
      status: 'corrupt',
      state: emptyExamRecord(),
      detail: 'The saved exam history is missing its attempts.',
    };
  }

  const version = isNumber(parsed.version) ? parsed.version : 0;
  if (version > EXAM_RECORD_VERSION) {
    return { status: 'future', state: emptyExamRecord(), foundVersion: version };
  }

  try {
    const state = migrateExamRecord(parsed.state, version);
    return version === EXAM_RECORD_VERSION
      ? { status: 'ok', state }
      : { status: 'migrated', state, fromVersion: version };
  } catch (error) {
    return {
      status: 'corrupt',
      state: emptyExamRecord(),
      detail: error instanceof Error ? error.message : 'The saved exam history could not be read.',
    };
  }
}
