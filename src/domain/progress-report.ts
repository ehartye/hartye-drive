/**
 * Everything the progress surface reports, derived — never stored.
 *
 * There is exactly one source of truth for how well a learner is doing, and it
 * is the study record in `progress.ts` plus the exam record in
 * `exam-history.ts`. This module turns those two into the shapes the page
 * draws: four blueprint lanes, a topic-by-topic list, a readiness trend and a
 * timeline of sittings. It stores nothing and caches nothing, so no figure here
 * can ever drift from the record it came from.
 *
 * Two things are worth knowing about the inputs:
 *
 *  - **The rollups outlive the log.** `topics` is unbounded and is what the
 *    headline figures come from; `attempts` is capped at 200 (grounding §6) and
 *    is what the trend and the timeline come from. A learner past the cap keeps
 *    every number and loses only the oldest rows of the story.
 *  - **The exam writes to both records.** Sitting a mock exam files an exam
 *    attempt *and* answers into the study log, so the timeline has to recognise
 *    the study run that an exam produced and report it once, as the exam.
 *
 * Pure and DOM-free.
 */
import { bandLabel, masteryBand, masteryPercent } from './mastery';
import type { MasteryBand } from './mastery';
import type { Attempt, StudyProgress } from './progress';
import { overallAccuracy } from './progress';
import type { ExamAttempt } from './exam-history';
import type { TopicStat } from './session';
import type { SeriesPoint } from './charts';

/** Tennessee needs 24 of 30. That is the line every lane is measured against. */
export const READINESS_TARGET = 80;

/**
 * Answers more than 45 minutes apart are different sittings. Long enough that a
 * slow twelve-question session with a phone call in the middle stays one run;
 * short enough that this evening and tomorrow morning never merge.
 */
export const RUN_GAP_MS = 45 * 60_000;

/* ------------------------------------------------------- the four lanes */

export interface TopicDefLike {
  id: string;
  area: string;
  label: string;
}

export interface AreaRow {
  id: string;
  label: string;
  correct: number;
  seen: number;
  percent: number;
  band: MasteryBand;
  bandLabel: string;
  /** `false` before a single answer — an empty lane, not a lane scoring zero. */
  touched: boolean;
  meetsTarget: boolean;
  /** Whole points below `READINESS_TARGET`; `0` once the lane is at or past it. */
  pointsShort: number;
}

/**
 * One lane per published exam area, always all four, in the manual's own order.
 * The blueprint exists before the learner does — drawing only the areas they
 * have touched would hide a quarter of the test they have never opened.
 */
export function accuracyByArea(
  topics: Readonly<Record<string, TopicStat>>,
  defs: readonly TopicDefLike[],
  areas: readonly { id: string; label: string }[],
): AreaRow[] {
  const areaOf = new Map(defs.map((def) => [def.id, def.area]));
  const totals = new Map<string, { seen: number; correct: number }>(
    areas.map((area) => [area.id, { seen: 0, correct: 0 }]),
  );

  for (const [topicId, stat] of Object.entries(topics)) {
    const areaId = areaOf.get(topicId);
    if (areaId === undefined) continue;
    const bucket = totals.get(areaId);
    if (!bucket) continue;
    bucket.seen += stat.seen;
    bucket.correct += stat.correct;
  }

  return areas.map((area) => {
    const bucket = totals.get(area.id) ?? { seen: 0, correct: 0 };
    const percent = masteryPercent(bucket.correct, bucket.seen);
    const band = masteryBand(percent);
    return {
      id: area.id,
      label: area.label,
      correct: bucket.correct,
      seen: bucket.seen,
      percent,
      band,
      bandLabel: bandLabel(band),
      touched: bucket.seen > 0,
      meetsTarget: bucket.seen > 0 && percent >= READINESS_TARGET,
      pointsShort: Math.max(0, READINESS_TARGET - percent),
    };
  });
}

/**
 * The sentence under the four lanes.
 *
 * It lives here rather than in the page because it is a **claim about the
 * record**, and every claim about the record is derived in one place and
 * tested. The bug it replaces made that case: the page filtered for lanes that
 * were touched *and* short, and read the empty result as success — so a learner
 * who had answered nothing at all was told "that is what walking in ready looks
 * like". An empty list of failures is not a pass; an untouched lane is a
 * quarter of the test nobody has opened, and it is counted out loud.
 */
export function laneCaption(areas: readonly AreaRow[]): string {
  const short = areas.filter((area) => area.touched && !area.meetsTarget);
  const untouched = areas.filter((area) => !area.touched).length;

  if (short.length > 0) {
    return `${short.length === 1 ? 'One lane is' : `${String(short.length)} lanes are`} hatched — short of target. ${
      short.length === 1 ? 'It is' : 'They are'
    } a quarter of the real test each.`;
  }
  if (untouched === areas.length) {
    return 'Nothing measured yet — all four lanes are open road. Answer anything and they start filling.';
  }
  if (untouched > 0) {
    return `Every lane you have driven is at or past ${String(READINESS_TARGET)}%, but ${String(untouched)} of the four ${
      untouched === 1 ? 'is' : 'are'
    } still open road — and each one is a quarter of the real test.`;
  }
  return `All four lanes are at or past ${String(READINESS_TARGET)}%. That is what walking in ready looks like.`;
}

/* ------------------------------------------------------- topic by topic */

export interface TopicRow {
  id: string;
  label: string;
  area: string;
  correct: number;
  seen: number;
  percent: number;
  band: MasteryBand;
  bandLabel: string;
}

