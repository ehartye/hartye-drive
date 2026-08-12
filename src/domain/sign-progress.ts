/**
 * Per-sign mastery: the stored record, its envelope and its migrations.
 *
 * A sign is a card like any other, so the ladder that schedules questions
 * schedules signs too — `CardState` from `./scheduler`, keyed by registry id,
 * with the sign's MUTCD category standing in for the topic. There is exactly
 * one spaced-repetition policy in this product, and the sign trainer does not
 * get a second one.
 *
 * It is a **separate `localStorage` key** from the study record and the exam
 * record, on the convention P4 set and P5 followed: different shapes, different
 * lifetimes, and no reason a change to the sign trainer should force a
 * migration of a learner's question ladder.
 *
 * Bounded by construction: the registry is 87 signs, so `cards` cannot grow
 * past 87 entries however long a learner studies. There is no attempt log here
 * for the same reason — the ladder is the history.
 *
 * Pure and DOM-free: `loadSignRecord` takes a string, not a `Storage`.
 */
import { GRADUATED_BOX, compareByDue, isGraduated, newCard, reviewCard } from './scheduler';
import type { CardState } from './scheduler';
import type { TopicStat } from './session';

export const SIGN_STORAGE_KEY = 'tn-drive:signs';

export const SIGN_RECORD_VERSION = 1;

export interface SignRecord {
  schemaVersion: number;
  /** Keyed by registry id. `questionId` on the card holds that same id. */
  cards: Record<string, CardState>;
  /** Keyed by MUTCD category, so the drill can target the weakest ground. */
  categories: Record<string, TopicStat>;
  drillsCompleted: number;
  lastDrilledAt: number | null;
}

export function emptySignRecord(): SignRecord {
  return {
    schemaVersion: SIGN_RECORD_VERSION,
    cards: {},
    categories: {},
    drillsCompleted: 0,
    lastDrilledAt: null,
  };
}

/* ---------------------------------------------------------------- recording */

export interface SignAnswerInput {
  signId: string;
  category: string;
  correct: boolean;
  at: number;
}

export interface RecordedSignAnswer {
  state: SignRecord;
  /** The card before the answer, so the UI can say what changed. */
  before: CardState;
  after: CardState;
}

/** One answered sign. Returns both sides of the review, like `recordAttempt`. */
export function recordSignAnswer(record: SignRecord, input: SignAnswerInput): RecordedSignAnswer {
  const before = record.cards[input.signId] ?? newCard(input.signId, input.category, input.at);
  const after = reviewCard(before, input.correct, input.at);
  const stat = record.categories[input.category] ?? { seen: 0, correct: 0 };

  return {
    before,
    after,
    state: {
      ...record,
      cards: { ...record.cards, [input.signId]: after },
      categories: {
        ...record.categories,
        [input.category]: {
          seen: stat.seen + 1,
          correct: stat.correct + (input.correct ? 1 : 0),
        },
      },
      lastDrilledAt: input.at,
    },
  };
}

export function completeDrill(record: SignRecord, at: number): SignRecord {
  return { ...record, drillsCompleted: record.drillsCompleted + 1, lastDrilledAt: at };
}

/* ------------------------------------------------------------------ mastery */

/**
 * Three tiers, because the library card has room for three and a learner needs
 * to know only three things about a sign: I have it, I am shaky on it, I have
 * never met it. `solid` is the scheduler's own graduation point, so the library
 * and the drill cannot disagree about what "known" means.
 */
export type MasteryTier = 'solid' | 'review' | 'new';

export function masteryTier(card: CardState | undefined): MasteryTier {
  if (!card || card.seen === 0) return 'new';
  return isGraduated(card) ? 'solid' : 'review';
}

/** Lit pips, 0–3. The box IS the reading; three is graduation. */
export function masteryPips(card: CardState | undefined): number {
  if (!card || card.seen === 0) return 0;
  return Math.min(GRADUATED_BOX, card.box);
}

/** The word that travels with the colour — never colour alone (practices A2). */
export function tierLabel(tier: MasteryTier): string {
  switch (tier) {
    case 'solid':
      return 'Solid';
    case 'review':
      return 'Review';
    case 'new':
      return 'New';
  }
}

export interface SignMasterySummary {
  total: number;
  solid: number;
  review: number;
  unseen: number;
  /** Whole percent of the registry that is solid. Zero, never NaN. */
  percentSolid: number;
}

export function summariseSignMastery(
  cards: Record<string, CardState>,
  signIds: readonly string[],
): SignMasterySummary {
  let solid = 0;
  let review = 0;
  for (const id of signIds) {
    const tier = masteryTier(cards[id]);
    if (tier === 'solid') solid += 1;
    else if (tier === 'review') review += 1;
  }
  const total = signIds.length;
  return {
    total,
    solid,
    review,
    unseen: total - solid - review,
    percentSolid: total === 0 ? 0 : Math.round((solid / total) * 100),
  };
}

