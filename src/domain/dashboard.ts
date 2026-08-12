/**
 * Every number the dashboard says out loud.
 *
 * The rule this module exists to keep: **the dashboard invents nothing.**
 * Readiness is `overallAccuracy` — the same figure the progress surface
 * reports, not a second score with a friendlier curve. A topic is weak when
 * `session.ts` says it is weak, because that is the definition the adaptive
 * engine actually schedules against; a dashboard that disagreed with the queue
 * would be lying about what the app is doing next. Banding is `mastery.ts`.
 * What is left — a streak, a route to the test, the wording — is derived here
 * from the real attempt history and tested without a DOM.
 *
 * Content shapes are passed in as plain structures rather than imported, so the
 * whole module stays free of the question bank and testable in milliseconds.
 */
import { EXAM_PASS_MARK, EXAM_QUESTION_COUNT, EXAM_TIME_LIMIT_SECONDS, EXAM_WRONG_LIMIT } from './exam';
import { masteryBand, masteryPercent } from './mastery';
import type { MasteryBand } from './mastery';
import { overallAccuracy, topicStatOf } from './progress';
import type { StudyProgress } from './progress';
import { DEFAULT_SESSION_SIZE, isWeakTopic, rankTopicsByWeakness } from './session';

/**
 * The readiness a learner should clear before spending an hour on a mock exam.
 * The exam itself passes at 24/30 = 80%; the extra five points are the margin
 * between "would pass on a good day" and "will pass on the day", and the
 * dashboard never hides the exam behind it — it only withholds the
 * recommendation.
 */
export const EXAM_READY_THRESHOLD = 85;

/**
 * Mock exams passed that the app treats as enough practice. Five sittings at
 * the published 25/25/25/25 blueprint puts 150 questions in front of the
 * learner, every area repeatedly. It is the app's recommendation and is
 * presented as one — the State of Tennessee sets no such number.
 */
export const RECOMMENDED_MOCK_PASSES = 5;

/** One session's worth of evidence before a readiness figure is worth trusting. */
export const MIN_ANSWERS_FOR_READING = DEFAULT_SESSION_SIZE;

/** The streak strip shows a week, because a week is what a habit looks like. */
export const STREAK_WINDOW_DAYS = 7;

const MS_PER_DAY = 86_400_000;

/* ---------------------------------------------------------------- readiness */

export type ReadingConfidence = 'none' | 'provisional' | 'measured';

export interface Readiness {
  /** Whole-percent overall accuracy — `progress.overallAccuracy`, unchanged. */
  percent: number;
  band: MasteryBand;
  answered: number;
  correct: number;
  /**
   * How much evidence the figure stands on. Three right answers is not 100%
   * readiness, and the dashboard says which of the three it is rather than
   * quietly presenting a fluke as a verdict.
   */
  confidence: ReadingConfidence;
}

export function readiness(progress: StudyProgress): Readiness {
  let answered = 0;
  let correct = 0;
  for (const stat of Object.values(progress.topics)) {
    answered += stat.seen;
    correct += stat.correct;
  }
  const percent = overallAccuracy(progress);
  return {
    percent,
    band: masteryBand(percent),
    answered,
    correct,
    confidence:
      answered === 0 ? 'none' : answered < MIN_ANSWERS_FOR_READING ? 'provisional' : 'measured',
  };
}

/* -------------------------------------------------------------- weak topics */

export interface TopicRow {
  topic: string;
  seen: number;
  correct: number;
  percent: number;
  band: MasteryBand;
  /** Epoch ms of the last answer in this topic; `null` when never answered. */
  lastSeenAt: number | null;
  /** How many questions the bank holds on this topic. */
  questionCount: number;
}

function lastSeenByTopic(progress: StudyProgress): Map<string, number> {
  const seen = new Map<string, number>();
  for (const card of Object.values(progress.cards)) {
    const previous = seen.get(card.topic) ?? 0;
    if (card.lastSeenAt > previous) seen.set(card.topic, card.lastSeenAt);
  }
  return seen;
}

