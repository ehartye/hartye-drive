import { describe, it, expect } from 'vitest';
import {
  EXAM_PASS_MARK,
  EXAM_QUESTION_COUNT,
  EXAM_TIME_LIMIT_SECONDS,
  EXAM_WRONG_LIMIT,
  REACHABLE_AFTER_WRONG_LIMIT,
  allocateExamSlots,
  answerExamQuestion,
  currentQuestion,
  describeExamOutcome,
  endExamEarly,
  examAnswerFor,
  examHeadline,
  examStrikes,
  examVerdict,
  expireExam,
  isExamRunning,
  scoreExam,
  secondsRemaining,
  startExam,
} from './exam';
import type { ExamArea, ExamCandidate, ExamState } from './exam';

const T0 = Date.UTC(2026, 7, 11, 9, 0, 0);

/** The four areas the manual publishes, each a quarter (grounding §7). */
const AREAS: ExamArea[] = [
  { id: 'signs', share: 0.25 },
  { id: 'safe-driving', share: 0.25 },
  { id: 'rules-of-road', share: 0.25 },
  { id: 'alcohol-drugs', share: 0.25 },
];

const TOPICS: Record<string, string[]> = {
  signs: ['sign-shapes', 'regulatory', 'warning', 'signals'],
  'safe-driving': ['following', 'night', 'weather'],
  'rules-of-road': ['right-of-way', 'passing', 'speed', 'stops'],
  'alcohol-drugs': ['bac', 'implied-consent'],
};

/** A bank deep enough that sampling is never cornered. */
function bank(perTopic = 20): ExamCandidate[] {
  const out: ExamCandidate[] = [];
  for (const [area, topics] of Object.entries(TOPICS)) {
    for (const topic of topics) {
      for (let i = 0; i < perTopic; i += 1) {
        out.push({ id: `${topic}-${String(i)}`, topic, area });
      }
    }
  }
  return out;
}

function begin(seed = 1, candidates = bank()): ExamState {
  return startExam({ id: 'x', candidates, areas: AREAS, seed, now: T0 });
}

/** Answers up to `count` questions; `wrongAt(i)` decides which are missed. */
function play(state: ExamState, count: number, wrongAt: (i: number) => boolean): ExamState {
  let next = state;
  for (let i = 0; i < count; i += 1) {
    if (!isExamRunning(next, T0)) break;
    next = answerExamQuestion(next, { chosenIndex: 0, correct: !wrongAt(i), at: T0 + i * 1000 });
  }
  return next;
}

/* --------------------------------------------------------- the rules of TN */

describe('the published Tennessee rules', () => {
  it('is 30 questions, 24 to pass, 7 wrong, 60 minutes', () => {
    expect(EXAM_QUESTION_COUNT).toBe(30);
    expect(EXAM_PASS_MARK).toBe(24);
    expect(EXAM_WRONG_LIMIT).toBe(7);
    expect(EXAM_TIME_LIMIT_SECONDS).toBe(60 * 60);
  });

  it('terminates early because 24 stops being reachable, not by fiat', () => {
    expect(REACHABLE_AFTER_WRONG_LIMIT).toBe(EXAM_QUESTION_COUNT - EXAM_WRONG_LIMIT);
    expect(REACHABLE_AFTER_WRONG_LIMIT).toBeLessThan(EXAM_PASS_MARK);
    // One fewer wrong answer and passing would still be possible — which is
    // exactly why the limit sits at seven and not at six.
    expect(EXAM_QUESTION_COUNT - (EXAM_WRONG_LIMIT - 1)).toBeGreaterThanOrEqual(EXAM_PASS_MARK);
  });
});

/* ---------------------------------------------------------- the blueprint */

describe('blueprint allocation', () => {
  it('splits 30 into 25/25/25/25 as evenly as 30 allows', () => {
    const slots = allocateExamSlots(AREAS, 30, 0);
    expect([...slots.values()].reduce((a, b) => a + b, 0)).toBe(30);
    for (const count of slots.values()) expect([7, 8]).toContain(count);
  });

  it('rotates which two areas take the leftover, so no area is favoured over time', () => {
    const totals = new Map(AREAS.map((a) => [a.id, 0]));
    for (let rotation = 0; rotation < 4; rotation += 1) {
      const slots = allocateExamSlots(AREAS, 30, rotation);
      for (const [id, n] of slots) totals.set(id, (totals.get(id) ?? 0) + n);
    }
    // Four rotations × 7.5 ideal = 30 apiece, exactly.
    for (const total of totals.values()) expect(total).toBe(30);
  });

  it('gives every area the same count when the size divides cleanly', () => {
    const slots = allocateExamSlots(AREAS, 40, 3);
    for (const count of slots.values()) expect(count).toBe(10);
  });

  it('is empty for a size of zero', () => {
    expect(allocateExamSlots(AREAS, 0, 0).size).toBe(0);
  });
});

