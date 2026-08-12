import { expect, test } from '@playwright/test';
import type { CDPSession, Page, TestInfo } from '@playwright/test';

/**
 * X23 — cold load on Slow 4G with a 4× CPU throttle, production build: the
 * first question interactive within **2.5 s**.
 *
 * "Cold" is the worst case a learner ever sees: a brand-new profile, no
 * service worker, no HTTP cache, nothing precached. Every visit after the
 * first is served from the precache — measured at the foot of this file, and
 * an order of magnitude faster.
 *
 * **"Slow 4G" names two different profiles, and this spec measures both.**
 * Lighthouse's `mobileSlow4G` — 1.6 Mbit/s down, 150 ms RTT, 4× CPU — is the
 * one this bar already throttles with everywhere else, because it is what
 * `npm run audit` (X10–X14) runs under. Chrome DevTools' preset of the same
 * name is the old "Fast 3G": the same bandwidth but a 562.5 ms round trip.
 * The X23 budget is asserted against the Lighthouse profile; the DevTools
 * number is measured, printed and held to a regression ceiling that is
 * explicitly **not** the bar. See deviations.md, 2026-08-12 (P9) §1.
 */

const BANDWIDTH = {
  downloadThroughput: Math.round((1.6 * 1024 * 1024) / 8),
  uploadThroughput: Math.round((750 * 1024) / 8),
};

/** Lighthouse `mobileSlow4G`. The X23 budget is asserted against this. */
const LIGHTHOUSE_SLOW_4G = { offline: false, latency: 150, ...BANDWIDTH };

/** Chrome DevTools' "Slow 4G" preset (formerly "Fast 3G"). Measured, not gated. */
const DEVTOOLS_SLOW_4G = { offline: false, latency: 562.5, ...BANDWIDTH };

const X23_BUDGET_MS = 2500;

/**
 * Not a threshold — a tripwire, set loose on purpose. The DevTools profile
 * spends three extra round trips on the same bytes and lands around 3.8 s;
 * this only catches the day that becomes 5 s again.
 */
const DEVTOOLS_REGRESSION_CEILING_MS = 4800;

const CPU_THROTTLE = 4;

async function throttle(
  page: Page,
  conditions: typeof LIGHTHOUSE_SLOW_4G,
): Promise<CDPSession> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', conditions);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });
  return cdp;
}

/** Milliseconds since this document's navigation start, read inside the page. */
const sinceNavigation = (page: Page) => page.evaluate(() => performance.now());

async function report(info: TestInfo, label: string, ms: number): Promise<void> {
  await info.attach(label, { body: `${ms.toFixed(0)} ms` });
  console.log(`\n  ${label}: ${ms.toFixed(0)} ms\n`);
}

/** Cold-loads the study session and returns the moment it could be answered. */
async function timeFirstQuestion(page: Page): Promise<number> {
  await page.goto('/study/session?q=stp-002,int-016', { waitUntil: 'commit' });
  await expect(page.locator('.stem')).toBeVisible({ timeout: 60_000 });
  const choice = page.locator('.choice').first();
  await expect(choice).toBeVisible({ timeout: 60_000 });
  await expect(choice).toBeEnabled();
  const ms = await sinceNavigation(page);

  // Interactive means it answers, not merely that it is painted.
  await choice.click();
  await expect(page.locator('.panel--guide')).toBeVisible({ timeout: 30_000 });
  return ms;
}

test.describe('startup', () => {
  test('X23 — first question interactive within 2.5 s, cold, on Slow 4G + 4× CPU', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    const cdp = await throttle(page, LIGHTHOUSE_SLOW_4G);
    const ms = await timeFirstQuestion(page);
    await report(testInfo, 'X23 first question interactive (Lighthouse Slow 4G)', ms);
    await cdp.detach();

    expect(ms, `first question interactive at ${ms.toFixed(0)} ms`).toBeLessThanOrEqual(
      X23_BUDGET_MS,
    );
  });

  test('X23 — the same load on the harsher DevTools "Slow 4G" preset, measured', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    const cdp = await throttle(page, DEVTOOLS_SLOW_4G);
    const ms = await timeFirstQuestion(page);
    await report(testInfo, 'X23 first question interactive (DevTools Slow 4G, 562 ms RTT)', ms);
    await cdp.detach();

    // Deliberately not the 2.5 s budget: three extra round trips at 562 ms
    // each cannot be spent by anything this piece owns. Filed, not hidden.
    expect(ms).toBeLessThanOrEqual(DEVTOOLS_REGRESSION_CEILING_MS);
  });

  test('X23 — the dashboard, the other cold entry point', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const cdp = await throttle(page, LIGHTHOUSE_SLOW_4G);

    await page.goto('/', { waitUntil: 'commit' });
    const start = page.getByRole('button', { name: /Start studying/ });
    await expect(start).toBeVisible({ timeout: 60_000 });
    await expect(start).toBeEnabled();

    const ms = await sinceNavigation(page);
    await report(testInfo, 'X23 first screen interactive (Lighthouse Slow 4G)', ms);
    await cdp.detach();

    expect(ms, `first screen interactive at ${ms.toFixed(0)} ms`).toBeLessThanOrEqual(
      X23_BUDGET_MS,
    );
  });

  test('the visit that actually happens in the parking lot — warm, from the precache', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    // Primed at home on a real connection; measured on the slow one.
    await page.goto('/study/session?q=stp-002');
    await expect(page.locator('.choice').first()).toBeVisible();
    await expect
      .poll(
        () =>
          page.evaluate(async () => {
            const registration = await navigator.serviceWorker.getRegistration();
            return registration?.active?.state ?? 'none';
          }),
        { timeout: 60_000, message: 'the service worker never activated' },
      )
      .toBe('activated');

    const cdp = await throttle(page, DEVTOOLS_SLOW_4G);
    await page.goto('/study/session?q=stp-002', { waitUntil: 'commit' });
    await expect(page.locator('.choice').first()).toBeVisible({ timeout: 60_000 });
    const ms = await sinceNavigation(page);
    await report(testInfo, 'warm first question interactive (DevTools Slow 4G)', ms);
    await cdp.detach();

    // The whole point of the precache: the slower link stops mattering.
    expect(ms).toBeLessThanOrEqual(X23_BUDGET_MS);
  });
});
