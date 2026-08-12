/**
 * A learner's record, built from nothing, for the reviewer and the sweeps.
 *
 * The progress surface's states are functions of what is in `localStorage`, so
 * they are driven the way the app itself would be driven — by writing real,
 * schema-valid payloads and loading the page. Nothing in `src/` knows this file
 * exists, and no state is reachable through a query parameter that fabricates
 * data: a screen a reviewer can only see by lying to the app is not evidence
 * that the screen works.
 *
 * Payload shapes are `src/domain/progress.ts` and `src/domain/exam-history.ts`
 * at schema version 1; both stores' shape guards reject anything else, which is
 * what keeps this file honest.
 */

export const PROGRESS_KEY = 'tn-drive:progress';
export const EXAM_KEY = 'tn-drive:exams';

const DAY = 86_400_000;

/** Real taxonomy ids, so every topic resolves to its published label and area. */
const TOPICS: readonly { id: string; area: string }[] = [
  { id: 'regulatory-signs', area: 'signs' },
  { id: 'warning-signs', area: 'signs' },
  { id: 'traffic-signals', area: 'signs' },
  { id: 'right-of-way', area: 'rules-of-road' },
  { id: 'required-stops', area: 'rules-of-road' },
  { id: 'lane-use-and-passing', area: 'rules-of-road' },
  { id: 'speed-limits', area: 'rules-of-road' },
  { id: 'following-and-stopping-distance', area: 'safe-driving' },
  { id: 'night-driving', area: 'safe-driving' },
  { id: 'adverse-weather', area: 'safe-driving' },
  { id: 'dui-law', area: 'alcohol-drugs' },
  { id: 'alcohol-effects', area: 'alcohol-drugs' },
];

export interface SeedOptions {
  /** How many study sittings to lay down, oldest first. */
  sittings: number;
  /** How many mock exams to scatter through them. */
  exams: number;
  /** Questions per sitting. */
  perSitting?: number;
  /** The moment "now" is anchored to; sittings run backwards from here. */
  now?: number;
  /** Accuracy at the first sitting and at the last, as fractions. */
  from?: number;
  to?: number;
}

/** Keyed by storage key, so a caller can hand it straight to `setItem`. */
export type Seed = Record<string, string>;

interface Attempt {
  questionId: string;
  topic: string;
  area: string;
  chosenIndex: number;
  correct: boolean;
  at: number;
}

/**
 * A learner who improves. Accuracy climbs linearly from `from` to `to`, and a
 * deterministic pattern decides which answers were wrong — no randomness, so a
 * screenshot taken today matches one taken next week.
 */
export function buildSeed(options: SeedOptions): Seed {
  const {
    sittings,
    exams,
    perSitting = 12,
    now = Date.UTC(2026, 7, 11, 18, 30),
    from = 0.25,
    to = 0.86,
  } = options;

  const attempts: Attempt[] = [];
  const topics: Record<string, { seen: number; correct: number }> = {};
  const cards: Record<string, unknown> = {};

  const examAt: number[] = [];
  const examEvery = exams > 0 ? Math.max(1, Math.floor(sittings / exams)) : Number.MAX_SAFE_INTEGER;

  let counter = 0;
  for (let sitting = 0; sitting < sittings; sitting += 1) {
    const ratio = sittings === 1 ? 1 : sitting / (sittings - 1);
    const accuracy = from + (to - from) * ratio;
    // Two days between sittings, oldest first, each an hour long at most.
    const startedAt = now - (sittings - 1 - sitting) * 2 * DAY;

    for (let i = 0; i < perSitting; i += 1) {
      // A sitting covers two or three topics, the way an adaptive session does
      // — not one question from each of twelve.
      const topic = TOPICS[(sitting * 3 + (i % 3)) % TOPICS.length];
      if (!topic) continue;
      // Deterministic: the i-th answer is right when it falls under the
      // sitting's accuracy, spread evenly rather than clustered at the front.
      const correct = ((i * 7) % perSitting) / perSitting < accuracy;
      const at = startedAt + i * 40_000;
      const questionId = `sig-${String(100 + (counter % 240))}`;

      attempts.push({ questionId, topic: topic.id, area: topic.area, chosenIndex: 0, correct, at });

      const stat = topics[topic.id] ?? { seen: 0, correct: 0 };
      topics[topic.id] = { seen: stat.seen + 1, correct: stat.correct + (correct ? 1 : 0) };

      cards[questionId] = {
        questionId,
        topic: topic.id,
        box: correct ? 2 : 0,
        streak: correct ? 2 : 0,
        lapses: correct ? 0 : 1,
        seen: 1,
        correct: correct ? 1 : 0,
        dueAt: at + DAY,
        lastSeenAt: at,
      };
      counter += 1;
    }

    if (exams > 0 && sitting % examEvery === 0 && examAt.length < exams) {
      // A mock exam sits in its own window, well clear of the sitting above, so
      // the two are never mistaken for one another.
      examAt.push(startedAt + 6 * 3_600_000);
    }
  }

  // The store keeps only the most recent 200 answers (grounding §6). Pruning
  // here as well means the seed is exactly what the app would have written.
  const kept = attempts.slice(Math.max(0, attempts.length - 200));

  const examAttempts = examAt.map((startedAt, index) => {
    const ratio = examAt.length === 1 ? 1 : index / (examAt.length - 1);
    const score = Math.round(30 * (from + (to - from) * ratio));
    // The real rule: seven wrong ends it before question 30, so a failed
    // attempt has exactly seven wrong and stops at `correct + 7` questions.
    // A paper that reaches thirty with six or fewer wrong has already passed.
    const halted = 30 - score > 6;
    const correct = halted ? Math.min(score, 23) : score;
    return {
      id: `exam-${String(index + 1)}`,
      seed: 1000 + index,
      startedAt,
      endedAt: startedAt + (1_500 + index * 60) * 1000,
      endReason: halted ? 'strikes' : 'completed',
      verdict: halted ? 'halted' : 'pass',
      correct,
      wrong: halted ? 7 : 30 - correct,
      answered: halted ? correct + 7 : 30,
      outOf: 30,
      elapsedSeconds: 1500 + index * 60,
      byArea: [],
      questions: [],
      answers: [],
    };
  });

  const lastAt = kept.at(-1)?.at ?? null;

  return {
    [PROGRESS_KEY]: JSON.stringify({
      version: 1,
      state: {
        schemaVersion: 1,
        cards,
        topics,
        attempts: kept,
        sessionsCompleted: sittings,
        lastStudiedAt: lastAt,
      },
    }),
    [EXAM_KEY]: JSON.stringify({
      version: 1,
      state: { schemaVersion: 1, attempts: examAttempts, active: null },
    }),
  };
}

/** A steady learner: enough history to populate, short enough to read at once. */
export const POPULATED = (): Seed => buildSeed({ sittings: 12, exams: 4 });

/**
 * 57 sittings — the density test the state matrix asks for (cell 9-long).
 *
 * Four questions a sitting rather than twelve, on purpose: the attempt log is
 * capped at 200 answers, so a learner who studies in short bursts is the one
 * who actually reaches fifty-plus retained sittings, and that is the case that
 * puts fifty readings on one chart.
 */
export const LONG_HISTORY = (): Seed =>
  buildSeed({ sittings: 57, exams: 10, perSitting: 4, from: 0.18, to: 0.88 });
