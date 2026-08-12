/**
 * Presentation helpers for the exam simulator and its score reports. Nothing
 * here decides anything about sampling, scoring or the clock — that all lives
 * in `src/domain/exam.ts`.
 */
import { blueprintAreas } from '~/content';
import type { Citation, Question } from '~/content';
import type { ExamArea } from '~/domain/exam';
import { formatAt } from '../progress/format';

/**
 * The four published areas, as the engine wants them. Read straight from the
 * taxonomy so the 25/25/25/25 the sampler enforces is traceable to the manual
 * (PDF p.35) rather than retyped here.
 */
export const EXAM_AREAS: readonly ExamArea[] = blueprintAreas.map((area) => ({
  id: area.id,
  share: area.share,
}));

export function areaLabel(id: string): string {
  return blueprintAreas.find((area) => area.id === id)?.label ?? id;
}

/** "Traffic signs and signals and rules of the road", lower-cased mid-sentence. */
export function joinAreaLabels(ids: readonly string[]): string {
  const labels = ids.map((id) => areaLabel(id).toLowerCase());
  if (labels.length <= 1) return labels[0] ?? '';
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1] ?? ''}`;
}

/**
 * "Aug 12, 9:09 am" — the stamp the score report carries, and the identical
 * one the progress history carries for the same attempt.
 *
 * This was `en-GB` day-first ("12 August, 9:09 AM"), the only non-`en-US`
 * formatter in the app, so one mock exam was dated two ways on the two screens
 * that both name it. `progress/format.ts` owns the app's dates and pins the
 * locale for a reason it states; the report now reads through it.
 */
export function formatAttemptWhen(at: number): string {
  return formatAt(at);
}

/** Both page numbers, always: the manual's own pointers use the printed one. */
export function citationLine(section: string, citation: Citation): string {
  return `Manual · ${section} · PDF p. ${String(citation.pdfPage)} (printed p. ${String(citation.printedPage)})`;
}

export function optionLetter(question: Question | undefined, index: number): string {
  return question?.options[index]?.letter ?? '—';
}

export function optionText(question: Question | undefined, index: number): string {
  return question?.options[index]?.text ?? 'This option is no longer in the question bank.';
}

/**
 * A fresh attempt id. `crypto.randomUUID` needs a secure context, which
 * `localhost` and any real deployment are; the fallback keeps a plain-http LAN
 * preview working rather than throwing in the middle of starting an exam.
 */
export function newAttemptId(): string {
  const source: Crypto | undefined = typeof crypto === 'undefined' ? undefined : crypto;
  if (source && typeof source.randomUUID === 'function') return source.randomUUID();
  return `exam-${String(Date.now())}-${Math.random().toString(36).slice(2, 10)}`;
}
