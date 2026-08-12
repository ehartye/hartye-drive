import { test, type Locator, type Page } from '@playwright/test';
import { POPULATED } from '../support/seed';
import { setUpDevice, visit } from './support';

/**
 * ENGINE-COMPARISON EVIDENCE.
 *
 * The signs and the charts are the product's signature — hand-authored,
 * spec-accurate MUTCD SVG, and hand-authored inline SVG charts, because
 * grounding §1 forbids a chart library. `rendering.spec.ts` asserts the
 * invariants that would catch them breaking; this produces the pictures a human
 * needs in order to see what an invariant cannot describe.
 *
 * Deliberately not a `toHaveScreenshot` comparison. Two engines never rasterise
 * type identically, so a pixel diff between WebKit and Chromium fails on
 * antialiasing and teaches nobody anything — and a per-engine baseline only
 * proves the engine still agrees with itself. These are named by engine and
 * meant to be looked at side by side.
 *
 * The shots always go to the Playwright report, so this spec exercises the same
 * surfaces on every run and cannot rot. They are written into the bar's
 * evidence directory **only** under `CAPTURE_EVIDENCE=1`: `npm run verify` must
 * leave the working tree clean, and a spec that rewrites committed PNGs on
 * every run makes `verify` non-idempotent the first time an engine upgrade
 * shifts a pixel.
 */

const EVIDENCE = 'docs/superpowers/bars/2026-08-11-tn-drivers-test-app/evidence';
const CAPTURE = process.env.CAPTURE_EVIDENCE === '1';

test('captures the signs and the charts on this engine', async ({ page }, testInfo) => {
  const engine = testInfo.project.name;

  const shoot = async (name: string, target: Page | Locator): Promise<void> => {
    const body = await target.screenshot();
    await testInfo.attach(`${name}-${engine}.png`, { body, contentType: 'image/png' });
    if (CAPTURE) {
      await target.screenshot({ path: `${EVIDENCE}/mobile-${name}-${engine}.png` });
    }
  };

  await setUpDevice(page);
  await page.addInitScript((seed: Record<string, string>) => {
    for (const [key, value] of Object.entries(seed)) localStorage.setItem(key, value);
  }, POPULATED());

  await visit(page, '/signs');
  await page.evaluate(() => document.fonts.ready);
  // Past the intro copy and into the grid itself — the faces are the subject.
  await page.evaluate(() => {
    window.scrollTo(0, 1400);
  });
  await shoot('signs', page);

  await visit(page, '/progress');
  await page.evaluate(() => document.fonts.ready);
  for (const [index, chart] of (await page.locator('figure.chart').all()).entries()) {
    await chart.scrollIntoViewIfNeeded();
    await shoot(`chart${String(index)}`, chart);
  }

  // The tab bar over scrolling content: the surface that read straight through
  // on iOS 17 before the overlay bars stopped depending on a blur.
  await visit(page, '/signs');
  await page.evaluate(() => {
    window.scrollTo(0, 2000);
  });
  await shoot('navbar', page);
});
