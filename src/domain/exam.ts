/**
 * The exam engine — a faithful simulation of the Tennessee Class D knowledge
 * test, as a pure module with no DOM anywhere in it.
 *
 * Four rules come from the state, not from this app's taste, and every one of
 * them is load-bearing:
 *
 *  1. **30 questions.**
 *  2. **24 correct to pass.**
 *  3. **60 minutes**, on the wall clock — a backgrounded tab buys no time.
 *  4. **Seven wrong ends the attempt.** This is the rule builds omit, and it is
 *     not arbitrary: 30 − 7 = 23, and 23 < 24, so the seventh miss is the exact
 *     moment passing stops being arithmetically possible. The Driver Services
 *     Center stops there for that reason, and so does this.
 *
 * A consequence worth stating out loud, because it shapes every screen
 * downstream: a sitting that reaches all 30 questions can only **pass** or be
 * **halted** — six wrong or fewer out of thirty *is* 24 correct. "Fell short"
 * is therefore reachable only by running out of time or walking out, which is
 * exactly what the real test does to you.
 *
 * Sampling honours the blueprint the manual publishes (PDF p.35): traffic signs
 * and signals 25%, safe driving principles 25%, rules of the road 25%, drugs
 * and alcohol 25%. Never by page count — the bank holds nearly three times as
 * many rules-of-road questions as alcohol-and-drugs ones, and sampling by
 * availability would quietly misrepresent the test.
 */
import { masteryBand, masteryPercent } from './mastery';
import { makeRandom, shuffled } from './random';

/* ----------------------------------------------------------- the constants */

export const EXAM_QUESTION_COUNT = 30;
export const EXAM_PASS_MARK = 24;
export const EXAM_WRONG_LIMIT = 7;
export const EXAM_TIME_LIMIT_SECONDS = 60 * 60;

/** The best score still reachable once the wrong limit is hit. It is 23. */
export const REACHABLE_AFTER_WRONG_LIMIT = EXAM_QUESTION_COUNT - EXAM_WRONG_LIMIT;

/** No blueprint area may take more than this many questions in a row. */
const MAX_AREA_RUN = 3;

/* --------------------------------------------------------------- the types */

/** One of the four published areas, with the share the manual gives it. */
export interface ExamArea {
  id: string;
  /** 0.25 apiece, per the manual. Kept as data so the source stays traceable. */
  share: number;
}

export interface ExamCandidate {
  id: string;
  topic: string;
  area: string;
}

export interface ExamQuestionRef {
  questionId: string;
  topic: string;
  area: string;
}

export interface ExamAnswer {
  questionId: string;
  topic: string;
  area: string;
  /** Index into the question's options, so the review can replay the pick. */
  chosenIndex: number;
  correct: boolean;
  at: number;
}

export type ExamEndReason = 'completed' | 'strikes' | 'timeout' | 'ended-early';

export interface ExamState {
  id: string;
  seed: number;
  startedAt: number;
  /** Absolute. The clock is the wall clock, not a count of ticks. */
  deadlineAt: number;
  questions: ExamQuestionRef[];
  /** In the order they were asked. There is no going back. */
  answers: ExamAnswer[];
  endedAt: number | null;
  endReason: ExamEndReason | null;
}

export type ExamVerdict = 'pass' | 'short' | 'halted';

export interface ExamAreaScore {
  area: string;
  asked: number;
  correct: number;
}

export interface ExamReport {
  verdict: ExamVerdict;
  endReason: ExamEndReason | 'in-progress';
  correct: number;
  wrong: number;
  answered: number;
  /** Always the full paper — 30 — even when the attempt stopped early. */
  outOf: number;
  unasked: number;
  passMark: number;
  wrongLimit: number;
  elapsedSeconds: number;
  /** In the manual's own order, one entry per published area. */
  byArea: ExamAreaScore[];
  missedQuestionIds: string[];
  /** Areas under the 80% guide band, worst first. Drives what to do next. */
  weakestAreas: string[];
}

/* ---------------------------------------------------------- the blueprint */

/**
 * Largest-remainder allocation of `size` questions across the published areas.
 *
 * 30 does not divide by four, so two areas take an eighth question. Which two
 * **rotates**, so across attempts every area converges on its published quarter
 * rather than one area permanently drawing the long straw.
 */
