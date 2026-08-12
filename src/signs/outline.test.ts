/**
 * The shape declaration used to be unfalsifiable: `signs.json` said `octagon`,
 * the accessible name was built *from* that word, and nothing ever looked at
 * the drawing. A critic changed `r1-1-stop` to `circle` with the geometry
 * untouched and `npm run audit:signs` printed PASS.
 *
 * These tests drive the measurement that closes it, and then run it over the
 * whole registry so the browser gate is not the first place a mismatch shows
 * up. `npm run audit:signs` re-checks the same rule with the outline verified
 * against the paint.
 */
import { describe, expect, it } from 'vitest';
import registryJson from '~/content/signs.json';
import type { SignRegistry } from '~/content/types';
import { describeOutline, measureOutline, outlineMatchesShape } from './outline';
import {
  FACE_CIRCLE,
  FACE_CROSSBUCK,
  FACE_DIAMOND,
  FACE_OCTAGON,
  FACE_PENNANT,
  FACE_PENTAGON,
  FACE_SQUARE,
  FACE_TALL,
  FACE_WIDE,
  FACE_YIELD,
} from './geometry/shared';
import { SIGN_GEOMETRY } from './signs';

const registry = registryJson as unknown as SignRegistry;

describe('measureOutline', () => {
  it('counts the corners of a straight-edged face', () => {
    expect(measureOutline(FACE_OCTAGON).corners).toBe(8);
    expect(measureOutline(FACE_PENTAGON).corners).toBe(5);
    expect(measureOutline(FACE_DIAMOND).corners).toBe(4);
    expect(measureOutline(FACE_YIELD).corners).toBe(3);
  });

  it('reads an arc as a curve with no corners at all', () => {
    const circle = measureOutline(FACE_CIRCLE);
    expect(circle.curved).toBe(true);
    expect(circle.corners).toBe(0);
    expect(circle.aspect).toBeCloseTo(1, 2);
  });

  it('separates the crossbuck into its two blades', () => {
    const crossbuck = measureOutline(FACE_CROSSBUCK);
    expect(crossbuck.subpaths).toHaveLength(2);
    expect(crossbuck.corners).toBe(8);
  });

  it('tells a wide rectangle from a tall one from a square', () => {
    expect(measureOutline(FACE_WIDE).aspect).toBeGreaterThan(1.5);
    expect(measureOutline(FACE_TALL).aspect).toBeLessThan(0.85);
    expect(measureOutline(FACE_SQUARE).aspect).toBeCloseTo(1, 5);
    expect(measureOutline(FACE_SQUARE).axisAligned).toBe(true);
    expect(measureOutline(FACE_DIAMOND).axisAligned).toBe(false);
  });

  it('reports unreadable path data instead of guessing at it', () => {
    const broken = measureOutline('M0 0 Q50 50 100 0 Z');
    expect(broken.error).toContain('unsupported path command');
    expect(outlineMatchesShape('octagon', broken)).toBe(false);
  });
});

describe('outlineMatchesShape', () => {
  it('accepts the shape each face is actually drawn as', () => {
    expect(outlineMatchesShape('octagon', measureOutline(FACE_OCTAGON))).toBe(true);
    expect(outlineMatchesShape('diamond', measureOutline(FACE_DIAMOND))).toBe(true);
    expect(outlineMatchesShape('circle', measureOutline(FACE_CIRCLE))).toBe(true);
    expect(outlineMatchesShape('triangle-down', measureOutline(FACE_YIELD))).toBe(true);
    expect(outlineMatchesShape('pennant', measureOutline(FACE_PENNANT))).toBe(true);
    expect(outlineMatchesShape('crossbuck', measureOutline(FACE_CROSSBUCK))).toBe(true);
  });

  it('rejects the critic mutation: an octagon declared as a circle', () => {
    expect(outlineMatchesShape('circle', measureOutline(FACE_OCTAGON))).toBe(false);
  });

  it('rejects every other shape the octagon is not', () => {
    const octagon = measureOutline(FACE_OCTAGON);
    for (const shape of ['diamond', 'square', 'pentagon', 'shield', 'trapezoid'] as const) {
      expect(outlineMatchesShape(shape, octagon), shape).toBe(false);
    }
  });

  it('does not confuse a diamond with a square, or either rectangle with the other', () => {
    expect(outlineMatchesShape('square', measureOutline(FACE_DIAMOND))).toBe(false);
    expect(outlineMatchesShape('diamond', measureOutline(FACE_SQUARE))).toBe(false);
    expect(outlineMatchesShape('rectangle-vertical', measureOutline(FACE_WIDE))).toBe(false);
    expect(outlineMatchesShape('rectangle-horizontal', measureOutline(FACE_TALL))).toBe(false);
  });
});

describe('the shipped registry', () => {
  it('draws every face as the shape its entry declares', () => {
    const wrong: string[] = [];
    for (const sign of registry.signs) {
      const geometry = SIGN_GEOMETRY.get(sign.id);
      if (geometry === undefined) continue;
      const measured = measureOutline(geometry.face);
      if (!outlineMatchesShape(sign.shape, measured)) {
        wrong.push(`${sign.id} declares ${sign.shape} but draws ${describeOutline(measured)}`);
      }
    }
    expect(wrong).toEqual([]);
  });
});
