/**
 * Typed entry point for the content bank.
 *
 * Two loading strategies on purpose:
 *
 *  - **Static** for the small files the shell always needs (topic taxonomy,
 *    post-2022 corrections, the never-generate list). Together they are under
 *    25 KB raw.
 *  - **Async** for the three large files (`questions.json` is ~570 KB raw,
 *    `rules.json` ~270 KB, `signs.json` ~45 KB). These are dynamic imports so
 *    the bundler puts them in their own chunks and the initial JS budget in
 *    `executable-floor.md` X8 stays intact. Await them from the route that
 *    needs them, not from the app shell.
 *
 * Everything here is data plus types. Scoring, scheduling and exam sampling
 * live in `src/domain/`, not in this file.
 */
import taxonomyData from './taxonomy.json';
import correctionsData from './corrections.json';
import neverGenerateData from './never-generate.json';
import type {
  Correction,
  ManualRule,
  NeverGenerateEntry,
  Question,
  QuestionBank,
  SignEntry,
  SignRegistry,
  Taxonomy,
  TopicDefinition,
} from './types';

export type * from './types';

export const taxonomy = taxonomyData as unknown as Taxonomy;
export const topics: TopicDefinition[] = taxonomy.topics;
export const blueprintAreas = taxonomy.blueprint.areas;

export const corrections = correctionsData.corrections as unknown as Correction[];
export const neverGenerate = neverGenerateData.entries as unknown as NeverGenerateEntry[];

/** The question bank, ~500 questions. Lazily loaded — see the note above. */
export async function loadQuestionBank(): Promise<QuestionBank> {
  const mod = await import('./questions.json');
  return mod.default as unknown as QuestionBank;
}

/** The sign registry. Lazily loaded. */
export async function loadSignRegistry(): Promise<SignRegistry> {
  const mod = await import('./signs.json');
  return mod.default as unknown as SignRegistry;
}

/**
 * The 533 manual rules the questions were drawn from, each with its verbatim
 * quote and page. Backs the rule-reference surface a citation links to.
 */
export async function loadRules(): Promise<ManualRule[]> {
  const mod = await import('./rules.json');
  return (mod.default as unknown as { rules: ManualRule[] }).rules;
}

export function topicById(id: string): TopicDefinition | undefined {
  return topics.find((t) => t.id === id);
}

export function correctionById(id: string): Correction | undefined {
  return corrections.find((c) => c.id === id);
}

/** Index a loaded bank by question id, for citation and review lookups. */
export function indexQuestions(bank: QuestionBank): Map<string, Question> {
  return new Map(bank.questions.map((q) => [q.id, q]));
}

/** Index a loaded registry by sign id. */
export function indexSigns(registry: SignRegistry): Map<string, SignEntry> {
  return new Map(registry.signs.map((s) => [s.id, s]));
}