/**
 * The topics holding the learner back, weakest first — using `session.ts`'s own
 * `isWeakTopic`, so this list and the questions the next session queues can
 * never disagree.
 */
export function weakTopics(
  progress: StudyProgress,
  questionCounts: Readonly<Record<string, number>>,
  limit: number,
): TopicRow[] {
  const weak = Object.keys(progress.topics).filter((topic) => isWeakTopic(progress.topics[topic]));
  const lastSeen = lastSeenByTopic(progress);
  return rankTopicsByWeakness(progress.topics, weak)
    .slice(0, Math.max(0, limit))
    .map((topic) => {
      const stat = topicStatOf(progress, topic);
      const percent = masteryPercent(stat.correct, stat.seen);
      return {
        topic,
        seen: stat.seen,
        correct: stat.correct,
        percent,
        band: masteryBand(percent),
        lastSeenAt: lastSeen.get(topic) ?? null,
        questionCount: questionCounts[topic] ?? 0,
      };
    });
}

/** Blueprint order, as the manual publishes it (grounding §7). */
const AREA_ORDER: readonly string[] = ['signs', 'safe-driving', 'rules-of-road', 'alcohol-drugs'];

export interface StarterTopic {
  topic: string;
  area: string;
  questionCount: number;
}

/**
 * What the weak-topic list shows before anything has been measured: one topic
 * per blueprint area — a claim the manual itself supports, since the test draws
 * a quarter from each. The alternative ("these four trip up most people") is a
 * statistic this app does not have and would be inventing.
 */
export function starterTopics(
  topics: readonly { id: string; area: string }[],
  questionCounts: Readonly<Record<string, number>>,
): StarterTopic[] {
  const rows: StarterTopic[] = [];
  for (const area of AREA_ORDER) {
    const best = topics
      .filter((t) => t.area === area)
      .map((t) => ({ topic: t.id, area, questionCount: questionCounts[t.id] ?? 0 }))
      .sort((a, b) => (b.questionCount - a.questionCount) || (a.topic < b.topic ? -1 : 1))
      .at(0);
    if (best && best.questionCount > 0) rows.push(best);
  }
  return rows;
}

/* ------------------------------------------------------------ signs learned */

export interface SignProgress {
  learned: number;
  /** Signs the question bank can actually measure. See the note below. */
  coverable: number;
}

/**
 * A sign counts as learned once **every** question that shows it has been
 * answered correctly at least once.
 *
 * `coverable` is deliberately not the size of the sign registry: 55 of the 87
 * signs are referenced by a question, and a denominator the learner could never
 * reach would be a lie told by an honest-looking progress bar. The library
 * still teaches all 87 — the dashboard says which number this row is counting.
 */
export function signsLearned(
  questions: readonly { id: string; signs?: readonly string[] }[],
  cards: StudyProgress['cards'],
): SignProgress {
  const bySign = new Map<string, string[]>();
  for (const question of questions) {
    for (const sign of question.signs ?? []) {
      const bucket = bySign.get(sign);
      if (bucket) bucket.push(question.id);
      else bySign.set(sign, [question.id]);
    }
  }
  let learned = 0;
  for (const questionIds of bySign.values()) {
    if (questionIds.every((id) => (cards[id]?.correct ?? 0) > 0)) learned += 1;
  }
  return { learned, coverable: bySign.size };
}

/* ------------------------------------------------------- route to your test */

export interface RouteRow {
  id: 'questions' | 'signs' | 'exams';
  label: string;
  value: number;
  target: number;
}

export interface RouteInput {
  progress: StudyProgress;
  bankSize: number;
  signs: SignProgress;
  examsPassed: number;
}

const clamp = (value: number, max: number) => Math.min(Math.max(0, value), Math.max(0, max));

