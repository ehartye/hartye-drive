import { describe, it, expect } from 'vitest';
import {
  ATTEMPT_HISTORY_LIMIT,
  completeSession,
  emptyProgress,
  overallAccuracy,
  recordAttempt,
  topicStatOf,
} from './progress';
import type { StudyProgress } from './progress';
import { GRADUATED_BOX } from './scheduler';

const T0 = Date.UTC(2026, 7, 11, 9, 0, 0);

const answer = (
  state: StudyProgress,
  questionId: string,
  correct: boolean,
  at: number,
  topic = 'railroad',
) =>
  recordAttempt(state, {
    questionId,
    topic,
    area: 'rules-of-road',
    chosenIndex: correct ? 0 : 2,
    correct,
    at,
  });

describe('emptyProgress', () => {
  it('is a valid, stamped, empty state', () => {
    const state = emptyProgress();
    expect(state.schemaVersion).toBe(1);
    expect(state.cards).toEqual({});
    expect(state.topics).toEqual({});
    expect(state.attempts).toEqual([]);
    expect(state.sessionsCompleted).toBe(0);
    expect(state.lastStudiedAt).toBeNull();
  });
});

describe('recordAttempt', () => {
  it('creates the card on first sight and schedules it', () => {
    const { state, before, after } = answer(emptyProgress(), 'row-017', true, T0);
    expect(before.seen).toBe(0);
    expect(after.seen).toBe(1);
    expect(state.cards['row-017']!.box).toBe(1);
    expect(state.cards['row-017']!.topic).toBe('railroad');
  });

  it('advances the same card on the next sighting instead of starting over', () => {
    let state = emptyProgress();
    state = answer(state, 'row-017', true, T0).state;
    state = answer(state, 'row-017', true, T0 + 86_400_000).state;
    state = answer(state, 'row-017', true, T0 + 8 * 86_400_000).state;
    expect(state.cards['row-017']!.box).toBe(GRADUATED_BOX);
    expect(state.cards['row-017']!.seen).toBe(3);
  });

  it('rolls the answer up into the topic, which is what drives targeting', () => {
    let state = emptyProgress();
    state = answer(state, 'a', true, T0).state;
    state = answer(state, 'b', false, T0 + 1).state;
    state = answer(state, 'c', true, T0 + 2, 'parking').state;

    expect(topicStatOf(state, 'railroad')).toEqual({ seen: 2, correct: 1 });
    expect(topicStatOf(state, 'parking')).toEqual({ seen: 1, correct: 1 });
    expect(topicStatOf(state, 'never-touched')).toEqual({ seen: 0, correct: 0 });
  });

  it('records the attempt itself, newest last', () => {
    let state = emptyProgress();
    state = answer(state, 'a', true, T0).state;
    state = answer(state, 'b', false, T0 + 1).state;
    expect(state.attempts.map((a) => a.questionId)).toEqual(['a', 'b']);
    expect(state.attempts[1]!).toEqual({
      questionId: 'b',
      topic: 'railroad',
      area: 'rules-of-road',
      chosenIndex: 2,
      correct: false,
      at: T0 + 1,
    });
  });

  it('stamps when the learner last studied', () => {
    const { state } = answer(emptyProgress(), 'a', true, T0);
    expect(state.lastStudiedAt).toBe(T0);
  });

  it('never mutates the state it was handed', () => {
    const original = emptyProgress();
    const snapshot = JSON.stringify(original);
    answer(original, 'a', true, T0);
    expect(JSON.stringify(original)).toBe(snapshot);
  });
});

describe('attempt history is bounded (grounding §6, practices C4)', () => {
  it('retains exactly the most recent 200 attempts', () => {
    let state = emptyProgress();
    for (let i = 0; i < ATTEMPT_HISTORY_LIMIT + 45; i += 1) {
      state = answer(state, `q${String(i)}`, i % 2 === 0, T0 + i).state;
    }
    expect(ATTEMPT_HISTORY_LIMIT).toBe(200);
    expect(state.attempts).toHaveLength(ATTEMPT_HISTORY_LIMIT);
    expect(state.attempts[0]!.questionId).toBe('q45');
    expect(state.attempts.at(-1)?.questionId).toBe('q244');
  });

  it('keeps the aggregate rollups intact when history is pruned', () => {
    let state = emptyProgress();
    for (let i = 0; i < 300; i += 1) {
      state = answer(state, `q${String(i)}`, true, T0 + i).state;
    }
    // 300 answers survive in the rollup even though only 200 attempts are kept.
    expect(topicStatOf(state, 'railroad')).toEqual({ seen: 300, correct: 300 });
    expect(Object.keys(state.cards)).toHaveLength(300);
  });
});

describe('completeSession', () => {
  it('counts finished sessions', () => {
    const state = completeSession(completeSession(emptyProgress(), T0), T0 + 1);
    expect(state.sessionsCompleted).toBe(2);
    expect(state.lastStudiedAt).toBe(T0 + 1);
  });
});

describe('overallAccuracy', () => {
  it('is zero with no history rather than NaN', () => {
    expect(overallAccuracy(emptyProgress())).toBe(0);
  });

  it('is a whole percent across every topic', () => {
    let state = emptyProgress();
    state = answer(state, 'a', true, T0).state;
    state = answer(state, 'b', false, T0 + 1).state;
    state = answer(state, 'c', true, T0 + 2, 'parking').state;
    expect(overallAccuracy(state)).toBe(67);
  });
});