describe('sampling', () => {
  it('draws 30 distinct questions', () => {
    const state = begin(7);
    expect(state.questions).toHaveLength(30);
    expect(new Set(state.questions.map((q) => q.questionId)).size).toBe(30);
  });

  it('holds 25/25/25/25 across many runs — never by page count', () => {
    const totals = new Map(AREAS.map((a) => [a.id, 0]));
    const runs = 200;
    for (let seed = 0; seed < runs; seed += 1) {
      const counts = new Map<string, number>();
      for (const q of begin(seed).questions) counts.set(q.area, (counts.get(q.area) ?? 0) + 1);
      expect([...counts.values()].reduce((a, b) => a + b, 0)).toBe(30);
      for (const area of AREAS) {
        const n = counts.get(area.id) ?? 0;
        // Every single sitting is within one question of a perfect quarter.
        expect(n, `${area.id} on seed ${String(seed)}`).toBeGreaterThanOrEqual(7);
        expect(n, `${area.id} on seed ${String(seed)}`).toBeLessThanOrEqual(8);
        totals.set(area.id, (totals.get(area.id) ?? 0) + n);
      }
    }
    // And the long run converges on the published quarter, not on bank size —
    // `rules-of-road` has nearly three times the questions of `alcohol-drugs`
    // in the real bank, and must not get nearly three times the exam slots.
    for (const area of AREAS) {
      const mean = (totals.get(area.id) ?? 0) / runs;
      expect(mean, area.id).toBeGreaterThan(7.3);
      expect(mean, area.id).toBeLessThan(7.7);
    }
  });

  it('spreads an area across its topics rather than mining one', () => {
    for (let seed = 0; seed < 20; seed += 1) {
      const signs = begin(seed).questions.filter((q) => q.area === 'signs');
      expect(new Set(signs.map((q) => q.topic)).size).toBe(TOPICS.signs?.length);
    }
  });

  it('interleaves the four areas instead of blocking them', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const order = begin(seed).questions.map((q) => q.area);
      const blocked = [...order].sort((a, b) => a.localeCompare(b));
      expect(order.join()).not.toBe(blocked.join());
      let run = 1;
      let longest = 1;
      for (let i = 1; i < order.length; i += 1) {
        run = order[i] === order[i - 1] ? run + 1 : 1;
        longest = Math.max(longest, run);
      }
      // No area monopolises a stretch of the paper.
      expect(longest, `seed ${String(seed)}`).toBeLessThanOrEqual(3);
    }
  });

  it('is deterministic for a seed and different across seeds', () => {
    expect(begin(42).questions).toEqual(begin(42).questions);
    expect(begin(42).questions).not.toEqual(begin(43).questions);
  });

  it('still fills 30 when one area is short of its quota', () => {
    const thin = bank().filter((c) => c.area !== 'alcohol-drugs');
    thin.push({ id: 'bac-only', topic: 'bac', area: 'alcohol-drugs' });
    const state = startExam({ id: 'x', candidates: thin, areas: AREAS, seed: 5, now: T0 });
    expect(state.questions).toHaveLength(30);
    expect(state.questions.filter((q) => q.area === 'alcohol-drugs')).toHaveLength(1);
  });

  it('degrades to whatever the bank holds rather than repeating a question', () => {
    const tiny: ExamCandidate[] = [
      { id: 'a', topic: 'bac', area: 'alcohol-drugs' },
      { id: 'b', topic: 'warning', area: 'signs' },
    ];
    const state = startExam({ id: 'x', candidates: tiny, areas: AREAS, seed: 1, now: T0 });
    expect(state.questions).toHaveLength(2);
    expect(new Set(state.questions.map((q) => q.questionId)).size).toBe(2);
  });
});

/* ------------------------------------------------------------ progression */

