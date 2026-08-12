import { expect, test } from '@playwright/test';
import type { CDPSession, Page } from '@playwright/test';

/**
 * X23 — cold load on Slow 4G with a 4× CPU throttle, production build: the
 * first question must be interactive within 2.5 s.
 *
 * "Cold" means the worst case a learner ever sees — a brand-new profile with no
 * service worker, no HTTP cache and nothing precached. Every later visit is
 * served from the precache and is faster by a wide margin, so this is the
 * number worth gating on.
 *
 * The throttle is Chrome DevTools' own "Slow 4G" preset, applied over CDP:
 * 1.6 Mbit/s down, 750 kbit/s up, 562.5 ms round trip. The CPU rate is 4×,
 * which is roughly a mid-range Android against this machine.
 */

const SLOW_4G = {
  offline: false,
  downloadThroughput: Math.round((1.6 * 1024 * 1024) / 8),
  uploadThroughput: Math.round((750 * 1024) / 8),
  latency: 562.5,
};

const CPU_THROTTLE = 4;

async function throttle(page: Page): Promise<CDPSession> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', SLOW_4G);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });
  return cdp;
}

/** Milliseconds from this document's navigation start, read in the page. */
const sinceNavigation = (page: Page) => page.evaluate(() => performance.now());

test.describe('startup', () => {
  test('X23 — the first question is interactive within 2.5 s, cold, on Slow 4G + 4× CPU', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    const cdp = await throttle(page);

    await page.goto('/study/session?q=stp-002,int-016', { waitUntil: 'commit' });
    await expect(page.locator('.stem')).toBeVisible({ timeout: 60_000 });
    const choice = page.locator('.choice').first();
    await expect(choice).toBeVisible({ timeout: 60_000 });
    await expect(choice).toBeEnabled();

    const ms = await sinceNavigation(page);
    await testInfo.attach('X23 first-question-interactive', { body: `${ms.toFixed(0)} ms` });
    console.log(`\n  X23 — first question interactive: ${ms.toFixed(0)} ms (budget 2500 ms)\n`);

    // Interactive means it answers, not merely that it is painted.
    await choice.click();
    await expect(page.locator('.panel--guide')).toBeVisible({ timeout: 30_000 });

    await cdp.detach();
    expect(ms, `first question interactive at ${ms.toFixed(0)} ms`).toBeLessThanOrEqual(2500);
  });

  test('X23 — the dashboard is interactive within 2.5 s under the same throttle', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    const cdp = await throttle(page);

    await page.goto('/', { waitUntil: 'commit' });
    const start = page.getByRole('button', { name: /Start studying/ });
    await expect(start).toBeVisible({ timeout: 60_000 });
    await expect(start).toBeEnabled();

    const ms = await sinceNavigation(page);
    await testInfo.attach('X23 first-screen-interactive', { body: `${ms.toFixed(0)} ms` });
    console.log(`\n  X23 — first screen interactive: ${ms.toFixed(0)} ms (budget 2500 ms)\n`);

    await cdp.detach();
    expect(ms, `first screen interactive at ${ms.toFixed(0)} ms`).toBeLessThanOrEqual(2500);
  });

  test('a warm load — the second visit, served entirely from the precache', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    // Prime on a full-speed connection, the way a learner installs the app at
    // home, then measure the visit they make in the parking lot.
    await page.goto('/study/session?q=stp-002');
    await expect(page.locator('.choice').first()).toBeVisible();
    await expect
      .poll(
        () =>
          page.evaluate(async () => {
            const registration = await navigator.serviceWorker.getRegistration();
            return registration?.active?.state ?? 'none';
          }),
        { timeout: 60_000 },
      )
      .toBe('activated');

    const cdp = await throttle(page);
    await page.goto('/study/session?q=stp-002', { waitUntil: 'commit' });
    await expect(page.locator('.choice').first()).toBeVisible({ timeout: 60_000 });
    const ms = await sinceNavigation(page);
    await testInfo.attach('warm first-question-interactive', { body: `${ms.toFixed(0)} ms` });
    console.log(`\n  warm — first question interactive: ${ms.toFixed(0)} ms\n`);

    await cdp.detach();
    expect(ms).toBeLessThanOrEqual(2500);
  });
});
