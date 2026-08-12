import type { SignEntry } from '~/signs/registry';
import { signDrillName, signName } from '~/signs/registry';
import { getSign } from '~/signs/signs';

export type SignSize = 'sm' | 'md' | 'lg' | 'xl' | 'hero';

export interface SignSvgProps {
  /** Registry id from `src/content/signs.json`, e.g. `r1-1-stop`. */
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
 *
 * Ids resolve against `src/content/signs.json`, the single source of truth for
 * the 87-sign registry, and all 87 faces are authored. The two fallbacks below
 * are kept for the 88th: a registry entry with no face renders a labelled
 * "art pending" plate carrying its MUTCD designation, and an id the registry
 * does not carry renders a dashed box tagged `data-missing-sign`. Both are
 * deliberately visible — a blank space is how a broken sign id survived a whole
 * phase unnoticed. `SignSvg.fallback.test.tsx` keeps both honest, and
 * `sign-references.test.ts` fails the build on an unresolvable id anywhere in
 * `src/`.
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
  const face = getSign(id);
  const geometry = face?.geometry;

  const classes = [
    'sign',
    SIZE_CLASS[size],
    geometry?.aspect === 'wide' ? 'sign--wide' : '',
    geometry?.aspect === 'tall' ? 'sign--tall' : '',
    face && !geometry ? 'sign--pending' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  if (!face) {
    // Never fail silently: an id the registry does not carry is a content bug,
    // and a blank space would hide it. Announce nothing, but show something.
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
    : ({ role: 'img', 'aria-label': label ?? accessibleName(face.entry, mode) } as const);

  if (!geometry) {
    // A real registry sign whose face P3 has not drawn yet. It keeps its full
    // accessible name — the registry knows the shape, colour and meaning — and
    // states its MUTCD designation on the plate so the gap is obvious on
    // screen and in a screenshot review.
    return (
      <svg
        viewBox="0 0 100 100"
        className={classes}
        data-pending-sign={face.entry.mutcd}
        {...a11y}
      >
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
        <text
          x={50}
          y={46}
          textAnchor="middle"
          fill="currentColor"
          fontSize={17}
          fontFamily="'Overpass Mono', monospace"
        >
          {face.entry.mutcd}
        </text>
        <text
          x={50}
          y={66}
          textAnchor="middle"
          fill="currentColor"
          fontSize={11}
          opacity={0.7}
          fontFamily="'Overpass', sans-serif"
        >
          art pending
        </text>
      </svg>
    );
  }

  return (
    <svg viewBox={geometry.viewBox} className={classes} {...a11y}>
      {geometry.draw(value)}
    </svg>
  );
}