export function allocateExamSlots(
  areas: readonly ExamArea[],
  size: number,
  rotation: number,
): Map<string, number> {
  const out = new Map<string, number>();
  if (size <= 0 || areas.length === 0) return out;

  const count = areas.length;
  const offset = ((Math.trunc(rotation) % count) + count) % count;

  const shares = areas.map((area, index) => {
    const ideal = size * area.share;
    const base = Math.floor(ideal);
    return {
      id: area.id,
      take: base,
      remainder: ideal - base,
      /** Rotated position: whoever sits first this time takes the leftover. */
      order: (index - offset + count) % count,
    };
  });

  let assigned = shares.reduce((sum, share) => sum + share.take, 0);
  const queue = [...shares].sort((a, b) =>
    Math.abs(a.remainder - b.remainder) > 1e-9 ? b.remainder - a.remainder : a.order - b.order,
  );
  for (const share of queue) {
    if (assigned >= size) break;
    share.take += 1;
    assigned += 1;
  }

  for (const share of shares) out.set(share.id, share.take);
  return out;
}

/* ----------------------------------------------------------- the sampling */

interface AreaBucket {
  id: string;
  items: ExamCandidate[];
}

/**
 * Round-robins an area's topics, so eight signs questions come from eight
 * different corners of the signs chapter rather than eight from one.
 */
function makeDrawer(pools: ExamCandidate[][]): () => ExamCandidate | undefined {
  let cursor = 0;
  return () => {
    for (let step = 0; step < pools.length; step += 1) {
      const index = (cursor + step) % pools.length;
      const pool = pools[index];
      if (pool && pool.length > 0) {
        cursor = (index + 1) % pools.length;
        return pool.pop();
      }
    }
    return undefined;
  };
}

/**
 * Take from whichever area has the most left, ties broken by the seeded draw
 * and never more than three of an area in a row. The learner sits an
 * interleaved paper, exactly as a 25/25/25/25 sample produces.
 */
function interleave(buckets: readonly AreaBucket[], random: () => number): ExamQuestionRef[] {
  const out: ExamQuestionRef[] = [];
  let lastArea = '';
  let run = 0;

  for (;;) {
    let best: AreaBucket | undefined;
    let bestScore = -Infinity;
    for (const bucket of buckets) {
      if (bucket.items.length === 0) continue;
      // The jitter is smaller than one question, so "most remaining" always
      // wins and the jitter only settles ties.
      const penalty = bucket.id === lastArea && run >= MAX_AREA_RUN ? 1000 : 0;
      const score = bucket.items.length - penalty + random() * 0.5;
      if (score > bestScore) {
        bestScore = score;
        best = bucket;
      }
    }
    if (!best) return out;

    const next = best.items.shift();
    if (!next) return out;
    out.push({ questionId: next.id, topic: next.topic, area: next.area });
    run = best.id === lastArea ? run + 1 : 1;
    lastArea = best.id;
  }
}

export interface SampleExamInput {
  candidates: readonly ExamCandidate[];
  areas: readonly ExamArea[];
  seed: number;
  size?: number;
}

/** The paper: `size` questions drawn to the published blueprint proportions. */
export function sampleExamQuestions(input: SampleExamInput): ExamQuestionRef[] {
  const { candidates, areas, seed } = input;
  const size = input.size ?? EXAM_QUESTION_COUNT;
  if (size <= 0 || areas.length === 0) return [];

  const random = makeRandom(seed);
  const rotation = Math.abs(Math.trunc(seed));
  const quota = allocateExamSlots(areas, size, rotation);

  const byArea = new Map<string, Map<string, ExamCandidate[]>>();
  for (const candidate of candidates) {
    let topics = byArea.get(candidate.area);
    if (!topics) {
      topics = new Map<string, ExamCandidate[]>();
      byArea.set(candidate.area, topics);
    }
    const pool = topics.get(candidate.topic);
    if (pool) pool.push(candidate);
    else topics.set(candidate.topic, [candidate]);
  }

  const drawers = new Map<string, () => ExamCandidate | undefined>();
  for (const area of areas) {
    const topics = byArea.get(area.id) ?? new Map<string, ExamCandidate[]>();
    const pools = shuffled([...topics.values()], random).map((items) => shuffled(items, random));
    drawers.set(area.id, makeDrawer(pools));
  }

  const buckets: AreaBucket[] = areas.map((area) => ({ id: area.id, items: [] }));
  let total = 0;
  for (const bucket of buckets) {
    const draw = drawers.get(bucket.id);
    const want = quota.get(bucket.id) ?? 0;
    while (draw && bucket.items.length < want) {
      const next = draw();
      if (!next) break;
      bucket.items.push(next);
      total += 1;
    }
  }

  /* An area with fewer questions than its quota hands the slots back rather
     than shortening the paper — a 30-question exam stays 30 questions. */
  let progressed = true;
  while (total < size && progressed) {
    progressed = false;
    for (const bucket of buckets) {
      if (total >= size) break;
      const next = drawers.get(bucket.id)?.();
      if (!next) continue;
      bucket.items.push(next);
      total += 1;
      progressed = true;
    }
  }

  return interleave(buckets, random);
}

