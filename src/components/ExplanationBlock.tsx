import { useId } from 'react';
import type { ReactNode } from 'react';
import { SignPanel } from './SignPanel';
import { CitationLink } from './CitationLink';
import { IconCheck, IconX } from './Icon';
import { ruleHref } from '~/app/hrefs';

export interface Citation {
  /** Manual section, as the manual names it. */
  section: string;
  /**
   * Both numbers, always. The manual's own answer pointers use *printed*
   * numbers while a PDF reader uses the PDF page; mixing them silently sends a
   * learner to the wrong page (practices D16). `printed = pdf − 14` for
   * PDF pp. 15–132.
   */
  pdfPage: number;
  printedPage: number;
  /** Verbatim from the manual. The build validates it appears there (D1/D2). */
  quote: string;
  /**
   * The rule in `rules.json` this citation came from. Given one, the citation
   * resolves to `/rules/:id` on its own — which is what turns a footnote into
   * something a learner can actually follow.
   */
  ruleId?: string | undefined;
  /** An explicit destination, for the rare citation that points elsewhere. */
  to?: string;
}

export interface ExplanationBlockProps {
  /** The rule in the app's own words. Set in Newsreader — this is "the manual". */
  children: ReactNode;
  citation: Citation;
  verdict?: 'correct' | 'incorrect';
  /** The keyed answer, so the verdict can name it. */
  answerLetter?: string;
}

/**
 * Rule + verbatim manual quote + citation. Every answer in this product is
 * backed by one of these; a question without a citation fails the build.
 */
export function ExplanationBlock({
  children,
  citation,
  verdict,
  answerLetter,
}: ExplanationBlockProps) {
  const headingId = useId();
  // A citation that names its rule resolves itself. Callers do not have to know
  // the shape of the rule-reference URL, and none of them can get it wrong.
  const destination = citation.to ?? (citation.ruleId ? ruleHref(citation.ruleId) : undefined);

  return (
    // Guide green regardless of the verdict: the panel is the rule, and the
    // rule is always the thing that lets you proceed.
    <SignPanel as="section" variant="guide" aria-labelledby={headingId}>
      <p className="eyebrow eyebrow--guide" id={headingId}>
        The rule
      </p>

      {verdict && (
        <p className={`verdict ${verdict === 'correct' ? 'verdict--ok' : 'verdict--bad'} mt-0`}>
          {verdict === 'correct' ? <IconCheck size={14} /> : <IconX size={14} />}
          {verdict === 'correct'
            ? 'Correct'
            : `Incorrect · the answer is ${answerLetter ?? '—'}`}
        </p>
      )}

      <div className="read mt-2.5">{children}</div>

      <blockquote className="cite">
        <p className="cite__quote">{`“${citation.quote}”`}</p>
        <cite className="cite__src">
          {`Tennessee Comprehensive Driver License Manual · ${citation.section} · PDF p. ${citation.pdfPage} (printed p. ${citation.printedPage})`}
        </cite>
      </blockquote>

      {destination && (
        <p className="mt-3">
          <CitationLink to={destination} section={citation.section} pdfPage={citation.pdfPage} />
        </p>
      )}
    </SignPanel>
  );
}
