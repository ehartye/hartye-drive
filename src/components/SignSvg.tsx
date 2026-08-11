import type { SignEntry } from '~/signs/registry';
import { signDrillName, signName } from '~/signs/registry';
import { getSign } from '~/signs/signs';

export type SignSize = 'sm' | 'md' | 'lg' | 'xl' | 'hero';

export interface SignSvgProps {
  /** Registry id. */
  id: string;
  size?: SignSize;
  /**
   * `labeled` names shape + colour + meaning (practices A8).
   * `drill` withholds the meaning — that is the question being asked.
   */
  mode?: 'labeled' | 'drill';
  /** Purely ornamental beside text that already says the same thing. */
  decorative?: boolean;
  /** Overrides the accessible name entirely; use only when the caller says more. */
  label?: string;
  /** For signs whose legend is data (R2-1 SPEED LIMIT). */
  value?: number;
  className?: string;
}

const SIZE_CLASS: Record<SignSize, string> = {
  sm: 'sign--sm',
  md: '',
  lg: 'sign--lg',
  xl: 'sign--xl',
  hero: 'sign--hero',
};

function accessibleName(entry: SignEntry, mode: 'labeled' | 'drill'): string {
  return mode === 'drill' ? signDrillName(entry) : signName(entry);
}

/**
 * The MUTCD sign renderer. Every sign in the app is spec-accurate,
 * hand-authored SVG — correct shape, correct colour, correct proportion. There
 * is no clipart and no photography anywhere in this product (grounding §2).
 */
export function SignSvg({
  id,
  size = 'md',
  mode = 'labeled',
  decorative = false,
  label,
  value,
  className,
}: SignSvgProps) {
  const entry = getSign(id);

  const classes = [
    'sign',
    SIZE_CLASS[size],
    entry?.aspect === 'wide' ? 'sign--wide' : '',
    entry?.aspect === 'tall' ? 'sign--tall' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  if (!entry) {
    // Never fail silently: an unknown id is a content bug, and a blank space
    // would hide it. Announce nothing, but show something.
    return (
      <svg viewBox="0 0 100 100" className={classes} aria-hidden="true" data-missing-sign={id}>
        <rect
          x={2}
          y={2}
          width={96}
          height={96}
          rx={6}
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeDasharray="7 6"
          opacity={0.6}
        />
      </svg>
    );
  }

  const a11y = decorative
    ? ({ 'aria-hidden': true } as const)
    : ({ role: 'img', 'aria-label': label ?? accessibleName(entry, mode) } as const);

  return (
    <svg viewBox={entry.viewBox} className={classes} {...a11y}>
      {entry.draw(value)}
    </svg>
  );
}
