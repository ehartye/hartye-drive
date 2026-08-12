import { test, expect } from '@playwright/test';
import { setUpDevice, visit } from './support';

/**
 * PWA ON iOS.
 *
 * iOS Safari fires no `beforeinstallprompt` and exposes no install API at all.
 * A "Install app" button on an iPhone is a button that cannot work — so the
 * honest affordance is the three taps of the Share sheet, and the app has to
 * know which platform it is on to choose between them.
 *
 * The rest is the metadata iOS reads instead of the manifest: it takes its home
 * screen icon from `apple-touch-icon` and its standalone behaviour from
 * `apple-mobile-web-app-capable`, and ignores the manifest's `icons` and
 * `display` entirely.
 */

test.describe('install affordance', () => {
  test('iOS is offered the Share sheet, never a button that cannot work', async ({
    page,
  }, testInfo) => {
    await setUpDevice(page);
    await visit(page, '/study');

    const isIos = testInfo.project.name === 'iphone-webkit';
    // The whole offer, not the `.install` lockup inside it — the Share steps are
    // a sibling of that lockup, so locating the lockup would read only the
    // heading and miss the very thing under test.
    const panel = page.locator('section[aria-labelledby="install-head"]');

    if (isIos) {
      await expect(
        panel,
        'iPhone gets no install affordance at all — the app cannot be installed from here',
      ).toBeVisible();
      await expect(panel).toContainText(/Share/i);
      await expect(
        panel.getByRole('button', { name: /^(install|add to home)/i }),
        'iOS fires no beforeinstallprompt, so an install button here can never do anything',
      ).toHaveCount(0);
    } else {
      // Chromium fires `beforeinstallprompt` only against a real installability
      // check, which headless does not perform; the branch is asserted by the
      // unit tests. What must hold here is that the *iOS* copy is not shown to
      // a non-iOS browser.
      if (await panel.isVisible()) {
        await expect(panel).not.toContainText(/Safari toolbar/i);
      }
    }
  });
});

test.describe('iOS home-screen metadata', () => {
  test('carries the tags iOS reads instead of the manifest', async ({ page }) => {
    await page.goto('/');

    const icon = page.locator('link[rel="apple-touch-icon"]');
    await expect(icon, 'iOS applies its own mask and never reads the manifest icons').toHaveCount(1);
    const href = await icon.getAttribute('href');
    expect(href).toBeTruthy();

    // The icon has to actually exist — a 404 here is a blank home-screen tile.
    const response = await page.request.get(href!);
    expect(response.status(), `${href!} is not served`).toBe(200);
    expect(response.headers()['content-type']).toContain('image');

    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute(
      'content',
      'yes',
    );
    await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveCount(1);
  });

  test('the manifest declares standalone display and its icons resolve', async ({ page }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href, 'no web app manifest is linked').toBeTruthy();

    const response = await page.request.get(href!);
    expect(response.status()).toBe(200);
    const manifest = (await response.json()) as {
      display?: string;
      icons?: { src: string; sizes: string; purpose?: string }[];
      start_url?: string;
    };

    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBeTruthy();
    expect(manifest.icons?.length ?? 0).toBeGreaterThanOrEqual(2);
    for (const entry of manifest.icons ?? []) {
      const asset = await page.request.get(new URL(entry.src, page.url()).toString());
      expect(asset.status(), `${entry.src} is declared but not served`).toBe(200);
    }
  });

  /**
   * Standalone is the mode the app is really used in — launched from the home
   * screen, with no browser chrome and no URL bar to fall back on. The chrome
   * the app draws itself has to be enough on its own.
   */
  test('the app renders its own chrome in standalone display mode', async ({ page }) => {
    await setUpDevice(page);
    await page.emulateMedia({ media: 'screen' });
    await page.goto('/study');

    // `display-mode: standalone` cannot be forced on the page from Playwright,
    // so what is asserted is the consequence: with no browser chrome there must
    // be a way to reach every destination and to go back, drawn by the app.
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link')).toHaveCount(4);

    await page.goto('/rules/R225');
    await expect(
      page.getByRole('link', { name: /back/i }).or(page.getByRole('button', { name: /back/i })).first(),
      'a deep route offers no way back, and standalone has no browser back button',
    ).toBeVisible();
  });

  test('theme-color matches the asphalt base so the status bar does not flash', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#14161A');
  });
});
