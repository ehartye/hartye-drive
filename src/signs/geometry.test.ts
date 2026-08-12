import { describe, it, expect } from 'vitest';
import registryJson from '~/content/signs.json';
import type { SignRegistry } from '~/content/types';
import { colorLabel, shapeLabel, signDrillName, signName } from './registry';
import { SIGN_GEOMETRY, allSigns, getSign } from './signs';

/**
 * `src/content/signs.json` is the single source of truth for what a sign *is*
 * — its id, MUTCD designation, category, shape, colours, meaning and citation.
 * `src/signs/` holds only *geometry*, and geometry is keyed by registry id.
 *
 * The two used to be separate registries with separate ids (`stop` here,
 * `r1-1-stop` there) and separate category vocabularies (`construction` here,
 * `work-zone` there), and 74 registry signs had no geometry at all. P3 grows
 * the geometry; this file makes sure it inherits a contract rather than a
 * conflict.
 */
const registry = registryJson as unknown as SignRegistry;
const registryIds = new Set(registry.signs.map((sign) => sign.id));

describe('sign geometry answers to the content registry', () => {
  it('draws only ids that exist in src/content/signs.json', () => {
    const orphans = [...SIGN_GEOMETRY.keys()].filter((id) => !registryIds.has(id));
    expect(orphans).toEqual([]);
  });

  it('exposes exactly the drawn signs, resolved through the registry', () => {
    expect(allSigns).toHaveLength(SIGN_GEOMETRY.size);
    expect(allSigns.map((sign) => sign.id).sort()).toEqual([...SIGN_GEOMETRY.keys()].sort());
  });

  it('takes its category vocabulary from the registry, not a second list', () => {
    // These two are exactly where the vocabularies used to disagree.
    expect(getSign('w20-1-road-work-ahead')?.entry.category).toBe('work-zone');
    expect(getSign('d9-2-hospital')?.entry.category).toBe('service');
  });

  it('names a sign from registry data alone (practices A8)', () => {
    const stop = getSign('r1-1-stop');
    expect(stop?.entry.mutcd).toBe('R1-1');
    expect(signDrillName(stop!.entry)).toBe('Octagon, red');
    expect(signName(stop!.entry)).toContain(stop!.entry.meaning);
    expect(signName(stop!.entry)).toContain('Octagon, red');
  });

  it('can say every shape and face colour the registry uses out loud', () => {
    for (const sign of registry.signs) {
      expect(shapeLabel(sign.shape), `${sign.id} shape`).toBeTruthy();
      expect(shapeLabel(sign.shape), `${sign.id} shape`).not.toContain('-');
      expect(colorLabel(sign.faceColor), `${sign.id} colour`).toBeTruthy();
    }
  });

  it('draws every sign the registry carries — no face is still pending', () => {
    const undrawn = registry.signs.filter((sign) => !SIGN_GEOMETRY.has(sign.id)).map((s) => s.id);
    expect(undrawn).toEqual([]);
    expect(SIGN_GEOMETRY.size).toBe(registry.signs.length);
  });

  it('publishes a face outline for every geometry, for the containment gate', () => {
    for (const [id, geometry] of SIGN_GEOMETRY) {
      // `audit:signs` fills this path in a real browser and requires every
      // <text> bounding box to land inside it. An empty one would pass
      // vacuously, so the shape of the assertion matters.
      expect(geometry.face, `${id} face`).toMatch(/^M[\d.\-\s]/);
      expect(geometry.face.length, `${id} face`).toBeGreaterThan(12);
      expect(geometry.viewBox, `${id} viewBox`).toMatch(/^0 0 \d+ \d+$/);
    }
  });

  it('returns nothing at all for an id the registry does not carry', () => {
    // The pre-registry geometry ids. They are no longer addressable.
    expect(getSign('stop')).toBeUndefined();
    expect(getSign('school-crossing')).toBeUndefined();
  });
});
