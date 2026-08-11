import { useId } from 'react';
import type { ReactNode } from 'react';
import { SignSvg } from './SignSvg';

export interface QuestionCardProps {
  /** Small legend above the stem, e.g. "Adaptive session". */
  eyebrow?: string;
  /** Topic path, e.g. "Sharing the road · School buses". */
  topic?: string;
  /** Registry id of a sign that belongs with the topic. Decorative here. */
  signId?: string;
  /** The question itself. Set in Overpass — the stem is "the sign" (§2). */
  stem: string;
  /** Announced once when the verdict resolves (practices A9). */
  announcement?: string;
  /** The `ChoiceRow`s. */
  children: ReactNode;
  /**
   * The stem is the page's `<h1>` in a real session — it is what the screen is
   * about. Drop to 2 only where the card is embedded in a page that already has
   * one, so headings never skip a level (practices A10).
   */
  headingLevel?: 1 | 2;
}

export function QuestionCard({
  eyebrow,
  topic,
  signId,
  stem,
  announcement,
  children,
  headingLevel = 1,
}: QuestionCardProps) {
  const stemId = useId();
  const Heading = headingLevel === 1 ? 'h1' : 'h2';

  return (
    <div>
      {(eyebrow ?? topic ?? signId) && (
        <div className="row">
          {signId && <SignSvg id={signId} size="sm" decorative />}
          <div>
            {eyebrow && <p className="eyebrow mb-[0.15rem]">{eyebrow}</p>}
            {topic && <p className="dim text-sm">{topic}</p>}
          </div>
        </div>
      )}

      <Heading className="stem mt-5" id={stemId}>
        {stem}
      </Heading>

      {/* One live region per question, updated only when the verdict resolves,
          so it announces once rather than on every render. */}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement ?? ''}
      </p>

      <div className="grid gap-2.5 mt-5" role="group" aria-labelledby={stemId}>
        {children}
      </div>
    </div>
  );
}
