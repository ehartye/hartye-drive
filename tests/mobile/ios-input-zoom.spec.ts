import { test, expect } from '@playwright/test';
import { servablePaths } from '~/app/route-paths';
import { setUpDevice, visit } from './support';

/**
 * iOS INPUT ZOOM.
 *
 * Safari on iPhone zooms the whole page when a text-entry control is focused at
 * a computed `font-size` below 16px — and it does **not** zoom back out when the
 * field is blurred. The learner is left on a page they now have to pan
 * sideways, in a Driver Service Center parking lot, mid-question.
 *
 * It is invisible on every other engine, which is precisely why it survives a
 * desktop-Chromium suite: the CSS is legal, the layout is right, the field
 * looks correct in devtools at any width. Only the real engine at the real
 * device profile shows the cost.
 *
 * 16px is the whole rule. `-webkit-text-size-adjust: 100%` in the base layer
 * (which the app already sets) stops Safari *reflowing* text, but it does not
 * stop the focus zoom; only the font size does.
 *
 * Checkboxes, radios and buttons are exempt — Safari zooms for text entry, and
 * those are not text entry.
 */

const TEXT_ENTRY = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number', 'date']);

test.describe('iOS input zoom', () => {
  test('no text-entry control computes below 16px on any route', async ({ page }) => {
    await setUpDevice(page);
    const offenders: string[] = [];

    for (const route of servablePaths()) {
      await visit(page, route);

      const found = await page.evaluate((types) => {
        const bad: { route: string; kind: string; size: number; label: string }[] = [];
        for (const el of document.querySelectorAll('input, select, textarea')) {
          const kind =
            el instanceof HTMLInputElement ? el.type : el.tagName.toLowerCase();
          const entry =
            el instanceof HTMLTextAreaElement ||
            el instanceof HTMLSelectElement ||
            types.includes(kind);
          if (!entry) continue;
          const size = parseFloat(getComputedStyle(el).fontSize);
          if (size >= 16) continue;
          bad.push({
            route: location.pathname,
            kind,
            size,
            label:
              el.getAttribute('aria-label') ??
              el.getAttribute('placeholder') ??
              el.getAttribute('name') ??
              '(unnamed)',
          });
        }
        return bad;
      }, [...TEXT_ENTRY]);

      for (const bad of found) {
        offenders.push(
          `${route}: <${bad.kind}> "${bad.label}" computes ${String(bad.size)}px — iOS Safari will ` +
            `zoom the page on focus and never zoom back`,
        );
      }
    }

    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  /**
   * The two the brief names by hand, asserted by name rather than by sweep —
   * a sweep passes if a field stops rendering, and these two are the ones a
   * learner actually types into.
   */
  test('the sign-library search field is 16px', async ({ page }) => {
    await setUpDevice(page);
    await page.goto('/signs');
    const search = page.getByRole('searchbox');
    await expect(search).toBeVisible();
    const size = await search.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(size).toBeGreaterThanOrEqual(16);
  });

  test('the onboarding date segments are 16px', async ({ page }) => {
    // Deliberately NOT set up: the date field only exists before onboarding is done.
    await page.goto('/');
    const segments = page.locator('.datefield__seg input');
    await expect(segments.first()).toBeVisible();
    const sizes = await segments.evaluateAll((els) =>
      els.map((el) => parseFloat(getComputedStyle(el).fontSize)),
    );
    expect(sizes.length).toBeGreaterThanOrEqual(3);
    for (const size of sizes) expect(size).toBeGreaterThanOrEqual(16);
  });

  /**
   * The page must also be *allowed* to zoom back. `maximum-scale=1` or
   * `user-scalable=no` would suppress the symptom by taking pinch-zoom away
   * from the learner entirely — which fails WCAG 2.2 SC 1.4.4 and is the fix
   * this project must never reach for.
   */
  test('pinch zoom is not disabled to paper over it (SC 1.4.4)', async ({ page }) => {
    await page.goto('/');
    const viewport = await page
      .locator('meta[name="viewport"]')
      .getAttribute('content');
    expect(viewport).toBeTruthy();
    expect(viewport).not.toMatch(/user-scalable\s*=\s*(no|0)/i);
    expect(viewport).not.toMatch(/maximum-scale\s*=\s*1(\.0)?\b/i);
  });
});