/** The three readings on the guide sign, each with a target the learner can hit. */
export function routeToTest({ progress, bankSize, signs, examsPassed }: RouteInput): RouteRow[] {
  return [
    {
      id: 'questions',
      label: 'Practice questions',
      value: clamp(Object.keys(progress.cards).length, bankSize),
      target: bankSize,
    },
    {
      id: 'signs',
      label: 'Road signs learned',
      value: clamp(signs.learned, signs.coverable),
      target: signs.coverable,
    },
    {
      id: 'exams',
      label: 'Mock exams passed',
      value: clamp(examsPassed, RECOMMENDED_MOCK_PASSES),
      target: RECOMMENDED_MOCK_PASSES,
    },
  ];
}

/* ------------------------------------------------------------------- streak */

export interface StreakDay {
  /** Local `YYYY-MM-DD`, so a day is the learner's day and not UTC's. */
  key: string;
  studied: boolean;
  isToday: boolean;
}

export interface Streak {
  current: number;
  longest: number;
  /** `true` when the run in progress is the best one yet — worth saying. */
  isBest: boolean;
  /** The last `STREAK_WINDOW_DAYS` days, oldest first, today last. */
  days: StreakDay[];
}

function dayKey(at: number): string {
  const date = new Date(at);
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function shiftDays(at: number, days: number): number {
  const date = new Date(at);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12).getTime();
}

/**
 * Days in a row with at least one answer.
 *
 * A day that has not been studied **yet** does not break the run: at 9am the
 * learner has not lost a six-day streak, and telling them they have is both
 * wrong and the fastest way to make them stop. The run therefore counts back
 * from today if today has an answer, and from yesterday if it does not.
 */
export function studyStreak(attempts: readonly { at: number }[], now: number): Streak {
  const studied = new Set(attempts.map((attempt) => dayKey(attempt.at)));

  const days: StreakDay[] = [];
  for (let back = STREAK_WINDOW_DAYS - 1; back >= 0; back -= 1) {
    const key = dayKey(shiftDays(now, -back));
    days.push({ key, studied: studied.has(key), isToday: back === 0 });
  }

  let current = 0;
  const startBack = studied.has(dayKey(now)) ? 0 : 1;
  for (let back = startBack; ; back += 1) {
    if (!studied.has(dayKey(shiftDays(now, -back)))) break;
    current += 1;
  }

  // Longest run anywhere in the history the record still holds.
  const sorted = [...studied].sort();
  let longest = 0;
  let run = 0;
  let previous: string | null = null;
  for (const key of sorted) {
    const [y, m, d] = key.split('-').map(Number);
    const at = new Date(y ?? 0, (m ?? 1) - 1, d ?? 1, 12).getTime();
    run = previous !== null && dayKey(shiftDays(at, -1)) === previous ? run + 1 : 1;
    if (run > longest) longest = run;
    previous = key;
  }

  return { current, longest, isBest: current > 0 && current >= longest, days };
}

/* ------------------------------------------------------------------ wording */