describe('running the exam', () => {
  it('starts on question one with a full clock and no strikes', () => {
    const state = begin();
    expect(state.answers).toHaveLength(0);
    expect(examStrikes(state)).toBe(0);
    expect(secondsRemaining(state, T0)).toBe(EXAM_TIME_LIMIT_SECONDS);
    expect(currentQuestion(state)).toEqual(state.questions[0]);
    expect(isExamRunning(state, T0)).toBe(true);
  });

  it('advances one question per answer and never goes back', () => {
    const state = play(begin(), 3, () => false);
    expect(state.answers).toHaveLength(3);
    expect(currentQuestion(state)).toEqual(state.questions[3]);
    expect(state.answers.map((a) => a.questionId)).toEqual(
      state.questions.slice(0, 3).map((q) => q.questionId),
    );
  });

  it('records what was picked, so the report can replay it', () => {
    const state = answerExamQuestion(begin(), { chosenIndex: 2, correct: false, at: T0 + 500 });
    const asked = state.questions[0]?.questionId ?? '';
    expect(state.answers[0]).toMatchObject({ chosenIndex: 2, correct: false, at: T0 + 500 });
    expect(examAnswerFor(state, asked)?.chosenIndex).toBe(2);
    expect(examAnswerFor(state, 'never-asked')).toBeUndefined();
  });

  it('runs to 30 and ends as completed', () => {
    const state = play(begin(), 30, () => false);
    expect(state.answers).toHaveLength(30);
    expect(state.endReason).toBe('completed');
    expect(isExamRunning(state, T0)).toBe(false);
    expect(currentQuestion(state)).toBeUndefined();
  });

  it('ignores an answer once the attempt is over', () => {
    const done = play(begin(), 30, () => false);
    expect(answerExamQuestion(done, { chosenIndex: 0, correct: true, at: T0 + 1 })).toBe(done);
  });
});

/* -------------------------------------------------- the seven-wrong rule */

describe('early termination at seven wrong', () => {
  it('ends on the seventh wrong answer, wherever it lands', () => {
    // Missed 1, 2, 3, then every other one: the seventh miss falls on Q10.
    const state = play(begin(), 30, (i) => i < 3 || i % 2 === 1);
    expect(examStrikes(state)).toBe(7);
    expect(state.answers).toHaveLength(10);
    expect(state.endReason).toBe('strikes');
    expect(isExamRunning(state, T0)).toBe(false);
  });

  it('ends at question 7 when the first seven are all wrong', () => {
    const state = play(begin(), 30, () => true);
    expect(state.answers).toHaveLength(7);
    expect(state.endReason).toBe('strikes');
    expect(state.answers.at(-1)?.questionId).toBe(state.questions[6]?.questionId);
  });

  it('survives six wrong and keeps going', () => {
    const state = play(begin(), 20, (i) => i < 6);
    expect(examStrikes(state)).toBe(6);
    expect(state.answers).toHaveLength(20);
    expect(state.endReason).toBeNull();
    expect(isExamRunning(state, T0)).toBe(true);
  });

  it('is scored as halted, and passing is arithmetically out of reach', () => {
    const state = play(begin(), 30, (i) => i < 3 || i % 2 === 1);
    const report = scoreExam(state, AREAS);
    expect(report.verdict).toBe('halted');
    expect(report.endReason).toBe('strikes');
    expect(report.answered).toBe(10);
    expect(report.unasked).toBe(20);
    // Even a perfect run through every unasked question falls short of 24.
    expect(report.correct + report.unasked).toBeLessThan(EXAM_PASS_MARK);
    expect(examHeadline(report)).toBe('Stopped at question 10');
  });
});

/* ------------------------------------------------------------- the clock */