/** Every topic with at least one answer against it, in taxonomy order. */
export function topicRows(
  topics: Readonly<Record<string, TopicStat>>,
  defs: readonly TopicDefLike[],
): TopicRow[] {
  const rows: TopicRow[] = [];
  for (const def of defs) {
    const stat = topics[def.id];
    if (!stat || stat.seen === 0) continue;
    const percent = masteryPercent(stat.correct, stat.seen);
    const band = masteryBand(percent);
    rows.push({
      id: def.id,
      label: def.label,
      area: def.area,
      correct: stat.correct,
      seen: stat.seen,
      percent,
      band,
      bandLabel: bandLabel(band),
    });
  }
  return rows;
}

/** Weakest first; a tie goes to the topic with more evidence behind it. */
export function weakestFirst(rows: readonly TopicRow[]): TopicRow[] {
  return [...rows].sort((a, b) => {
    if (a.percent !== b.percent) return a.percent - b.percent;
    if (a.seen !== b.seen) return b.seen - a.seen;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/* -------------------------------------------------------------- sittings */

export interface StudyRun {
  /** Stable across renders: the run's own start. */
  id: string;
  startedAt: number;
  endedAt: number;
  asked: number;
  correct: number;
  /** Topics covered, most answered first. */
  topics: string[];
}

/**
 * The attempt log is one row per answer; a learner remembers sittings. Answers
 * are gathered into runs by the gap between them, which is derivable from what
 * is already stored — no second record, and nothing to migrate.
 */
export function groupRuns(attempts: readonly Attempt[], gapMs: number = RUN_GAP_MS): StudyRun[] {
  if (attempts.length === 0) return [];
  const ordered = [...attempts].sort((a, b) => a.at - b.at);

  const runs: { startedAt: number; endedAt: number; asked: number; correct: number; byTopic: Map<string, number> }[] =
    [];

  for (const item of ordered) {
    const current = runs.at(-1);
    if (!current || item.at - current.endedAt > gapMs) {
      runs.push({
        startedAt: item.at,
        endedAt: item.at,
        asked: 1,
        correct: item.correct ? 1 : 0,
        byTopic: new Map([[item.topic, 1]]),
      });
      continue;
    }
    current.endedAt = item.at;
    current.asked += 1;
    if (item.correct) current.correct += 1;
    current.byTopic.set(item.topic, (current.byTopic.get(item.topic) ?? 0) + 1);
  }

  return runs.map((run) => ({
    id: `run-${String(run.startedAt)}`,
    startedAt: run.startedAt,
    endedAt: run.endedAt,
    asked: run.asked,
    correct: run.correct,
    topics: [...run.byTopic.entries()]
      .sort((a, b) => (b[1] !== a[1] ? b[1] - a[1] : a[0] < b[0] ? -1 : 1))
      .map(([topic]) => topic),
  }));
}

/* ------------------------------------------------------------ the trend */

/**
 * One reading per sitting: the learner's running accuracy at the end of it.
 *
 * Deliberately cumulative rather than per-sitting. A single bad twelve-question
 * session is noise; what a learner needs to know is whether the line they will
 * walk into the Driver Service Center with is above the pass mark.
 */
export function readinessSeries(runs: readonly StudyRun[]): SeriesPoint[] {
  let asked = 0;
  let correct = 0;
  return runs.map((run) => {
    asked += run.asked;
    correct += run.correct;
    return { at: run.endedAt, value: masteryPercent(correct, asked) };
  });
}

/* ---------------------------------------------------------- the timeline */

export type HistoryEvent =
  | { kind: 'study'; at: number; run: StudyRun }
  | { kind: 'exam'; at: number; attempt: ExamAttempt };

const overlaps = (run: StudyRun, attempt: ExamAttempt): boolean =>
  run.startedAt <= attempt.endedAt && run.endedAt >= attempt.startedAt;

/**
 * Sittings and mock exams on one road, newest first.
 *
 * A mock exam files answers into the study log as well as its own record, so
 * the run those answers form is dropped in favour of the exam attempt — the
 * same half hour must not appear as two events.
 */
export function historyTimeline(
  runs: readonly StudyRun[],
  exams: readonly ExamAttempt[],
): HistoryEvent[] {
  const events: HistoryEvent[] = [];

  for (const run of runs) {
    if (exams.some((attempt) => overlaps(run, attempt))) continue;
    events.push({ kind: 'study', at: run.endedAt, run });
  }
  for (const attempt of exams) {
    events.push({ kind: 'exam', at: attempt.endedAt, attempt });
  }

  return events.sort((a, b) => (b.at !== a.at ? b.at - a.at : a.kind < b.kind ? -1 : 1));
}

/* ------------------------------------------------------------- headline */

export interface ProgressSummary {
  /** Overall accuracy across every answer ever given. */
  readiness: number;
  /** From the durable rollups, so it never falls when the log is pruned. */
  answered: number;
  correct: number;
  sittings: number;
  examsTaken: number;
  examsPassed: number;
  topicsTouched: number;
  /** `false` means the empty state, and the empty state is not a score of zero. */
  hasHistory: boolean;
  lastStudiedAt: number | null;
}

export function summariseProgress(
  progress: StudyProgress,
  exams: readonly ExamAttempt[],
  defs: readonly TopicDefLike[],
): ProgressSummary {
  const rows = topicRows(progress.topics, defs);
  const answered = rows.reduce((sum, row) => sum + row.seen, 0);
  const correct = rows.reduce((sum, row) => sum + row.correct, 0);

  return {
    readiness: overallAccuracy(progress),
    answered,
    correct,
    sittings: groupRuns(progress.attempts).length,
    examsTaken: exams.length,
    examsPassed: exams.filter((attempt) => attempt.verdict === 'pass').length,
    topicsTouched: rows.length,
    hasHistory: answered > 0 || exams.length > 0,
    lastStudiedAt: progress.lastStudiedAt,
  };
}
