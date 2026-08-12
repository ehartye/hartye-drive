/**
 * Hand-authored MUTCD geometry, **keyed by registry id**. No clipart and no
 * photography anywhere in this product (grounding §2 signature).
 *
 * This file holds geometry only. Everything that *describes* a sign — MUTCD
 * designation, name, category, shape, colours, meaning, citation — comes from
 * `src/content/signs.json`, the single source of truth. See `registry.ts`.
 *
 * The faces themselves live in `./geometry/`, one file per sign family, so a
 * family reads as a family. Every id below exists in the registry and every
 * registry id has a face: `geometry.test.ts` fails the build on either gap, and
 * `npm run audit:signs` re-checks it in a real browser against the MUTCD
 * designation, the declared colours and the legend's measured bounding box.
 */
import type { SignEntry, SignFace, SignGeometry } from './registry';
import { SIGN_REGISTRY } from './registry';
import { GUIDE } from './geometry/guide';
import { RAILROAD } from './geometry/railroad';
import { REGULATORY } from './geometry/regulatory';
import { SCHOOL } from './geometry/school';
import { WARNING } from './geometry/warning';
import { WORK_ZONE } from './geometry/workzone';

const geometry: Readonly<Record<string, SignGeometry>> = {
  ...REGULATORY,
  ...SCHOOL,
  ...WARNING,
  ...WORK_ZONE,
  ...RAILROAD,
  ...GUIDE,
};

/** Registry ids with authored geometry — the whole registry. */
export const SIGN_GEOMETRY: ReadonlyMap<string, SignGeometry> = new Map(Object.entries(geometry));

/**
 * Resolve a sign by registry id.
 *
 * Returns `undefined` only when the id is not in the registry at all — that is
 * a content bug, and `sign-references.test.ts` fails the build on one. A
 * registry id with no geometry resolves to a face whose `geometry` is
 * `undefined`, which `SignSvg` renders as a visible plate rather than a blank.
 */
export function getSign(id: string): SignFace | undefined {
  const entry = SIGN_REGISTRY.get(id);
  if (!entry) return undefined;
  return { entry, geometry: SIGN_GEOMETRY.get(id) };
}

/** Every registry entry, in registry order — what the contact sheet renders. */
export const allSigns: readonly SignEntry[] = [...SIGN_REGISTRY.values()];
