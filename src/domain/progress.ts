/**
 * The learner's study record: one card per question, one rollup per topic, and
 * a bounded attempt history.
 *
 * Two kinds of memory on purpose. The **rollups** (`cards`, `topics`) are what
 * the adaptive engine reads, and they are aggregates — they survive forever and
 * cost a fixed number of bytes per question. The **attempt log** is the
 * narrative the progress screen tells, and it is capped at 200 entries
 * (grounding §6) so a diligent learner cannot walk into the ~5MB
 * `localStorage` ceiling. Pruning the log therefore never damages the numbers:
 * that separation is the whole reason both exist.
 *
 * Pure and DOM-free. Every function returns a new state; nothing here reads a
 * clock or touches storage.
 */
import { newCard, reviewCard } from './scheduler';
import type { CardState } from './scheduler';
import type { TopicStat } from './session';

/** grounding §6 / practices C4. */
export const ATTEMPT_HISTORY_LIMIT = 200;

export const CURRENT_SCHEMA_VERSION = 1;

export interface Attempt {
  questionId: string;
  topic: string;
  area: string;
  /** Index into the question's options, so a review screen can replay it. */
  chosenIndex: number;
  correct: boolean;
  at: number;
}

export interface StudyProgress {
  schemaVersion: number;
  cards: Record<string, CardState>;
  topics: Record<string, TopicStat>;
  /** Oldest first, newest last. Never longer than `ATTEMPT_HISTORY_LIMIT`. */
  attempts: Attempt[];
  sessionsCompleted: number;
  lastStudiedAt: number | null;
}

export interface AttemptInput {
  questionId: string;
  topic: string;
  area: string;
  chosenIndex: number;
  correct: boolean;
  at: number;
}

export interface RecordedAttempt {
  state: StudyProgress;
  /** The card before the answer — so the UI can describe the promotion. */
  before: CardState;
  after: CardState;
}

export function emptyProgress(): StudyProgress {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    cards: {},
    topics: {},
    attempts: [],
    sessionsCompleted: 0,
    lastStudiedAt: null,
  };
}

export function topicStatOf(state: StudyProgress, topic: string): TopicStat {
  return state.topics[topic] ?? { seen: 0, correct: 0 };
}

export function recordAttempt(state: StudyProgress, input: AttemptInput): RecordedAttempt {
  const before = state.cards[input.questionId] ?? newCard(input.questionId, input.topic, input.at);
  const after = reviewCard(before, input.correct, input.at);
  const stat = topicStatOf(state, input.topic);

  const attempts = [
    ...state.attempts,
    {
      questionId: input.questionId,
      topic: input.topic,
      area: input.area,
      chosenIndex: input.chosenIndex,
      correct: input.correct,
      at: input.at,
    },
  ];

  return {
    before,
    after,
    state: {
      ...state,
      cards: { ...state.cards, [input.questionId]: after },
      topics: {
        ...state.topics,
        [input.topic]: {
          seen: stat.seen + 1,
          correct: stat.correct + (input.correct ? 1 : 0),
        },
      },
      attempts: boundAttempts(attempts),
      lastStudiedAt: input.at,
    },
  };
}

/** Keeps the newest `ATTEMPT_HISTORY_LIMIT`; also used defensively on load. */
export function boundAttempts(attempts: readonly Attempt[]): Attempt[] {
  return attempts.length <= ATTEMPT_HISTORY_LIMIT
    ? [...attempts]
    : attempts.slice(attempts.length - ATTEMPT_HISTORY_LIMIT);
}

export function completeSession(state: StudyProgress, at: number): StudyProgress {
  return { ...state, sessionsCompleted: state.sessionsCompleted + 1, lastStudiedAt: at };
}

/** Whole-percent accuracy across every topic. 0, never NaN, with no history. */
export function overallAccuracy(state: StudyProgress): number {
  let seen = 0;
  let correct = 0;
  for (const stat of Object.values(state.topics)) {
    seen += stat.seen;
    correct += stat.correct;
  }
  return seen === 0 ? 0 : Math.round((correct / seen) * 100);
}
