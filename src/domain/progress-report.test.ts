import { describe, expect, it } from 'vitest';
import {
  READINESS_TARGET,
  RUN_GAP_MS,
  accuracyByArea,
  groupRuns,
  historyTimeline,
  laneCaption,
  readinessSeries,
  summariseProgress,
  topicRows,
  weakestFirst,
} from './progress-report';
import type { Attempt, StudyProgress } from './progress';
import { emptyProgress } from './progress';
import type { ExamAttempt } from './exam-history';

const DEFS = [
  { id: 'regulatory-signs', area: 'signs', label: 'Regulatory signs' },
  { id: 'warning-signs', area: 'signs', label: 'Warning signs' },
  { id: 'right-of-way', area: 'rules-of-road', label: 'Right-of-way' },
  { id: 'dui-law', area: 'alcohol-drugs', label: 'DUI law' },
] as const;

const AREAS = [
  { id: 'signs', label: 'Traffic signs and signals' },
  { id: 'safe-driving', label: 'Safe driving principles' },
  { id: 'rules-of-road', label: 'Rules of the road' },
  { id: 'alcohol-drugs', label: 'Drugs and alcohol' },
] as const;

const attempt = (at: number, correct: boolean, topic = 'right-of-way'): Attempt => ({
  questionId: `q-${String(at)}`,
  topic,
  area: 'rules-of-road',
  chosenIndex: 0,
  correct,
  at,
});

const exam = (over: Partial<ExamAttempt> & Pick<ExamAttempt, 'id' | 'startedAt' | 'endedAt'>): ExamAttempt => ({
  seed: 1,
  endReason: 'completed',
  verdict: 'pass',
  correct: 26,
  wrong: 4,
  answered: 30,
  outOf: 30,
  elapsedSeconds: 1200,
  byArea: [],
  questions: [],
  answers: [],
  ...over,
});

describe('the readiness target', () => {
  it('is Tennessee’s own pass mark, 24 of 30', () => {
    expect(READINESS_TARGET).toBe(80);
    expect(Math.round((24 / 30) * 100)).toBe(READINESS_TARGET);
  });
});

describe('accuracyByArea', () => {
  it('draws all four blueprint areas even before anything is answered', () => {
    const rows = accuracyByArea({}, DEFS, AREAS);
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.seen === 0 && r.percent === 0)).toBe(true);
    // Nothing answered is not a score of zero: the caller must be able to tell.
    expect(rows.every((r) => !r.touched)).toBe(true);
  });

  it('rolls every topic in an area into one lane', () => {
    const rows = accuracyByArea(
      {
        'regulatory-signs': { seen: 10, correct: 9 },
        'warning-signs': { seen: 10, correct: 8 },
      },
      DEFS,
      AREAS,
    );
    const signs = rows.find((r) => r.id === 'signs');
    expect(signs).toMatchObject({ seen: 20, correct: 17, percent: 85, touched: true });
    expect(signs?.meetsTarget).toBe(true);
  });

  it('marks a lane short of the 80 percent target, so it can be hatched as well as coloured', () => {
    const rows = accuracyByArea({ 'right-of-way': { seen: 61, correct: 35 } }, DEFS, AREAS);
    const rules = rows.find((r) => r.id === 'rules-of-road');
    expect(rules).toMatchObject({ percent: 57, meetsTarget: false, band: 'warn' });
    expect(rules?.pointsShort).toBe(23);
  });

  it('ignores a topic that belongs to no known area rather than inventing a lane', () => {
    const rows = accuracyByArea({ 'not-a-topic': { seen: 4, correct: 4 } }, DEFS, AREAS);
    expect(rows.every((r) => r.seen === 0)).toBe(true);
  });
});

describe('topicRows', () => {
  it('reports only the topics the learner has actually touched', () => {
    const rows = topicRows({ 'dui-law': { seen: 5, correct: 4 } }, DEFS);
    expect(rows.map((r) => r.id)).toEqual(['dui-law']);
    expect(rows[0]).toMatchObject({ percent: 80, band: 'guide', label: 'DUI law', area: 'alcohol-drugs' });
  });

  it('orders weakest first, breaking ties on the topic with more evidence', () => {
    const rows = weakestFirst(
      topicRows(
        {
          'regulatory-signs': { seen: 10, correct: 9 },
          'warning-signs': { seen: 4, correct: 2 },
          'right-of-way': { seen: 20, correct: 10 },
        },
        DEFS,
      ),
    );
    expect(rows.map((r) => r.id)).toEqual(['right-of-way', 'warning-signs', 'regulatory-signs']);
  });
});

describe('groupRuns', () => {
  it('has nothing to group with no attempts', () => {
    expect(groupRuns([])).toEqual([]);
  });

  it('gathers answers within one sitting into a single run', () => {
    const runs = groupRuns([attempt(0, true), attempt(60_000, false), attempt(120_000, true)]);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ startedAt: 0, endedAt: 120_000, asked: 3, correct: 2 });
  });

  it('starts a new run once the gap exceeds the threshold', () => {
    const runs = groupRuns([attempt(0, true), attempt(RUN_GAP_MS + 1, true)]);
    expect(runs).toHaveLength(2);
  });

  it('names the topics covered, most answered first', () => {
    const runs = groupRuns([
      attempt(0, true, 'right-of-way'),
      attempt(1000, true, 'dui-law'),
      attempt(2000, true, 'dui-law'),
    ]);
    expect(runs[0]?.topics).toEqual(['dui-law', 'right-of-way']);
  });

  it('tolerates an out-of-order log rather than producing a run per answer', () => {
    const runs = groupRuns([attempt(2000, true), attempt(0, true), attempt(1000, false)]);
    expect(runs).toHaveLength(1);
    expect(runs[0]?.asked).toBe(3);
  });
});

