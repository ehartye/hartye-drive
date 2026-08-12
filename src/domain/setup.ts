/**
 * The setup record — the only thing onboarding asks for, and the only thing the
 * app knows about the learner.
 *
 * Two questions, both of which genuinely change what the app does: **which test**
 * (which decides what a session is made of) and **when it is**, which is
 * optional and only ever used to state a pace. There is no name, no email, no
 * account and no third question; the whole record is two fields and a
 * completion stamp, which is what makes the "nothing leaves this phone" promise
 * on the first screen checkable rather than rhetorical.
 *
 * It lives in its own `localStorage` key, versioned and migrated on the pattern
 * `persistence.ts` set, because it has a different lifetime from the study
 * record: resetting progress must not un-set up the app, and a schema change to
 * the spaced-repetition ladder must not migrate the learner's test date.
 *
 * Pure and DOM-free. `loadSetup` takes a string, `probeStorage` takes a
 * `Storage`; neither reads a clock.
 */

export const SETUP_STORAGE_KEY = 'tn-drive:setup';

export const SETUP_SCHEMA_VERSION = 1;

/**
 * `signs` is the signs-refresher goal from mockup `01`: the sign registry only,
 * shorter sessions, no exam simulator.
 */
export type StudyGoal = 'class-d' | 'signs';

export const STUDY_GOALS: readonly StudyGoal[] = ['class-d', 'signs'];

export interface Setup {
  schemaVersion: number;
  goal: StudyGoal;
  /** ISO `YYYY-MM-DD`, or `null` — the date is genuinely optional. */
  testDate: string | null;
  /** Epoch ms the learner finished onboarding; `null` means first run. */
  completedAt: number | null;
}

export type SetupLoadStatus = 'empty' | 'ok' | 'migrated' | 'corrupt' | 'future';

export interface SetupLoadResult {
  status: SetupLoadStatus;
  /** Always usable. Empty when the stored payload could not be trusted. */
  state: Setup;
  detail?: string;
  fromVersion?: number;
  foundVersion?: number;
}

export function emptySetup(): Setup {
  return { schemaVersion: SETUP_SCHEMA_VERSION, goal: 'class-d', testDate: null, completedAt: null };
}

export function isSetupComplete(setup: Setup): boolean {
  return setup.completedAt !== null;
}

const isGoal = (value: unknown): value is StudyGoal =>
  typeof value === 'string' && STUDY_GOALS.includes(value as StudyGoal);

/** `YYYY-MM-DD` that is also a real calendar date. Anything else is `null`. */
export function normalizeTestDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return null;
  }
  return value;
}

export interface CompleteSetupInput {
  goal: StudyGoal;
  testDate: string | null;
  at: number;
}

export function completeSetup(setup: Setup, input: CompleteSetupInput): Setup {
  return {
    ...setup,
    goal: input.goal,
    testDate: normalizeTestDate(input.testDate),
    completedAt: input.at,
  };
}

/* -------------------------------------------------------------- migrations */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

function isSetup(value: unknown): value is Setup {
  return (
    isRecord(value) &&
    isGoal(value.goal) &&
    (value.testDate === null || normalizeTestDate(value.testDate) !== null) &&
    (value.completedAt === null || isNumber(value.completedAt))
  );
}

/**
 * Version 0 is any payload written before the record was versioned. It is
 * salvaged field by field rather than discarded: the worst case is a learner
 * re-answering two questions, and the best case is that they never notice.
 */
function migrateV0toV1(raw: unknown): Setup {
  const source = isRecord(raw) ? raw : {};
  return {
    schemaVersion: SETUP_SCHEMA_VERSION,
    goal: isGoal(source.goal) ? source.goal : 'class-d',
    testDate: normalizeTestDate(source.testDate),
    completedAt: isNumber(source.completedAt) ? source.completedAt : null,
  };
}