/**
 * Signs the learner has met and not mastered — what "drill the ones you're
 * shaky on" actually means. Ordered by the scheduler's own comparator, so the
 * most overdue and weakest come first and the order survives a reload.
 */
export function shakySignIds(
  cards: Record<string, CardState>,
  signIds: readonly string[],
): string[] {
  const known = new Set(signIds);
  return Object.values(cards)
    .filter(
      (card) => known.has(card.questionId) && card.seen > 0 && masteryTier(card) === 'review',
    )
    .sort(compareByDue)
    .map((card) => card.questionId);
}

/* ------------------------------------------------------------ shape guards */

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

function isSignRecordState(value: unknown): value is SignRecord {
  if (!isRecord(value)) return false;
  if (!isRecord(value.cards) || !Object.values(value.cards).every(isCard)) return false;
  if (!isRecord(value.categories) || !Object.values(value.categories).every(isTopicStat)) {
    return false;
  }
  if (!isNumber(value.drillsCompleted)) return false;
  if (value.lastDrilledAt !== null && !isNumber(value.lastDrilledAt)) return false;
  return true;
}

/* -------------------------------------------------------------- migrations */

/**
 * Version 0 is any payload written before the sign record was versioned. It is
 * salvaged rather than discarded — an unreadable card is dropped and the rest
 * of the learner's ladder is kept.
 */
function migrateV0toV1(raw: unknown): SignRecord {
  const source = isRecord(raw) ? raw : {};

  const cards: Record<string, CardState> = {};
  if (isRecord(source.cards)) {
    for (const [id, value] of Object.entries(source.cards)) {
      if (isCard(value)) cards[id] = value;
    }
  }

  const categories: Record<string, TopicStat> = {};
  if (isRecord(source.categories)) {
    for (const [id, value] of Object.entries(source.categories)) {
      if (isTopicStat(value)) categories[id] = { seen: value.seen, correct: value.correct };
    }
  }

  const lastTouch = Math.max(0, ...Object.values(cards).map((card) => card.lastSeenAt));

  return {
    schemaVersion: SIGN_RECORD_VERSION,
    cards,
    categories,
    drillsCompleted: isNumber(source.drillsCompleted) ? source.drillsCompleted : 0,
    lastDrilledAt: isNumber(source.lastDrilledAt)
      ? source.lastDrilledAt
      : lastTouch > 0
        ? lastTouch
        : null,
  };
}

export function migrateSignRecord(persisted: unknown, fromVersion: number): SignRecord {
  if (fromVersion === SIGN_RECORD_VERSION) {
    if (!isSignRecordState(persisted)) throw new Error('Stored sign record has the wrong shape');
    return { ...persisted, schemaVersion: SIGN_RECORD_VERSION };
  }
  if (fromVersion === 0) return migrateV0toV1(persisted);
  throw new Error(`Cannot migrate sign record from schema version ${String(fromVersion)}`);
}

/* -------------------------------------------------------------- load / save */

export type SignLoadStatus = 'empty' | 'ok' | 'migrated' | 'corrupt' | 'future';

export interface SignLoadResult {
  status: SignLoadStatus;
  /** Always usable. Empty when the stored payload could not be trusted. */
  state: SignRecord;
  detail?: string;
  fromVersion?: number;
  foundVersion?: number;
}

export function serializeSignRecord(record: SignRecord): string {
  return JSON.stringify({ state: record, version: SIGN_RECORD_VERSION });
}

export function loadSignRecord(raw: string | null): SignLoadResult {
  if (raw === null || raw === '') return { status: 'empty', state: emptySignRecord() };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      status: 'corrupt',
      state: emptySignRecord(),
      detail: 'The saved sign record is not valid JSON.',
    };
  }

  if (!isRecord(parsed) || !isRecord(parsed.state)) {
    return {
      status: 'corrupt',
      state: emptySignRecord(),
      detail: 'The saved sign record is missing its cards.',
    };
  }

  const version = isNumber(parsed.version) ? parsed.version : 0;
  if (version > SIGN_RECORD_VERSION) {
    return { status: 'future', state: emptySignRecord(), foundVersion: version };
  }

  try {
    const state = migrateSignRecord(parsed.state, version);
    return version === SIGN_RECORD_VERSION
      ? { status: 'ok', state }
      : { status: 'migrated', state, fromVersion: version };
  } catch (error) {
    return {
      status: 'corrupt',
      state: emptySignRecord(),
      detail: error instanceof Error ? error.message : 'The saved sign record could not be read.',
    };
  }
}