describe('readinessSeries', () => {
  it('draws nothing when there is nothing to draw', () => {
    expect(readinessSeries([])).toEqual([]);
  });

  it('is the running accuracy after each sitting, not the accuracy of each sitting', () => {
    const runs = groupRuns([
      attempt(0, true),
      attempt(1000, true),
      attempt(RUN_GAP_MS * 2, false),
      attempt(RUN_GAP_MS * 2 + 1000, false),
    ]);
    expect(readinessSeries(runs)).toEqual([
      { at: 1000, value: 100 },
      { at: RUN_GAP_MS * 2 + 1000, value: 50 },
    ]);
  });
});

describe('historyTimeline', () => {
  it('is empty when nothing has happened', () => {
    expect(historyTimeline([], [])).toEqual([]);
  });

  it('puts the most recent event first', () => {
    const runs = groupRuns([attempt(0, true), attempt(RUN_GAP_MS * 2, true)]);
    const events = historyTimeline(runs, []);
    expect(events.map((e) => e.at)).toEqual([RUN_GAP_MS * 2, 0]);
  });

  it('reports an exam sitting once, not twice', () => {
    // The exam feeds the study record too, so its answers form a run in the
    // attempt log. Reporting both would double-count the same half hour.
    const runs = groupRuns([attempt(1_000_000, true), attempt(1_100_000, false)]);
    const events = historyTimeline(runs, [exam({ id: 'e1', startedAt: 990_000, endedAt: 1_200_000 })]);
    expect(events).toHaveLength(1);
    expect(events[0]?.kind).toBe('exam');
  });

  it('keeps a study run that merely sits near an exam', () => {
    const runs = groupRuns([attempt(1_000_000, true)]);
    const events = historyTimeline(runs, [exam({ id: 'e1', startedAt: 5_000_000, endedAt: 5_200_000 })]);
    expect(events.map((e) => e.kind)).toEqual(['exam', 'study']);
  });
});

describe('summariseProgress', () => {
  it('reads an untouched record as empty rather than as a score of zero', () => {
    const summary = summariseProgress(emptyProgress(), [], DEFS);
    expect(summary).toMatchObject({
      hasHistory: false,
      answered: 0,
      readiness: 0,
      sittings: 0,
      examsTaken: 0,
      examsPassed: 0,
      topicsTouched: 0,
    });
  });

  it('counts answers from the durable rollups, not from the bounded attempt log', () => {
    // The log is capped at 200; the totals are not. A learner past the cap must
    // not watch their answered count fall.
    const progress: StudyProgress = {
      ...emptyProgress(),
      topics: { 'right-of-way': { seen: 612, correct: 514 } },
      attempts: [attempt(0, true)],
    };
    const summary = summariseProgress(progress, [], DEFS);
    expect(summary.answered).toBe(612);
    expect(summary.readiness).toBe(84);
    expect(summary.hasHistory).toBe(true);
  });

  it('counts mock exams passed against mock exams taken', () => {
    const summary = summariseProgress(
      emptyProgress(),
      [
        exam({ id: 'a', startedAt: 1, endedAt: 2, verdict: 'pass' }),
        exam({ id: 'b', startedAt: 3, endedAt: 4, verdict: 'short' }),
        exam({ id: 'c', startedAt: 5, endedAt: 6, verdict: 'halted' }),
      ],
      DEFS,
    );
    expect(summary).toMatchObject({ examsTaken: 3, examsPassed: 1, hasHistory: true });
  });
});

describe('the caption under the four lanes', () => {
  /** One topic per area, so a lane can be touched or left alone independently. */
  const FOUR = [
    { id: 'regulatory-signs', area: 'signs', label: 'Regulatory signs' },
    { id: 'night-driving', area: 'safe-driving', label: 'Night driving' },
    { id: 'right-of-way', area: 'rules-of-road', label: 'Right-of-way' },
    { id: 'dui-law', area: 'alcohol-drugs', label: 'DUI law' },
  ] as const;

  const lanes = (byArea: Record<string, { seen: number; correct: number }>) =>
    accuracyByArea(
      Object.fromEntries(
        Object.entries(byArea).map(([area, stat]) => [
          FOUR.find((def) => def.area === area)?.id ?? area,
          stat,
        ]),
      ),
      FOUR,
      AREAS,
    );

  it('never claims a target is met by an area nobody has answered in', () => {
    // The bug this replaces: with nothing touched, "areas short of target" is
    // an empty list, and an empty list read as success announced "that is what
    // walking in ready looks like" over a record of zero answers.
    const caption = laneCaption(lanes({}));
    expect(caption).not.toMatch(/walking in ready/i);
    expect(caption).toMatch(/nothing measured/i);
  });

  it('counts the untouched lanes rather than reading three of four as a pass', () => {
    const caption = laneCaption(lanes({ signs: { seen: 10, correct: 10 } }));
    expect(caption).toMatch(/3 of the four/i);
    expect(caption).not.toMatch(/walking in ready/i);
  });

  it('says walking in ready only when all four lanes are at or past target', () => {
    const caption = laneCaption(
      lanes({
        signs: { seen: 10, correct: 10 },
        'safe-driving': { seen: 10, correct: 9 },
        'rules-of-road': { seen: 10, correct: 8 },
        'alcohol-drugs': { seen: 10, correct: 10 },
      }),
    );
    expect(caption).toMatch(/walking in ready/i);
  });

  it('names the lanes that are short', () => {
    const caption = laneCaption(
      lanes({ signs: { seen: 10, correct: 3 }, 'safe-driving': { seen: 10, correct: 10 } }),
    );
    expect(caption).toMatch(/One lane is/);
    expect(caption).toMatch(/hatched/);
  });
});
