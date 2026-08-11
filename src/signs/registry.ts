/**
 * SIGN REGISTRY — the seam between content and geometry.
 *
 * `src/content/signs.json` is the **single source of truth** for what a sign
 * is: its id, MUTCD designation, name, category, shape, declared colours, plain
 * meaning and manual citation. It carries 87 entries and is validated by
 * `scripts/validate-content.mjs`, which the build now runs.
 *
 * This folder owns one thing the registry cannot express in JSON: **geometry**,
 * the hand-authored MUTCD SVG a face is drawn from. There is no clipart and no
 * photography anywhere in this product (grounding §2).
 *
 * Geometry is keyed by registry id, so the two halves cannot drift apart. P1
 * ships geometry for 13 of the 87; the remaining 74 render a visible
 * "art pending" placeholder rather than nothing, and **P3 owns drawing them**
 * (`executable-floor.md` §3b). `geometry.test.ts` fails the build if a geometry
 * entry ever names an id the registry does not carry.
 *
 * Geometry rules held here, and to be held by P3:
 *   - a sign face uses its TRUE MUTCD colour, even where it clashes with the
 *     surrounding panel (grounding §2). Accuracy outranks harmony.
 *   - school / pedestrian / bicycle warning is FLUORESCENT YELLOW-GREEN
 *     (#C7EA00). Fluorescent pink (#EE5FA7) is incident management, a
 *     different thing entirely.
 *   - R1-2 YIELD is a WHITE triangle with a wide RED border and a RED legend.
 *   - W10-1 carries an X, never a +.
 */
import type { ReactNode } from 'react';
import registryJson from '~/content/signs.json' with { type: 'json' };
import type { SignCategory, SignEntry, SignRegistry, SignShape } from '~/content/types';

/**
 * Re-exported from the content schema on purpose: the category vocabulary has
 * exactly one definition (`work-zone`, `service`), not a second one here that
 * says `construction` and `services`.
 */
export type { SignCategory, SignEntry, SignShape };

/** The registry as loaded. Static, because `SignSvg` is in the app shell. */
const registry = registryJson as unknown as SignRegistry;

/** Indexed by registry id; `SignSvg` resolves through this map. */
export const SIGN_REGISTRY: ReadonlyMap<string, SignEntry> = new Map(
  registry.signs.map((sign) => [sign.id, sign]),
);

/** A registry id, e.g. `r1-1-stop`. */
export type SignId = string;

/** The colours a face may paint. `audit:signs` asserts nothing else renders. */
export const MUTCD_COLORS = {
  red: '#B4151C',
  white: '#F2F4F1',
  black: '#14161A',
  yellow: '#FFCC00',
  green: '#04684E',
  orange: '#E35205',
  blue: '#003F87',
  fluorescentYellowGreen: '#C7EA00',
  fluorescentPink: '#EE5FA7',
} as const;

/** Everything needed to draw a face, and nothing that describes it. */
export interface SignGeometry {
  readonly viewBox: string;
  /** Aspect helper so a non-square face is not letterboxed. */
  readonly aspect?: 'wide' | 'tall';
  /** Every colour the SVG paints, declared. */
  readonly palette: readonly string[];
  readonly draw: (value?: number) => ReactNode;
}

/** A registry entry joined to its geometry, when P1 has drawn one. */
export interface SignFace {
  readonly entry: SignEntry;
  readonly geometry: SignGeometry | undefined;
}

/**
 * How a learner says the shape aloud. Exhaustive over the content schema's
 * `SignShape`, so adding a shape there fails typecheck here rather than
 * producing a nameless sign.
 */
const SHAPE_LABEL: Record<SignShape, string> = {
  octagon: 'Octagon',
  'triangle-down': 'Downward triangle',
  circle: 'Circle',
  crossbuck: 'Crossbuck — two crossed blades (an X)',
  diamond: 'Diamond',
  'rectangle-horizontal': 'Horizontal rectangle',
  'rectangle-vertical': 'Vertical rectangle',
  square: 'Square',
  pennant: 'Pennant',
  pentagon: 'Pentagon',
  shield: 'Shield',
  trapezoid: 'Trapezoid',
};

/** Palette tokens a learner would not say hyphenated. */
const COLOR_LABEL: Readonly<Record<string, string>> = {
  'fluorescent-yellow-green': 'fluorescent yellow-green',
  'fluorescent-pink': 'fluorescent pink',
};

export function shapeLabel(shape: SignShape): string {
  return SHAPE_LABEL[shape];
}

export function colorLabel(token: string): string {
  return COLOR_LABEL[token] ?? token;
}

/** The labelled accessible name: shape AND colour AND meaning (practices A8). */
export function signName(entry: SignEntry): string {
  return `${signDrillName(entry)} — ${entry.meaning}`;
}

/** The drill name: shape and colour only — the meaning is the answer. */
export function signDrillName(entry: SignEntry): string {
  return `${shapeLabel(entry.shape)}, ${colorLabel(entry.faceColor)}`;
}