describe('the timer holds the authority', () => {
  it('counts down from the wall clock, not from ticks', () => {
    const state = begin();
    expect(secondsRemaining(state, T0 + 90_000)).toBe(EXAM_TIME_LIMIT_SECONDS - 90);
    // A backgrounded tab cannot buy time: the deadline is absolute.
    expect(secondsRemaining(state, T0 + 3_600_000)).toBe(0);
    expect(secondsRemaining(state, T0 + 9_999_999)).toBe(0);
  });

  it('stops the clock at the moment the attempt ended', () => {
    const ended = endExamEarly(play(begin(), 2, () => false), T0 + 60_000);
    expect(secondsRemaining(ended, T0 + 600_000)).toBe(EXAM_TIME_LIMIT_SECONDS - 60);
  });

  it('is not running once the deadline passes, even with no answer submitted', () => {
    expect(isExamRunning(begin(), T0 + 3_600_001)).toBe(false);
  });

  it('scores what was answered when time runs out', () => {
    const expired = expireExam(play(begin(), 10, (i) => i === 0), T0 + 3_600_000);
    expect(expired.endReason).toBe('timeout');
    const report = scoreExam(expired, AREAS);
    expect(report.answered).toBe(10);
    expect(report.correct).toBe(9);
    expect(report.unasked).toBe(20);
    expect(report.verdict).toBe('short');
    expect(report.elapsedSeconds).toBe(EXAM_TIME_LIMIT_SECONDS);
  });

  it('refuses an answer submitted after the deadline and ends the attempt', () => {
    const state = answerExamQuestion(begin(), {
      chosenIndex: 0,
      correct: true,
      at: T0 + 3_600_001,
    });
    expect(state.answers).toHaveLength(0);
    expect(state.endReason).toBe('timeout');
  });

  it('expiring an already-ended attempt changes nothing', () => {
    const done = endExamEarly(begin(), T0 + 10);
    expect(expireExam(done, T0 + 3_600_000)).toBe(done);
  });

  it('expiring a running attempt before the deadline is refused', () => {
    const running = begin();
    expect(expireExam(running, T0 + 60_000)).toBe(running);
  });
});

/* -------------------------------------------------------- ending it early */

describe('ending early by hand', () => {
  it('scores what was answered and closes the attempt', () => {
    const state = endExamEarly(play(begin(), 12, (i) => i % 4 === 0), T0 + 900_000);
    expect(state.endReason).toBe('ended-early');
    const report = scoreExam(state, AREAS);
    expect(report.answered).toBe(12);
    expect(report.correct).toBe(9);
    expect(report.verdict).toBe('short');
    expect(report.elapsedSeconds).toBe(900);
  });

  it('cannot resurrect a finished attempt', () => {
    const done = play(begin(), 30, () => false);
    expect(endExamEarly(done, T0 + 1)).toBe(done);
  });
});

/* ------------------------------------------------------------- the score */

describe('scoring', () => {
  it('passes at exactly 24 of 30', () => {
    const state = play(begin(), 30, (i) => i >= 24);
    const report = scoreExam(state, AREAS);
    expect(report.correct).toBe(24);
    expect(report.wrong).toBe(6);
    expect(report.verdict).toBe('pass');
    expect(examHeadline(report)).toBe('You passed');
  });

  it('makes a completed sitting either a pass or a halt — never a near miss', () => {
    // 30 answered with six or fewer wrong is 24 correct by arithmetic, and a
    // seventh wrong ends the attempt. Falling short therefore only happens by
    // running out of time or walking out. See deviations.md (P5, mockup 06b).
    for (let seed = 0; seed < 25; seed += 1) {
      const completed = play(begin(seed), 30, (i) => i % 5 === 0);
      const report = scoreExam(completed, AREAS);
      expect(report.verdict === 'pass' || report.verdict === 'halted').toBe(true);
    }
  });

  it('falls short when the attempt is abandoned below the pass mark', () => {
    const state = endExamEarly(play(begin(), 20, (i) => i % 4 === 0), T0 + 600_000);
    const report = scoreExam(state, AREAS);
    expect(report.correct).toBe(15);
    expect(report.verdict).toBe('short');
    expect(examHeadline(report)).toBe('Nine short');
  });

  it('says "One short" rather than "1 short"', () => {
    const state = endExamEarly(play(begin(), 29, (i) => i >= 23), T0 + 600_000);
    const report = scoreExam(state, AREAS);
    expect(report.correct).toBe(23);
    expect(examHeadline(report)).toBe('One short');
  });

  it('breaks the score down by the four blueprint areas', () => {
    const state = play(begin(), 30, (i) => i >= 25);
    const report = scoreExam(state, AREAS);
    expect(report.byArea.map((a) => a.area)).toEqual(AREAS.map((a) => a.id));
    expect(report.byArea.reduce((n, a) => n + a.asked, 0)).toBe(30);
    expect(report.byArea.reduce((n, a) => n + a.correct, 0)).toBe(report.correct);
  });

  it('counts only what was asked when the attempt stopped early', () => {
    const report = scoreExam(play(begin(), 30, () => true), AREAS);
    expect(report.byArea.reduce((n, a) => n + a.asked, 0)).toBe(7);
    expect(report.answered).toBe(7);
    expect(report.unasked).toBe(23);
  });

  it('names the questions that were missed, in the order they were asked', () => {
    const state = play(begin(), 10, (i) => i === 1 || i === 4);
    const report = scoreExam(state, AREAS);
    expect(report.missedQuestionIds).toEqual([
      state.questions[1]?.questionId,
      state.questions[4]?.questionId,
    ]);
  });

  it('ranks the weakest areas worst first, and says nothing about unasked ones', () => {
    let state = begin(9);
    for (let i = 0; i < 20 && isExamRunning(state, T0); i += 1) {
      const question = currentQuestion(state);
      if (!question) break;
      state = answerExamQuestion(state, {
        chosenIndex: 0,
        correct: question.area !== 'alcohol-drugs',
        at: T0 + i,
      });
    }
    const report = scoreExam(endExamEarly(state, T0 + 600_000), AREAS);
    expect(report.weakestAreas[0]).toBe('alcohol-drugs');
    for (const area of report.weakestAreas) {
      const scored = report.byArea.find((a) => a.area === area);
      expect(scored?.asked).toBeGreaterThan(0);
    }
  });

  it('scores an untouched attempt honestly rather than dividing by zero', () => {
    const report = scoreExam(endExamEarly(begin(), T0 + 1000), AREAS);
    expect(report.answered).toBe(0);
    expect(report.correct).toBe(0);
    expect(report.verdict).toBe('short');
    expect(report.weakestAreas).toEqual([]);
    expect(report.byArea.every((a) => a.asked === 0)).toBe(true);
  });

  it('an exam still in progress scores as it stands', () => {
    const report = scoreExam(play(begin(), 5, () => false), AREAS);
    expect(report.endReason).toBe('in-progress');
    expect(report.answered).toBe(5);
    expect(report.elapsedSeconds).toBe(4);
  });
});

