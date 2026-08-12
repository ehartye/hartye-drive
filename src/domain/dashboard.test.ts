import { describe, it, expect } from 'vitest';
import {
  EXAM_READY_THRESHOLD,
  MIN_ANSWERS_FOR_READING,
  RECOMMENDED_MOCK_PASSES,
  dashboardHeadline,
  estimatedMinutes,
  examRecommendation,
  judgedTopicCount,
  readiness,
  relativeDay,
  routeToTest,  starterTopics,
  studyStreak,
  topicDrillIds,
  weakTopics,
} from './dashboard';
import { emptyProgress, recordAttempt } from './progress';
import type { StudyProgress } from './progress';

const DAY = 86_400_000;
const NOON = new Date(2026, 7, 11, 12, 0, 0).getTime();

function answer(
  state: StudyProgress,
  questionId: string,
  topic: string,
  correct: boolean,
  at = NOON,
): StudyProgress {
  return recordAttempt(state, {
    questionId,
    topic,
    area: 'signs',
    chosenIndex: 0,
    correct,
    at,
  }).state;
}

function withHistory(rows: [string, string, boolean][], at = NOON): StudyProgress {
  return rows.reduce((state, [id, topic, correct]) => answer(state, id, topic, correct, at), emptyProgress());
}

describe('readiness', () => {
  it('reads zero with no history, and says so rather than dividing by zero', () => {
    const r = readiness(emptyProgress());
    expect(r.percent).toBe(0);
    expect(r.answered).toBe(0);
    expect(r.confidence).toBe('none');
    expect(r.band).toBe('stop');
  });

  it('is overall accuracy — the same number the progress screen reports', () => {
    // 3 of 4 right = 75%.
    const state = withHistory([
      ['q1', 'right-of-way', true],
      ['q2', 'right-of-way', true],
      ['q3', 'speed-limits', true],
      ['q4', 'speed-limits', false],
    ]);
    const r = readiness(state);
    expect(r.percent).toBe(75);
    expect(r.answered).toBe(4);
    expect(r.correct).toBe(3);
    expect(r.band).toBe('warn');
  });

  it('flags a reading taken on too little evidence rather than boasting 100%', () => {
    const thin = withHistory([['q1', 'right-of-way', true]]);
    expect(readiness(thin).percent).toBe(100);
    expect(readiness(thin).confidence).toBe('provisional');

    const rows: [string, string, boolean][] = Array.from({ length: MIN_ANSWERS_FOR_READING }, (_, i) => [
      `q${String(i)}`,
      'right-of-way',
      true,
    ]);
    expect(readiness(withHistory(rows)).confidence).toBe('measured');
    expect(readiness(withHistory(rows)).band).toBe('guide');
  });
});

describe('weak topics', () => {
  it('is empty until a topic has enough evidence to be called weak', () => {
    const state = withHistory([
      ['q1', 'right-of-way', false],
      ['q2', 'right-of-way', false],
    ]);
    expect(weakTopics(state, {}, 4)).toEqual([]);
  });

  it('ranks the weakest first and carries the numbers the row states', () => {
    const state = withHistory([
      ['a1', 'railroad-crossing-signs', false],
      ['a2', 'railroad-crossing-signs', false],
      ['a3', 'railroad-crossing-signs', false],
      ['b1', 'right-of-way', true],
      ['b2', 'right-of-way', false],
      ['b3', 'right-of-way', true],
      ['b4', 'right-of-way', false],
    ]);
    const rows = weakTopics(state, { 'railroad-crossing-signs': 11, 'right-of-way': 17 }, 4);
    expect(rows.map((r) => r.topic)).toEqual(['railroad-crossing-signs', 'right-of-way']);
    const [first] = rows;
    expect(first).toMatchObject({
      seen: 3,
      correct: 0,
      percent: 0,
      band: 'stop',
      questionCount: 11,
    });
    expect(first?.lastSeenAt).toBe(NOON);
    expect(rows[1]).toMatchObject({ seen: 4, correct: 2, percent: 50, band: 'warn' });
  });

  it('never returns more rows than asked for', () => {
    const rows: [string, string, boolean][] = [];
    for (const topic of ['t1', 't2', 't3', 't4', 't5']) {
      for (let i = 0; i < 3; i += 1) rows.push([`${topic}-${String(i)}`, topic, false]);
    }
    expect(weakTopics(withHistory(rows), {}, 4)).toHaveLength(4);
  });

  it('falls back to zero when a topic has no question count in the bank', () => {
    const state = withHistory([
      ['a1', 'unlisted', false],
      ['a2', 'unlisted', false],
      ['a3', 'unlisted', false],
    ]);
    expect(weakTopics(state, {}, 4)[0]?.questionCount).toBe(0);
  });
});

