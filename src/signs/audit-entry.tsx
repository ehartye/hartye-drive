/**
 * The bridge `scripts/audit-signs.mjs` bundles and imports.
 *
 * It exists so the gate audits **the component the app actually ships**, not a
 * parallel description of it: every record below comes from rendering the real
 * `SignSvg` with the real registry entry, so an accessible name or a colour
 * that is wrong on screen is wrong here too.
 *
 * Nothing in the application imports this module — it is bundled only by the
 * audit script, and never reaches the browser build.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { SignSvg } from '~/components/SignSvg';
import questionsJson from '~/content/questions.json';
import registryJson from '~/content/signs.json';
import type { QuestionBank, SignRegistry } from '~/content/types';
import type { AuditQuestion } from './audit';
import { SIGN_GEOMETRY, allSigns } from './signs';

export { auditSigns, MIN_DRAWN_SIGNS } from './audit';
export type { AuditFailure, AuditInput, RenderedSign } from './audit';

export const registry = registryJson as unknown as SignRegistry;

const bank = questionsJson as unknown as QuestionBank;

export const questions: AuditQuestion[] = bank.questions.map((question) => ({
  id: question.id,
  stem: question.stem,
  options: question.options.map((option) => ({ text: option.text })),
  correctIndex: question.correctIndex,
  signs: question.signs,
}));

/** Everything the harness needs about one sign, straight from a real render. */
export interface SignRenderRecord {
  readonly id: string;
  readonly mutcd: string;
  readonly label: string;
  readonly category: string;
  readonly drawn: boolean;
  readonly viewBox: string;
  /** The declared face outline, as path data in the geometry's own units. */
  readonly face: string;
  readonly aspect: 'wide' | 'tall' | 'square';
  /** `SignSvg` output in labelled mode — what the contact sheet shows. */
  readonly svg: string;
  readonly paints: string[];
  readonly name: string;
  readonly drillName: string;
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#x27;': "'",
  '&#39;': "'",
};

const decode = (value: string): string =>
  value.replace(/&(?:amp|lt|gt|quot|#x27|#39);/g, (match) => ENTITIES[match] ?? match);

function ariaLabel(markup: string): string {
  const match = /aria-label="([^"]*)"/.exec(markup);
  return match?.[1] === undefined ? '' : decode(match[1]);
}

/**
 * Every colour the markup paints. Read off `fill`/`stroke` attributes rather
 * than off the geometry's own declaration, because the point of the check is to
 * catch a face that paints something its entry never claimed.
 */
function paintsIn(markup: string): string[] {
  const found = new Set<string>();
  for (const match of markup.matchAll(/(?:fill|stroke)="([^"]+)"/g)) {
    const value = match[1]?.trim().toLowerCase();
    if (value !== undefined && value !== '') found.add(value);
  }
  return [...found];
}

export function collectRenders(): SignRenderRecord[] {
  return allSigns.map((entry) => {
    const geometry = SIGN_GEOMETRY.get(entry.id);
    const svg = renderToStaticMarkup(<SignSvg id={entry.id} />);
    const drill = renderToStaticMarkup(<SignSvg id={entry.id} mode="drill" />);
    return {
      id: entry.id,
      mutcd: entry.mutcd,
      label: entry.name,
      category: entry.category,
      drawn: geometry !== undefined,
      viewBox: geometry?.viewBox ?? '0 0 100 100',
      face: geometry?.face ?? '',
      aspect: geometry?.aspect ?? 'square',
      svg,
      paints: paintsIn(svg),
      name: ariaLabel(svg),
      drillName: ariaLabel(drill),
    };
  });
}
