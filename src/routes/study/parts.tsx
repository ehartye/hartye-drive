import { SignPanel, SignSvg } from '~/components';
import { IconBook, IconChanged, IconChevronRight } from '~/components/Icon';
import type { Citation, Correction } from '~/content';
import { formatEffectiveDate } from './support';

/* ------------------------------------------------------- corrections notice */

export interface CorrectionNoticeProps {
  correction: Correction;
}

/**
 * The manual's content is current as of 1 July 2022 and says so. Where a fact
 * has since moved, the app teaches the version in force **and shows its
 * working**: what changed, when it took effect, and which public chapter did
 * it (practices D6, D10). It never silently rewrites the manual, and it never
 * gives the answer away — this sits above the choices, before the verdict.
 */
export function CorrectionNotice({ correction }: CorrectionNoticeProps) {
  return (
    <SignPanel variant="work" flat className="changed">
      <IconChanged size={17} />
      <p>
        <span className="eyebrow eyebrow--work mb-1 block">
          This rule moved after the manual was written
        </span>
        {correction.summary} We test the version in force today, not the 2022 text — the manual&rsquo;s
        own wording is still quoted with the answer, so you can see both.
        <span className="changed__when">
          {`In force since ${formatEffectiveDate(correction.effectiveDate)} · ${correction.authority}`}
        </span>
      </p>
    </SignPanel>
  );
}

/* ----------------------------------------------------------- manual lookup */

export interface ManualLookupProps {
  citation: Citation;
  /** How the manual names the section, for the attribution line. */
  section: string;
  /** Set when this passage is one the corrections notice above supersedes. */
  supersededNote?: string | undefined;
}

/**
 * The whole passage, before answering, opt-in. Looking it up is the behaviour
 * the app wants — this is a study tool, not an exam — so it is offered plainly
 * and costs nothing. A native `<details>`: keyboard-operable and announced as a
 * disclosure without a line of JavaScript.
 */
export function ManualLookup({ citation, section, supersededNote }: ManualLookupProps) {
  return (
    <details className="lookup">
      <summary>
        <IconBook size={17} />
        <span className="lookup__label">
          Look it up in the manual
          <small>The whole passage — it contains the answer</small>
        </span>
        <IconChevronRight size={16} className="lookup__chev" />
      </summary>
      <div className="lookup__body">
        <blockquote className="cite mt-2">
          <p className="cite__quote m-0">{`“${citation.quote}”`}</p>
          <cite className="cite__src">
            {`Tennessee Comprehensive Driver License Manual · ${section} · PDF p. ${String(citation.pdfPage)} (printed p. ${String(citation.printedPage)})`}
            <br />
            {supersededNote ?? 'Content current as of 1 July 2022'}
          </cite>
        </blockquote>
        <p className="dim text-[0.8125rem] mt-3.5 leading-normal">
          Opening this doesn&rsquo;t count against you — but you&rsquo;ll see this question again
          either way.
        </p>
      </div>
    </details>
  );
}

/* ------------------------------------------------------------ queued again */

export interface QueuedAgainProps {
  /** Straight from the scheduler, so the promise the screen makes is the real one. */
  sentence: string;
}

/**
 * The spaced-repetition promise, shown after a miss. A diamond, because this is
 * now content the learner is weak on — the one thing a diamond may mean (§2).
 * It reframes the wrong answer as a scheduling event, which is the whole reason
 * the incorrect screen does not read as punishment.
 */
export function QueuedAgain({ sentence }: QueuedAgainProps) {
  return (
    <SignPanel variant="plain" flat className="again mt-3.5">
      <SignSvg id="curve-right" size="sm" decorative className="flex-none" />
      <div>
        <p className="eyebrow eyebrow--warning mb-1">Queued again</p>
        <p className="dim text-[0.875rem] leading-normal">{sentence}</p>
      </div>
    </SignPanel>
  );
}