/** "today" · "yesterday" · "4 days ago". Never a raw timestamp. */
export function relativeDay(then: number | null, now: number): string {
  if (then === null) return 'not yet seen';
  const days = Math.round((startOfDay(now) - startOfDay(then)) / MS_PER_DAY);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${String(days)} days ago`;
}

function startOfDay(at: number): number {
  const date = new Date(at);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Half a minute a question — the measured pace of the study session. */
export function estimatedMinutes(questions: number): number {
  if (questions <= 0) return 0;
  return Math.max(1, Math.round(questions / 2));
}

export interface Headline {
  eyebrow: string;
  heading: string;
  sub: string;
}

function holdingBack(weakCount: number): string {
  if (weakCount === 0) return 'Nothing is holding you back right now.';
  if (weakCount === 1) return '1 topic is still holding you back.';
  return `${String(weakCount)} topics are still holding you back.`;
}

/** Where the learner actually is, in one line each. No cheerleading. */
export function dashboardHeadline(reading: Readiness, weakCount: number): Headline {
  const eyebrow = 'Class D knowledge test';
  if (reading.confidence === 'none') {
    return {
      eyebrow,
      heading: 'Start your first mile',
      sub: `${String(MIN_ANSWERS_FOR_READING)} questions is all it takes to read your level.`,
    };
  }
  if (reading.confidence === 'provisional') {
    const left = MIN_ANSWERS_FOR_READING - reading.answered;
    return {
      eyebrow,
      heading: 'Taking your first reading',
      sub: `Measured on ${String(reading.answered)} ${reading.answered === 1 ? 'answer' : 'answers'} so far — ${String(left)} more and this figure means something.`,
    };
  }
  if (reading.percent >= EXAM_READY_THRESHOLD) {
    return { eyebrow, heading: "You're test ready", sub: holdingBack(weakCount) };
  }
  if (reading.percent >= 80) {
    return { eyebrow, heading: "You're nearly there", sub: holdingBack(weakCount) };
  }
  if (reading.percent >= 50) {
    return { eyebrow, heading: 'Coming together', sub: holdingBack(weakCount) };
  }
  return { eyebrow, heading: 'Plenty of road left', sub: holdingBack(weakCount) };
}

/* -------------------------------------------------------------- topic drill */

/**
 * The line-up behind a weak-topic row: the questions in that topic the learner
 * has the most to gain from, worst first — missed cards (lowest box, most
 * lapses) ahead of unseen ones, and everything else behind both. The row is a
 * promise about what pressing it does, so the order is decided here and tested,
 * not left to the order the bank happens to be authored in.
 */
export function topicDrillIds(
  questions: readonly { id: string; topic: string }[],
  cards: StudyProgress['cards'],
  topic: string,
  size: number,
): string[] {
  const rank = (id: string): number => {
    const card = cards[id];
    if (!card) return 1; // unseen: worth asking, but a known miss is worth more
    return card.correct < card.seen ? 0 : 2;
  };
  return questions
    .filter((question) => question.topic === topic)
    .map((question) => ({
      id: question.id,
      rank: rank(question.id),
      box: cards[question.id]?.box ?? 0,
      lapses: cards[question.id]?.lapses ?? 0,
    }))
    .sort(
      (a, b) =>
        a.rank - b.rank || a.box - b.box || b.lapses - a.lapses || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    )
    .slice(0, Math.max(0, size))
    .map((entry) => entry.id);
}

/* ------------------------------------------------------- exam recommendation */

export interface ExamRecommendation {
  recommended: boolean;
  threshold: number;
  eyebrow: string;
  body: string;
}

const EXAM_MINUTES = Math.round(EXAM_TIME_LIMIT_SECONDS / 60);

/**
 * The mock exam is never locked — an adult may sit a practice test whenever
 * they like — but the app says plainly whether it thinks the hour is well
 * spent yet, and why.
 */
export function examRecommendation(readinessPercent: number, passes: number): ExamRecommendation {
  const recommended = readinessPercent >= EXAM_READY_THRESHOLD;
  const rules = `${String(EXAM_QUESTION_COUNT)} questions, ${String(EXAM_MINUTES)} minutes, ${String(EXAM_PASS_MARK)} to pass. ${String(EXAM_WRONG_LIMIT)} wrong ends it early — same as the real one.`;
  if (passes >= RECOMMENDED_MOCK_PASSES) {
    return {
      recommended,
      threshold: EXAM_READY_THRESHOLD,
      eyebrow: 'Recommended now',
      body: `${rules} You have passed ${String(passes)} already — sit another whenever you want the rehearsal.`,
    };
  }
  return {
    recommended,
    threshold: EXAM_READY_THRESHOLD,
    eyebrow: recommended ? 'Recommended now' : 'Not yet recommended',
    body: recommended
      ? `${rules} You are over ${String(EXAM_READY_THRESHOLD)}% readiness, so this is the right time to rehearse the real thing.`
      : `${rules} Reach ${String(EXAM_READY_THRESHOLD)}% readiness first and you will pass on the first try.`,
  };
}