describe('the verdict', () => {
  it.each([
    [24, 6, 'pass'],
    [30, 0, 'pass'],
    [12, 7, 'halted'],
    [3, 7, 'halted'],
    [20, 4, 'short'],
    [0, 0, 'short'],
  ] as const)('%i correct and %i wrong is %s', (correct, wrong, expected) => {
    expect(examVerdict(correct, wrong)).toBe(expected);
  });

  it('puts the seven-wrong rule above the pass mark, since both cannot hold', () => {
    // Unreachable in a real sitting; asserted so the precedence is explicit.
    expect(examVerdict(24, 7)).toBe('halted');
  });
});

/* ------------------------------------------------------------- the words */

describe('the words the report uses', () => {
  it('explains a pass by the margin', () => {
    const report = scoreExam(play(begin(), 30, (i) => i >= 26), AREAS);
    expect(examHeadline(report)).toBe('You passed');
    expect(describeExamOutcome(report)).toContain('30 questions and requires 24');
    expect(describeExamOutcome(report)).toContain('two');
  });

  it('does not claim a margin when the pass was exact', () => {
    const report = scoreExam(play(begin(), 30, (i) => i >= 24), AREAS);
    expect(report.correct).toBe(EXAM_PASS_MARK);
    expect(describeExamOutcome(report)).toContain('cleared it exactly');
  });

  it('states a running attempt plainly rather than pretending it ended', () => {
    const report = scoreExam(play(begin(), 5, () => false), AREAS);
    expect(describeExamOutcome(report)).toBe(
      'Tennessee requires 24 of 30. You answered 5 correctly.',
    );
  });

  it('explains a shortfall, and names the reason the attempt stopped', () => {
    const early = scoreExam(endExamEarly(play(begin(), 12, () => false), T0 + 600_000), AREAS);
    expect(early.verdict).toBe('short');
    expect(examHeadline(early)).toMatch(/short$/);
    expect(describeExamOutcome(early)).toContain('24 of 30');
    expect(describeExamOutcome(early)).toContain('ended the attempt');

    const timed = scoreExam(expireExam(play(begin(), 12, () => false), T0 + 3_600_000), AREAS);
    expect(describeExamOutcome(timed)).toContain('hour ran out');
  });

  it('explains a halt with the arithmetic that causes it', () => {
    const report = scoreExam(play(begin(), 30, () => true), AREAS);
    expect(describeExamOutcome(report)).toContain('30 minus 7 leaves 23');
    expect(describeExamOutcome(report)).toContain('never asked');
    expect(describeExamOutcome(report)).toContain('Driver Service Center');
  });
});