export function migrateSetup(persisted: unknown, fromVersion: number): Setup {
  if (fromVersion === SETUP_SCHEMA_VERSION) {
    if (!isSetup(persisted)) throw new Error('Stored setup has the wrong shape');
    return {
      schemaVersion: SETUP_SCHEMA_VERSION,
      goal: persisted.goal,
      testDate: persisted.testDate,
      completedAt: persisted.completedAt,
    };
  }
  if (fromVersion === 0) return migrateV0toV1(persisted);
  throw new Error(`Cannot migrate setup from schema version ${String(fromVersion)}`);
}

/* -------------------------------------------------------------- load / save */

export function serializeSetup(setup: Setup): string {
  return JSON.stringify({ state: setup, version: SETUP_SCHEMA_VERSION });
}

export function loadSetup(raw: string | null): SetupLoadResult {
  if (raw === null || raw === '') return { status: 'empty', state: emptySetup() };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: 'corrupt', state: emptySetup(), detail: 'The saved setup is not valid JSON.' };
  }

  if (!isRecord(parsed) || !isRecord(parsed.state)) {
    return { status: 'corrupt', state: emptySetup(), detail: 'The saved setup is missing its answers.' };
  }

  const version = isNumber(parsed.version) ? parsed.version : 0;
  if (version > SETUP_SCHEMA_VERSION) {
    return { status: 'future', state: emptySetup(), foundVersion: version };
  }

  try {
    const state = migrateSetup(parsed.state, version);
    return version === SETUP_SCHEMA_VERSION
      ? { status: 'ok', state }
      : { status: 'migrated', state, fromVersion: version };
  } catch (error) {
    return {
      status: 'corrupt',
      state: emptySetup(),
      detail: error instanceof Error ? error.message : 'The saved setup could not be read.',
    };
  }
}

/* --------------------------------------------------------------------- pace */

const MS_PER_DAY = 86_400_000;

/** Local midnight of the day `at` falls in — the learner's day, not UTC's. */
function startOfLocalDay(at: number): number {
  const date = new Date(at);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * Whole days from today to the test, counted in calendar days rather than
 * 24-hour blocks: a test tomorrow morning is one day away at 11pm tonight, not
 * zero. Negative once the date has passed; `null` when there is no date.
 */
export function daysUntilTest(testDate: string | null, now: number): number | null {
  const iso = normalizeTestDate(testDate);
  if (iso === null) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(y ?? 0, (m ?? 1) - 1, d ?? 1).getTime();
  return Math.round((target - startOfLocalDay(now)) / MS_PER_DAY);
}

/**
 * Questions a day to cover what is left before the test. Rounded **up**: a pace
 * that rounds down does not finish the bank, which is the one thing this number
 * exists to promise. `null` when there is no date, or when the date is today or
 * past — at that point a pace is not advice, and the app says something else.
 */
export function dailyPace(remainingQuestions: number, daysLeft: number | null): number | null {
  if (daysLeft === null || daysLeft <= 0) return null;
  if (remainingQuestions <= 0) return 0;
  return Math.ceil(remainingQuestions / daysLeft);
}

/* ------------------------------------------------------------ storage probe */

const PROBE_KEY = 'tn-drive:probe';

/**
 * Can this browser actually keep anything?
 *
 * `typeof localStorage !== 'undefined'` is not the question — Safari's private
 * mode exposes the object and throws on write, and some builds have accepted a
 * write and dropped it. So the probe writes, reads back, and compares. This is
 * what decides whether onboarding offers session-only mode (practices C5), and
 * it is re-runnable, which is what makes "Check storage again" honest.
 */
export function probeStorage(storage: Storage | null): boolean {
  if (!storage) return false;
  const token = `probe-${String(SETUP_SCHEMA_VERSION)}`;
  try {
    storage.setItem(PROBE_KEY, token);
    const seen = storage.getItem(PROBE_KEY);
    storage.removeItem(PROBE_KEY);
    return seen === token;
  } catch {
    return false;
  }
}
