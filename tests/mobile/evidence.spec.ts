import { test } from '@playwright/test';
import { POPULATED } from '../support/seed';
import { setUpDevice, visit } from './support';

/**
 * ENGINE-COMPARISON EVIDENCE.
 *
 * The signs and the charts are the product's signature — hand-authored,
 * spec-accurate MUTCD SVG, and hand-authored inline SVG charts, because
 * grounding §1 forbids a chart library. `rendering.spec.ts` asserts the
 * invariants that would catch them breaking; this writes the pictures a human
 * needs in order to see something the invariants cannot describe.
 *
 * Deliberately not a `toHaveScreenshot` comparison. Two engines never rasterise
 * type identically, so a pixel diff between WebKit and Chromium fails on
 * antialiasing and teaches nobody anything — and a per-engine baseline only
 * proves the engine still agrees with itself. These are named by engine and
 * meant to be looked at side by side.
 *
 * Written under the bar's evidence directory rather than into `test-results/`,
 * which is disposable.
 */

const EVIDENCE = 'docs/superpowers/bars/2026-08-11-tn-drivers-test-app/evidence';

test('captures the signs and the charts on this engine', async ({ page }, testInfo) => {
  const engine = testInfo.project.name;
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
  await page.screenshot({ path: `${EVIDENCE}/mobile-signs-${engine}.png` });

  await visit(page, '/progress');
  await page.evaluate(() => document.fonts.ready);
  const charts = await page.locator('figure.chart').all();
  for (const [index, chart] of charts.entries()) {
    await chart.scrollIntoViewIfNeeded();
    await chart.screenshot({ path: `${EVIDENCE}/mobile-chart${String(index)}-${engine}.png` });
  }

  // The tab bar over scrolling content: the surface that read straight through
  // on iOS 17 before the overlay bars were made opaque.
  await visit(page, '/signs');
  await page.evaluate(() => {
    window.scrollTo(0, 2000);
  });
  await page.screenshot({ path: `${EVIDENCE}/mobile-navbar-${engine}.png` });
});
