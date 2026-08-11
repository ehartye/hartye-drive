import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The content gate has to be part of the *build*, not only of `npm run verify`
 * (practices E5, grounding §6: a question without a valid citation fails the
 * build). A validator that only a separate command runs is a validator a
 * deploy can skip, and a question citing a banned rule reaches a learner.
 *
 * npm runs `prebuild` automatically before `build`, and a non-zero exit there
 * aborts the build — so wiring it as `prebuild` is what makes bad content
 * unshippable.
 */
const root = resolve(import.meta.dirname, '../..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
  scripts: Record<string, string | undefined>;
};

describe('the build gate (practices E5)', () => {
  it('runs the content validator before every build', () => {
    const prebuild = pkg.scripts.prebuild;
    expect(prebuild, 'package.json has no `prebuild` script').toBeDefined();
    expect(prebuild).toContain('scripts/validate-content.mjs');
  });

  it('points at a validator that actually exists', () => {
    expect(existsSync(resolve(root, 'scripts/validate-content.mjs'))).toBe(true);
  });

  it('still typechecks and bundles in the build step itself', () => {
    expect(pkg.scripts.build).toContain('tsc --noEmit');
    expect(pkg.scripts.build).toContain('vite build');
  });
});