describe('starter topics — the pre-measurement stand-in', () => {
  const TOPICS = [
    { id: 'regulatory-signs', area: 'signs' },
    { id: 'warning-signs', area: 'signs' },
    { id: 'right-of-way', area: 'rules-of-road' },
    { id: 'night-driving', area: 'safe-driving' },
    { id: 'dui-law', area: 'alcohol-drugs' },
  ];

  it('offers one topic per blueprint area — the areas the test samples equally', () => {
    const rows = starterTopics(TOPICS, {
      'regulatory-signs': 12,
      'warning-signs': 19,
      'right-of-way': 17,
      'night-driving': 9,
      'dui-law': 14,
    });
    expect(rows.map((r) => r.topic)).toEqual([
      'warning-signs',
      'night-driving',
      'right-of-way',
      'dui-law',
    ]);
    expect(rows[0]?.questionCount).toBe(19);
  });

  it('skips an area the bank cannot cover rather than inventing a row', () => {
    const rows = starterTopics([{ id: 'dui-law', area: 'alcohol-drugs' }], {});
    expect(rows).toEqual([]);
  });
});

describe('route to the test', () => {
  it('states three destinations, each with a reachable target', () => {
    const state = withHistory([
      ['q1', 'right-of-way', true],
      ['q2', 'right-of-way', false],
    ]);
    const rows = routeToTest({
      progress: state,
      bankSize: 506,
      signs: { solid: 12, total: 87 },
      examsPassed: 3,
    });
    expect(rows.map((r) => [r.value, r.target])).toEqual([
      [2, 506],
      [12, 87],
      [3, RECOMMENDED_MOCK_PASSES],
    ]);
    for (const row of rows) expect(row.value).toBeLessThanOrEqual(row.target);
  });

  it('never reads past its target when the learner overshoots', () => {
    const rows = routeToTest({
      progress: emptyProgress(),
      bankSize: 506,
      signs: { solid: 0, total: 87 },
      examsPassed: 9,
    });
    expect(rows[2]?.value).toBe(RECOMMENDED_MOCK_PASSES);
  });
});

describe('study streak', () => {
  it('is zero, with today still open, when nothing has been answered', () => {
    const streak = studyStreak([], NOON);
    expect(streak.current).toBe(0);
    expect(streak.longest).toBe(0);
    expect(streak.days).toHaveLength(7);
    expect(streak.days.at(-1)?.isToday).toBe(true);
    expect(streak.days.every((d) => !d.studied)).toBe(true);
  });

  it('counts consecutive days ending today', () => {
    const attempts = [0, 1, 2, 3, 4, 5].map((back) => ({ at: NOON - back * DAY }));
    const streak = studyStreak(attempts, NOON);
    expect(streak.current).toBe(6);
    expect(streak.longest).toBe(6);
    expect(streak.isBest).toBe(true);
    expect(streak.days.filter((d) => d.studied)).toHaveLength(6);
  });

  it('keeps a streak alive on a day that has not been studied yet', () => {
    const attempts = [1, 2, 3].map((back) => ({ at: NOON - back * DAY }));
    const streak = studyStreak(attempts, NOON);
    expect(streak.current).toBe(3);
    expect(streak.days.at(-1)?.studied).toBe(false);
  });

  it('breaks the streak once a whole day has been skipped, and remembers the best run', () => {
    const attempts = [
      { at: NOON - 9 * DAY },
      { at: NOON - 8 * DAY },
      { at: NOON - 7 * DAY },
      { at: NOON - 6 * DAY },
      { at: NOON },
    ];
    const streak = studyStreak(attempts, NOON);
    expect(streak.current).toBe(1);
    expect(streak.longest).toBe(4);
    expect(streak.isBest).toBe(false);
  });

  it('counts a day once, however many questions it held', () => {
    const attempts = [
      { at: NOON },
      { at: NOON - 3_600_000 },
      { at: NOON - 7_200_000 },
    ];
    expect(studyStreak(attempts, NOON).current).toBe(1);
  });
});

