import { describe, it, expect } from 'vitest';
import {
  EXAM_HISTORY_LIMIT,
  EXAM_RECORD_VERSION,
  attemptById,
  attemptFromState,
  boundExamAttempts,
  emptyExamRecord,
  latestAttempt,
  loadExamRecord,
  migrateExamRecord,
  openAttempt,
  recordExamAttempt,
  reportFromAttempt,
  resumableExam,
  serializeExamRecord,
  setActiveExam,
  stateFromAttempt,
} from './exam-history';
import type { ExamAttempt } from './exam-history';
import { answerExamQuestion, endExamEarly, startExam } from './exam';
import type { ExamArea, ExamCandidate, ExamState } from './exam';

const T0 = Date.UTC(2026, 7, 11, 9, 0, 0);

const AREAS: ExamArea[] = [
  { id: 'signs', share: 0.25 },
  { id: 'safe-driving', share: 0.25 },
  { id: 'rules-of-road', share: 0.25 },
  { id: 'alcohol-drugs', share: 0.25 },
];

const CANDIDATES: ExamCandidate[] = AREAS.flatMap((area) =>
  Array.from({ length: 30 }, (_, i) => ({
    id: `${area.id}-${String(i)}`,
    topic: `${area.id}-topic-${String(i % 3)}`,
    area: area.id,
  })),
);

function sitting(id: string, answers: number, wrongAt: (i: number) => boolean): ExamState {
  let state = startExam({ id, candidates: CANDIDATES, areas: AREAS, seed: 1, now: T0 });
  for (let i = 0; i < answers; i += 1) {
    state = answerExamQuestion(state, { chosenIndex: 0, correct: !wrongAt(i), at: T0 + i * 1000 });
  }
  return state;
}

function attempt(id: string, answers = 30): ExamAttempt {
  const state = sitting(id, answers, (i) => i % 6 === 0);
  const ended = state.endReason === null ? endExamEarly(state, T0 + 60_000) : state;
  const record = attemptFromState(ended, AREAS);
  if (!record) throw new Error('expected an ended attempt');
  return record;
}

/* ------------------------------------------------------------ the attempt */

describe('turning a finished sitting into a stored attempt', () => {
  it('keeps the score, the paper and every answer, so the review can be rebuilt', () => {
    const stored = attempt('a1', 12);
    expect(stored.id).toBe('a1');
    expect(stored.questions).toHaveLength(30);
    expect(stored.answers).toHaveLength(12);
    expect(stored.answered).toBe(12);
    expect(stored.outOf).toBe(30);
    expect(stored.endReason).toBe('ended-early');
    expect(stored.byArea.reduce((n, a) => n + a.asked, 0)).toBe(12);
  });

  it('refuses to store an attempt that has not ended', () => {
    const running = sitting('a2', 3, () => false);
    expect(attemptFromState(running, AREAS)).toBeNull();
  });

  it('carries the halted verdict when the seventh wrong ended it', () => {
    const state = sitting('a3', 30, () => true);
    const stored = attemptFromState(state, AREAS);
    expect(stored?.verdict).toBe('halted');
    expect(stored?.endReason).toBe('strikes');
    expect(stored?.answered).toBe(7);
  });
});

describe('rebuilding the report from a stored attempt', () => {
  it('recomputes the score rather than trusting a stored derivative', () => {
    const stored = attempt('a4', 12);
    const report = reportFromAttempt(stored, AREAS);
    expect(report.correct).toBe(stored.correct);
    expect(report.answered).toBe(stored.answered);
    expect(report.unasked).toBe(18);
    expect(report.verdict).toBe(stored.verdict);
    expect(report.byArea).toEqual(stored.byArea);
    expect(report.missedQuestionIds).toHaveLength(stored.wrong);
  });

  it('restores an attempt that ran out of time with its hour intact', () => {
    const halted = attempt('a5', 30);
    expect(stateFromAttempt(halted).deadlineAt - halted.startedAt).toBe(3_600_000);
  });
});

/* -------------------------------------------------------------- the store */

describe('the attempt history', () => {
  it('starts empty and knows it', () => {
    const record = emptyExamRecord();
    expect(record.attempts).toEqual([]);
    expect(record.active).toBeNull();
    expect(latestAttempt(record)).toBeUndefined();
  });

  it('keeps the newest attempt last and finds it by id', () => {
    let record = emptyExamRecord();
    record = recordExamAttempt(record, attempt('one'));
    record = recordExamAttempt(record, attempt('two'));
    expect(record.attempts.map((a) => a.id)).toEqual(['one', 'two']);
    expect(latestAttempt(record)?.id).toBe('two');
    expect(attemptById(record, 'one')?.id).toBe('one');
    expect(attemptById(record, 'nope')).toBeUndefined();
  });

  it('is bounded at 200 so the storage quota is never reached (grounding §6)', () => {
    const many = Array.from({ length: EXAM_HISTORY_LIMIT + 25 }, (_, i) => ({
      ...attempt('a'),
      id: `a${String(i)}`,
    }));
    const bounded = boundExamAttempts(many);
    expect(bounded).toHaveLength(EXAM_HISTORY_LIMIT);
    expect(bounded[0]?.id).toBe('a25');
    expect(bounded.at(-1)?.id).toBe(`a${String(EXAM_HISTORY_LIMIT + 24)}`);
  });

  it('prunes as attempts are recorded, not only on load', () => {
    let record = emptyExamRecord();
    for (let i = 0; i < EXAM_HISTORY_LIMIT + 5; i += 1) {
      record = recordExamAttempt(record, { ...attempt('a'), id: `a${String(i)}` });
    }
    expect(record.attempts).toHaveLength(EXAM_HISTORY_LIMIT);
    expect(latestAttempt(record)?.id).toBe(`a${String(EXAM_HISTORY_LIMIT + 4)}`);
  });

  it('clears the attempt in progress when one is filed', () => {
    const live = sitting('live', 3, () => false);
    const record = recordExamAttempt(setActiveExam(emptyExamRecord(), live), attempt('done'));
    expect(record.active).toBeNull();
  });
});