/* --------------------------------------------------------- the state machine */

export interface StartExamInput {
  /** Supplied by the caller, so this module never has to read a clock or a UUID. */
  id: string;
  candidates: readonly ExamCandidate[];
  areas: readonly ExamArea[];
  seed: number;
  now: number;
  size?: number;
}

export function startExam(input: StartExamInput): ExamState {
  const size = input.size ?? EXAM_QUESTION_COUNT;
  return {
    id: input.id,
    seed: input.seed,
    startedAt: input.now,
    deadlineAt: input.now + EXAM_TIME_LIMIT_SECONDS * 1000,
    questions: sampleExamQuestions({
      candidates: input.candidates,
      areas: input.areas,
      seed: input.seed,
      size,
    }),
    answers: [],
    endedAt: null,
    endReason: null,
  };
}

export function examStrikes(state: ExamState): number {
  return state.answers.reduce((n, answer) => n + (answer.correct ? 0 : 1), 0);
}

export function examCorrect(state: ExamState): number {
  return state.answers.reduce((n, answer) => n + (answer.correct ? 1 : 0), 0);
}

/** The question on screen, or `undefined` once the attempt is over. */
export function currentQuestion(state: ExamState): ExamQuestionRef | undefined {
  if (state.endReason !== null) return undefined;
  return state.questions[state.answers.length];
}

export function examAnswerFor(state: ExamState, questionId: string): ExamAnswer | undefined {
  return state.answers.find((answer) => answer.questionId === questionId);
}

/** Seconds left on the wall clock; frozen at whatever was left when it ended. */
export function secondsRemaining(state: ExamState, now: number): number {
  const at = state.endedAt ?? now;
  const left = Math.floor((state.deadlineAt - at) / 1000);
  return Math.min(EXAM_TIME_LIMIT_SECONDS, Math.max(0, left));
}

export function isExamRunning(state: ExamState, now: number): boolean {
  return state.endReason === null && now < state.deadlineAt;
}

/** The hour is up. Scores whatever was answered — nothing is thrown away. */
export function expireExam(state: ExamState, at: number): ExamState {
  if (state.endReason !== null) return state;
  if (at < state.deadlineAt) return state;
  return { ...state, endedAt: state.deadlineAt, endReason: 'timeout' };
}

/** The learner walked out. Scores what they answered and closes the attempt. */
export function endExamEarly(state: ExamState, at: number): ExamState {
  if (state.endReason !== null) return state;
  return { ...state, endedAt: at, endReason: 'ended-early' };
}

export interface ExamChoice {
  chosenIndex: number;
  correct: boolean;
  at: number;
}

/**
 * Answers the current question. Final: there is no going back, no changing it,
 * and no verdict until the attempt is over.
 */
export function answerExamQuestion(state: ExamState, choice: ExamChoice): ExamState {
  if (state.endReason !== null) return state;
  if (choice.at >= state.deadlineAt) return expireExam(state, choice.at);

  const question = currentQuestion(state);
  if (!question) return state;

  const answers = [
    ...state.answers,
    {
      questionId: question.questionId,
      topic: question.topic,
      area: question.area,
      chosenIndex: choice.chosenIndex,
      correct: choice.correct,
      at: choice.at,
    },
  ];

  const wrong = answers.reduce((n, answer) => n + (answer.correct ? 0 : 1), 0);
  // The seventh miss: 30 − 7 = 23 < 24, so the attempt cannot be passed and
  // the real test stops here.
  if (wrong >= EXAM_WRONG_LIMIT) return { ...state, answers, endedAt: choice.at, endReason: 'strikes' };
  if (answers.length >= state.questions.length)
    return { ...state, answers, endedAt: choice.at, endReason: 'completed' };
  return { ...state, answers };
}