describe('wording', () => {
  it('says when a topic was last seen the way a person would', () => {
    expect(relativeDay(NOON, NOON)).toBe('today');
    expect(relativeDay(NOON - DAY, NOON)).toBe('yesterday');
    expect(relativeDay(NOON - 4 * DAY, NOON)).toBe('4 days ago');
    expect(relativeDay(null, NOON)).toBe('not yet seen');
  });

  it('estimates a session at half a minute a question, never at zero minutes', () => {
    expect(estimatedMinutes(12)).toBe(6);
    expect(estimatedMinutes(1)).toBe(1);
    expect(estimatedMinutes(0)).toBe(0);
  });

  it('heads the dashboard with where the learner actually is', () => {
    expect(dashboardHeadline(readiness(emptyProgress()), 0).heading).toMatch(/first mile/i);

    const thin = withHistory([['q1', 'right-of-way', true]]);
    expect(dashboardHeadline(readiness(thin), 0).heading).toMatch(/reading/i);

    const rows = (n: number, correct: number): [string, string, boolean][] =>
      Array.from({ length: n }, (_, i) => [`q${String(i)}`, 'right-of-way', i < correct]);

    const weak = readiness(withHistory(rows(20, 6)));
    expect(weak.percent).toBe(30);
    expect(dashboardHeadline(weak, 3).heading).toBeTruthy();
    expect(dashboardHeadline(weak, 3).sub).toMatch(/3 topics/);

    const nearly = readiness(withHistory(rows(20, 16)));
    expect(nearly.percent).toBe(80);
    expect(dashboardHeadline(nearly, 1).sub).toMatch(/1 topic\b/);

    const ready = readiness(withHistory(rows(20, 19)));
    expect(ready.percent).toBe(95);
    expect(dashboardHeadline(ready, 0).heading).toMatch(/ready/i);
    expect(dashboardHeadline(ready, 0).sub).toMatch(/holding you back/i);
  });

  it('never reads "nothing is holding you back" over a failing readiness', () => {
    // The first session samples one question per topic, so no topic clears
    // `WEAK_TOPIC_MIN_SEEN` and the weak list is empty — which used to be read
    // as "all clear" and printed beside a readiness of 8%.
    const spread: [string, string, boolean][] = [
      ['q1', 'right-of-way', true],
      ['q2', 'speed-limits', false],
      ['q3', 'night-driving', false],
      ['q4', 'dui-law', false],
      ['q5', 'warning-signs', false],
      ['q6', 'regulatory-signs', false],
      ['q7', 'adverse-weather', false],
      ['q8', 'required-stops', false],
      ['q9', 'traffic-signals', false],
      ['q10', 'alcohol-effects', false],
      ['q11', 'lane-use-and-passing', false],
      ['q12', 'following-and-stopping-distance', false],
    ];
    const state = withHistory(spread);
    const thin = readiness(state);
    expect(thin.percent).toBe(8);
    expect(weakTopics(state, {}, 4)).toHaveLength(0);
    expect(judgedTopicCount(state)).toBe(0);

    const sub = dashboardHeadline(thin, 0, judgedTopicCount(state)).sub;
    expect(sub).not.toMatch(/nothing is holding you back/i);
    expect(sub).toMatch(/enough answers/i);
  });

  it('says the gap is spread once topics have been judged and none is weak', () => {
    const rows = (topic: string, n: number, correct: number): [string, string, boolean][] =>
      Array.from({ length: n }, (_, i) => [`${topic}${String(i)}`, topic, i < correct]);
    const state = withHistory([...rows('right-of-way', 10, 7), ...rows('speed-limits', 10, 7)]);
    expect(judgedTopicCount(state)).toBe(2);
    const sub = dashboardHeadline(readiness(state), 0, judgedTopicCount(state)).sub;
    expect(sub).not.toMatch(/nothing is holding you back/i);
    expect(sub).toMatch(/spread/i);
  });
});

describe('the drill behind a weak topic row', () => {
  const QUESTIONS = [
    { id: 'q1', topic: 'right-of-way' },
    { id: 'q2', topic: 'right-of-way' },
    { id: 'q3', topic: 'right-of-way' },
    { id: 'q4', topic: 'right-of-way' },
    { id: 'other', topic: 'speed-limits' },
  ];

  it('puts what was missed first, then what has never been asked', () => {
    let state = answer(emptyProgress(), 'q3', 'right-of-way', false);
    state = answer(state, 'q1', 'right-of-way', true);
    const ids = topicDrillIds(QUESTIONS, state.cards, 'right-of-way', 4);
    expect(ids[0]).toBe('q3');
    expect(ids.slice(1, 3)).toEqual(['q2', 'q4']);
    expect(ids.at(-1)).toBe('q1');
  });

  it('never leaves the topic, and never returns more than asked for', () => {
    expect(topicDrillIds(QUESTIONS, {}, 'right-of-way', 2)).toEqual(['q1', 'q2']);
    expect(topicDrillIds(QUESTIONS, {}, 'speed-limits', 9)).toEqual(['other']);
    expect(topicDrillIds(QUESTIONS, {}, 'right-of-way', 0)).toEqual([]);
  });
});

describe('exam recommendation', () => {
  it('withholds the recommendation until the readiness gate is cleared', () => {
    const held = examRecommendation(72, 0);
    expect(held.recommended).toBe(false);
    expect(held.threshold).toBe(EXAM_READY_THRESHOLD);
    expect(held.eyebrow).toMatch(/not yet/i);
  });

  it('recommends the exam once readiness clears the gate', () => {
    expect(examRecommendation(EXAM_READY_THRESHOLD, 0).recommended).toBe(true);
    expect(examRecommendation(90, 0).eyebrow).toMatch(/recommended/i);
  });

  it('says so when the learner has already passed enough mock exams', () => {
    const done = examRecommendation(92, RECOMMENDED_MOCK_PASSES);
    expect(done.recommended).toBe(true);
    expect(done.body).toMatch(/passed/i);
  });
});
