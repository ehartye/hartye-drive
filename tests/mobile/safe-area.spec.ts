import { test, expect } from '@playwright/test';
import { emulateNotch, setUpDevice, visit, IPHONE_SAFE_BOTTOM } from './support';

/**
 * SAFE-AREA INSETS.
 *
 * On a notched iPhone the bottom ~34 CSS px of the display belong to the home
 * indicator. The OS draws over anything there and swallows the swipe, so a
 * control in that band is not merely ugly — it is unreachable.
 *
 * Two things have to be true, and the app had only the first:
 *
 *  1. the fixed bottom bar must pad itself out of the band, and
 *  2. **the page must be told the bar got taller.** `.shell` reserved a flat
 *     `--nav-height` for the nav. Measured here, the nav is 67.5px tall and the
 *     reservation is 92px — comfortable with no notch, and 9.5px short the
 *     moment a 34px inset is added to it. The last line of every page sat under
 *     the tab bar on every notched iPhone, and no desktop viewport could show
 *     it because `env()` is zero everywhere else.
 *
 * Playwright emulates no notch on any engine it ships, so `env()` resolves to
 * zero here too. The app reads its insets through `--safe-b` / `--safe-t`,
 * each defaulting to the real `env()`, and `emulateNotch` overrides the
 * variable — the `calc()` under test is the same declaration in production and
 * in this test. See `support.ts`.
 */

test.describe('safe-area insets', () => {
  test('viewport-fit=cover is set, or env() is always zero', async ({ page }) => {
    await page.goto('/');
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport, 'insets are used but the viewport does not extend under them').toContain(
      'viewport-fit=cover',
    );
  });

  test('the bottom tab bar clears the home indicator', async ({ page }) => {
    await setUpDevice(page);
    await visit(page, '/study');
    await emulateNotch(page);

    const geometry = await page.evaluate((inset) => {
      const nav = document.querySelector('nav.nav');
      if (!nav) return null;
      const links = [...nav.querySelectorAll('a')];
      return {
        navBottom: nav.getBoundingClientRect().bottom,
        viewportHeight: window.innerHeight,
        // The lowest edge of any actual destination, which is what a thumb aims at.
        lowestLink: Math.max(...links.map((a) => a.getBoundingClientRect().bottom)),
        indicatorTop: window.innerHeight - inset,
      };
    }, IPHONE_SAFE_BOTTOM);

    expect(geometry).not.toBeNull();
    expect(
      geometry!.lowestLink,
      'a tab-bar destination sits under the home indicator, where iOS takes the touch',
    ).toBeLessThanOrEqual(geometry!.indicatorTop + 0.5);
  });

  test('the page reserves room for the nav *including* the inset', async ({ page }) => {
    await setUpDevice(page);
    await visit(page, '/study');
    await emulateNotch(page);

    const overlap = await page.evaluate(() => {
      const nav = document.querySelector('nav.nav');
      const shell = document.querySelector('.shell');
      if (!nav || !shell) return null;
      const reserved = parseFloat(getComputedStyle(shell).paddingBottom);
      return { reserved, navHeight: nav.getBoundingClientRect().height };
    });

    expect(overlap).not.toBeNull();
    expect(
      overlap!.reserved,
      `the shell reserves ${String(overlap!.reserved)}px but the nav is ` +
        `${String(overlap!.navHeight)}px tall with the inset — the tail of every page is hidden`,
    ).toBeGreaterThanOrEqual(overlap!.navHeight);
  });

  test('no page content is left underneath the tab bar', async ({ page }) => {
    await setUpDevice(page);
    for (const route of ['/study', '/signs', '/progress', '/settings']) {
      await visit(page, route);
      await emulateNotch(page);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      const buried = await page.evaluate(() => {
        const nav = document.querySelector('nav.nav');
        const main = document.querySelector('main') ?? document.querySelector('.shell');
        if (!nav || !main) return null;
        // Scroll to the very end: the last element is the one that gets buried.
        window.scrollTo(0, document.documentElement.scrollHeight);
        const navTop = nav.getBoundingClientRect().top;
        const mainBottom = main.getBoundingClientRect().bottom;
        return { navTop, mainBottom };
      });

      expect(buried).not.toBeNull();
      expect(
        buried!.mainBottom,
        `${route}: page content runs ${String(
          Math.round(buried!.mainBottom - buried!.navTop),
        )}px past the top of the tab bar`,
      ).toBeLessThanOrEqual(buried!.navTop + 1);
    }
  });

  test('the focus-mode action shelf clears the home indicator', async ({ page }) => {
    await setUpDevice(page);
    await visit(page, '/exam/run');
    await emulateNotch(page);

    const shelf = page.locator('.actionbar');
    await expect(shelf).toBeVisible();

    const geometry = await page.evaluate((inset) => {
      const bar = document.querySelector('.actionbar');
      if (!bar) return null;
      const control = bar.querySelector('button, a');
      return {
        controlBottom: control?.getBoundingClientRect().bottom ?? null,
        indicatorTop: window.innerHeight - inset,
        barBottom: bar.getBoundingClientRect().bottom,
      };
    }, IPHONE_SAFE_BOTTOM);

    expect(geometry).not.toBeNull();
    expect(geometry!.controlBottom).not.toBeNull();
    expect(
      geometry!.controlBottom!,
      'the primary action in the focus shelf sits under the home indicator',
    ).toBeLessThanOrEqual(geometry!.indicatorTop + 0.5);
  });
});