/* ------------------------------------------------- resuming an attempt */

describe('an attempt in progress', () => {
  it('is held so a reload does not silently destroy it', () => {
    const live = sitting('live', 4, () => false);
    const record = setActiveExam(emptyExamRecord(), live);
    expect(record.active?.answers).toHaveLength(4);
    expect(resumableExam(record, T0 + 300_000)?.id).toBe('live');
  });

  it('is not resumable once its hour is up — the clock kept running', () => {
    const record = setActiveExam(emptyExamRecord(), sitting('live', 4, () => false));
    expect(resumableExam(record, T0 + 3_600_001)).toBeNull();
    // Still *open*, though: it has to be scored and filed, not dropped.
    expect(openAttempt(record)?.id).toBe('live');
  });

  it('is no longer open once it has been ended', () => {
    const ended = endExamEarly(sitting('live', 4, () => false), T0 + 10_000);
    expect(openAttempt(setActiveExam(emptyExamRecord(), ended))).toBeNull();
    expect(openAttempt(emptyExamRecord())).toBeNull();
  });

  it('is not resumable once it has ended', () => {
    const ended = endExamEarly(sitting('live', 4, () => false), T0 + 10_000);
    expect(resumableExam(setActiveExam(emptyExamRecord(), ended), T0 + 20_000)).toBeNull();
  });

  it('is nothing at all when none was started', () => {
    expect(resumableExam(emptyExamRecord(), T0)).toBeNull();
  });
});

/* ------------------------------------------------------------ the envelope */

describe('the persisted envelope', () => {
  it('round-trips through serialization', () => {
    const record = recordExamAttempt(
      setActiveExam(emptyExamRecord(), sitting('live', 2, () => false)),
      attempt('one'),
    );
    const result = loadExamRecord(serializeExamRecord(record));
    expect(result.status).toBe('ok');
    expect(result.state.attempts.map((a) => a.id)).toEqual(['one']);
  });

  it('keeps an attempt in progress across a reload', () => {
    const record = setActiveExam(emptyExamRecord(), sitting('live', 2, () => false));
    const result = loadExamRecord(serializeExamRecord(record));
    expect(result.state.active?.id).toBe('live');
    expect(result.state.active?.answers).toHaveLength(2);
  });

  it('treats a missing key as empty rather than broken', () => {
    expect(loadExamRecord(null).status).toBe('empty');
    expect(loadExamRecord('').status).toBe('empty');
    expect(loadExamRecord(null).state.attempts).toEqual([]);
  });

  it('degrades a corrupt payload to a usable empty record', () => {
    const result = loadExamRecord('{not json');
    expect(result.status).toBe('corrupt');
    expect(result.state.attempts).toEqual([]);
    expect(result.detail).toBeTruthy();
  });

  it('degrades a payload of the wrong shape the same way', () => {
    expect(loadExamRecord(JSON.stringify({ version: 1 })).status).toBe('corrupt');
    expect(
      loadExamRecord(JSON.stringify({ version: 1, state: { attempts: 'nope', active: null } }))
        .status,
    ).toBe('corrupt');
    expect(
      loadExamRecord(JSON.stringify({ version: 1, state: { attempts: [{ id: 1 }], active: null } }))
        .status,
    ).toBe('corrupt');
  });

  it('leaves a future version alone instead of guessing at its shape', () => {
    const result = loadExamRecord(JSON.stringify({ version: 99, state: { attempts: [] } }));
    expect(result.status).toBe('future');
    expect(result.foundVersion).toBe(99);
    expect(result.state.attempts).toEqual([]);
  });

  it('migrates an unversioned payload rather than throwing it away', () => {
    const stored = attempt('old');
    const result = loadExamRecord(JSON.stringify({ state: { attempts: [stored] } }));
    expect(result.status).toBe('migrated');
    expect(result.fromVersion).toBe(0);
    expect(result.state.attempts.map((a) => a.id)).toEqual(['old']);
    expect(result.state.schemaVersion).toBe(EXAM_RECORD_VERSION);
  });

  it('drops an unreadable attempt in a v0 payload without losing the good ones', () => {
    const stored = attempt('good');
    const result = loadExamRecord(
      JSON.stringify({ state: { attempts: [stored, { id: 'bad' }], active: 'nonsense' } }),
    );
    expect(result.status).toBe('migrated');
    expect(result.state.attempts.map((a) => a.id)).toEqual(['good']);
    expect(result.state.active).toBeNull();
  });

  it('bounds the history on the way in, not only on the way out', () => {
    const many = Array.from({ length: EXAM_HISTORY_LIMIT + 3 }, (_, i) => ({
      ...attempt('a'),
      id: `a${String(i)}`,
    }));
    const result = loadExamRecord(
      JSON.stringify({ version: EXAM_RECORD_VERSION, state: { attempts: many, active: null } }),
    );
    expect(result.state.attempts).toHaveLength(EXAM_HISTORY_LIMIT);
  });

  it('refuses to migrate from a version it has never heard of', () => {
    expect(() => migrateExamRecord({ attempts: [] }, 7)).toThrow(/version 7/);
  });
});
