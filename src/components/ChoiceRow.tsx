import type { ReactNode } from 'react';
import { IconCheck, IconX } from './Icon';

/**
 * `neutral`   — not yet judged.
 * `correct`   — the keyed answer, once the verdict is out.
 * `incorrect` — a wrong answer the learner picked.
 * `muted`     — neither picked nor correct; de-emphasised.
 *
 * The fifth state, **picked-verdict-withheld**, is not in this union on
 * purpose: it is `picked` with `state="neutral"`, and it is carried by
 * `aria-pressed` rather than a class, so it cannot be faked. In exam mode any
 * colour on a selection would leak the answer, so that treatment is
 * deliberately achromatic (grounding §3).
 */
export type ChoiceState = 'neutral' | 'correct' | 'incorrect' | 'muted';

export interface ChoiceRowProps {
  /** A / B / C. */
  letter: string;
  children: ReactNode;
  state?: ChoiceState;
  /** Did the learner choose this one? Drives `aria-pressed`. */
  picked?: boolean;
  /** Once the verdict is out the row is inert but still readable. */
  disabled?: boolean;
  onSelect?: () => void;
}

const STATE_CLASS: Record<ChoiceState, string> = {
  neutral: '',
  correct: 'choice--correct',
  incorrect: 'choice--wrong',
  muted: 'choice--muted',
};

/** Correct/incorrect always pair colour with an icon AND a word (§5, A3). */
function verdictFor(state: ChoiceState, picked: boolean) {
  if (state === 'correct') {
    return {
      className: 'verdict verdict--ok',
      icon: <IconCheck size={14} />,
      text: picked ? 'Your answer · correct' : 'Correct answer',
    };
  }
  if (state === 'incorrect') {
    return {
      className: 'verdict verdict--bad',
      icon: <IconX size={14} />,
      text: 'Your answer · incorrect',
    };
  }
  return null;
}

export function ChoiceRow({
  letter,
  children,
  state = 'neutral',
  picked = false,
  disabled = false,
  onSelect,
}: ChoiceRowProps) {
  const classes = ['choice', STATE_CLASS[state]].filter(Boolean).join(' ');
  const verdict = verdictFor(state, picked);

  return (
    <button
      type="button"
      className={classes}
      aria-pressed={picked}
      aria-disabled={disabled || undefined}
      onClick={() => {
        if (disabled) return;
        onSelect?.();
      }}
    >
      {/* The letter stays in the accessible name: the explanation that follows
          says "the answer is A", and that has to mean something out loud. */}
      <span className="choice__key">{letter}</span>
      <span className="choice__body">
        <span className="choice__text">{children}</span>
        {verdict && (
          <span className={verdict.className}>
            {verdict.icon}
            {verdict.text}
          </span>
        )}
      </span>
    </button>
  );
}
