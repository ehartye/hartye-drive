/**
 * Presentation helpers for the exam simulator and its score reports. Nothing
 * here decides anything about sampling, scoring or the clock — that all lives
 * in `src/domain/exam.ts`.
 */
import { blueprintAreas } from '~/content';
import type { Citation, Question } from '~/content';
import type { ExamArea } from '~/domain/exam';

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

// Day-first for the date ("11 August"), 12-hour for the clock ("8:54 PM") —
// the stamp the ratified reports carry.
const WHEN_DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' });
const WHEN_TIME = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

/** "11 August, 8:54 PM" — the stamp the score report carries. */
export function formatAttemptWhen(at: number): string {
  const when = new Date(at);
  return `${WHEN_DAY.format(when)}, ${WHEN_TIME.format(when)}`;
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
