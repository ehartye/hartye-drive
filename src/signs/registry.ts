/**
 * SIGN REGISTRY — P1 SEED.
 *
 * The registry is the data behind `SignSvg`. This file ships the handful of
 * signs the foundation itself needs (nav, gallery, empty/error states, the
 * verdict octagon) with spec-accurate geometry, so the renderer and its
 * accessible-name contract are real and testable from day one.
 *
 * **P3 owns growing this to the ≥80 entries `executable-floor.md` §3b
 * requires**, authored from `docs/research/manual-spine.md` and the MUTCD
 * designation — not from the Phase-1 mockup sprite, three of whose signs were
 * factually wrong before they were caught. Every entry below carries its MUTCD
 * designation because `npm run audit:signs` fails a sign without one.
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

export type SignCategory =
  | 'regulatory'
  | 'warning'
  | 'guide'
  | 'services'
  | 'school'
  | 'construction'
  | 'railroad';

/** The colours a face may use. `audit:signs` asserts nothing outside this list renders. */
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

export interface SignEntry {
  /** Stable id used by questions, the drill, and the library. */
  readonly id: string;
  /** MUTCD designation. A sign with no designation fails `npm run audit:signs`. */
  readonly mutcd: string;
  /** Plain name, as the manual writes it. */
  readonly name: string;
  readonly category: SignCategory;
  /** Shape as a learner would say it, e.g. "Octagon". Half of the drill name. */
  readonly shape: string;
  /** Colour as a learner would say it, e.g. "red". The other half. */
  readonly color: string;
  /** What it means. Present in the labelled name, absent in drill mode. */
  readonly meaning: string;
  /** Every colour the SVG paints, declared. */
  readonly palette: readonly string[];
  readonly viewBox: string;
  /** Aspect helper so a non-square face is not letterboxed. */
  readonly aspect?: 'wide' | 'tall';
  readonly draw: (value?: number) => ReactNode;
}

/** The registry is indexed by id; `SignSvg` resolves through this map. */
export type SignId = string;

/** The labelled accessible name: shape AND colour AND meaning (practices A8). */
export function signName(entry: SignEntry): string {
  return `${entry.shape}, ${entry.color} — ${entry.meaning}`;
}

/** The drill name: shape and colour only — the meaning is the answer. */
export function signDrillName(entry: SignEntry): string {
  return `${entry.shape}, ${entry.color}`;
}