/* ------------------------------------------------------------- the verdict */

export function examVerdict(correct: number, wrong: number): ExamVerdict {
  // Order matters: the wrong limit outranks the pass mark, because reaching it
  // is precisely the statement that the pass mark can no longer be reached.
  if (wrong >= EXAM_WRONG_LIMIT) return 'halted';
  if (correct >= EXAM_PASS_MARK) return 'pass';
  return 'short';
}

export function scoreExam(state: ExamState, areas: readonly ExamArea[]): ExamReport {
  const answered = state.answers.length;
  const correct = examCorrect(state);
  const wrong = answered - correct;
  const outOf = state.questions.length;

  const byArea: ExamAreaScore[] = areas.map((area) => {
    const asked = state.answers.filter((answer) => answer.area === area.id);
    return {
      area: area.id,
      asked: asked.length,
      correct: asked.reduce((n, answer) => n + (answer.correct ? 1 : 0), 0),
    };
  });

  const lastAt = state.answers.at(-1)?.at ?? state.startedAt;
  const elapsedMs = (state.endedAt ?? lastAt) - state.startedAt;

  const weakestAreas = byArea
    .filter((score) => score.asked > 0)
    .map((score) => ({ score, percent: masteryPercent(score.correct, score.asked) }))
    .filter((entry) => masteryBand(entry.percent) !== 'guide')
    .sort((a, b) => (a.percent !== b.percent ? a.percent - b.percent : b.score.asked - a.score.asked))
    .map((entry) => entry.score.area);

  return {
    verdict: examVerdict(correct, wrong),
    endReason: state.endReason ?? 'in-progress',
    correct,
    wrong,
    answered,
    outOf,
    unasked: Math.max(0, outOf - answered),
    passMark: EXAM_PASS_MARK,
    wrongLimit: EXAM_WRONG_LIMIT,
    elapsedSeconds: Math.max(0, Math.round(elapsedMs / 1000)),
    byArea,
    missedQuestionIds: state.answers.filter((a) => !a.correct).map((a) => a.questionId),
    weakestAreas,
  };
}

/* --------------------------------------------------------------- the words */

const NUMBER_WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
];

/** Small numbers read better as words; large ones read better as figures. */
export function numberWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/** The `<h1>` of the score report. */
export function examHeadline(report: ExamReport): string {
  if (report.verdict === 'pass') return 'You passed';
  if (report.verdict === 'halted') return `Stopped at question ${String(report.answered)}`;
  const shortfall = Math.max(0, report.passMark - report.correct);
  return `${capitalize(numberWord(shortfall))} short`;
}

/** The paragraph under the verdict sign — the rule, stated as a fact. */
export function describeExamOutcome(report: ExamReport): string {
  if (report.verdict === 'pass') {
    const margin = report.correct - report.passMark;
    return margin === 0
      ? `Tennessee asks ${String(report.outOf)} questions and requires ${String(report.passMark)} correct. You cleared it exactly.`
      : `Tennessee asks ${String(report.outOf)} questions and requires ${String(report.passMark)} correct. You cleared it by ${numberWord(margin)}.`;
  }

  if (report.verdict === 'halted') {
    return (
      `Tennessee asks ${String(report.outOf)} questions and requires ${String(report.passMark)} correct. ` +
      `Once ${numberWord(report.wrongLimit)} answers are wrong, ${String(report.passMark)} is no longer reachable — ` +
      `${String(report.outOf)} minus ${String(report.wrongLimit)} leaves ${String(REACHABLE_AFTER_WRONG_LIMIT)} — so the test ends on the ` +
      `${numberWord(report.wrongLimit)}th miss. The real one at a Driver Services Center stops at the same point, for the same reason. ` +
      `${capitalize(numberWord(report.unasked))} of your ${String(report.outOf)} questions were never asked.`
    );
  }

  const head = `Tennessee requires ${String(report.passMark)} of ${String(report.outOf)}.`;
  const tail =
    `, with ${numberWord(report.unasked)} never asked — unanswered questions count against you, ` +
    'exactly as they do at a Driver Services Center.';

  if (report.endReason === 'timeout') {
    return `${head} You had ${String(report.correct)} correct when the hour ran out${tail}`;
  }
  if (report.endReason === 'ended-early') {
    return `${head} You had ${String(report.correct)} correct when you ended the attempt${tail}`;
  }
  return `${head} You answered ${String(report.correct)} correctly.`;
}
