import { test, expect } from '@playwright/test';
import {
  answerExam,
  precachedUrls,
  primeServiceWorker,
  watchConsole,
  watchNetwork,
} from './support';

/**
 * X16–X18 — the offline promise, which is the promise the whole product rests
 * on. The onboarding screen tells a learner the app "opens at zero bytes, in a
 * Driver Service Center parking lot". This suite is what makes that a fact.
 *
 * Runs against `dist/` served by `vite preview`, because a dev server has no
 * service worker and would prove nothing.
 */
test.describe('offline', () => {
  test('X16 — the app boots cold with the network disabled', async ({ page, context }) => {
    const net = watchNetwork(page);
    await primeServiceWorker(page);

    await context.setOffline(true);
    net.reset();
    await page.reload({ waitUntil: 'load' });

    // Not a cached shell of a screen: the real first-run heading, the real copy,
    // and the controls that start a session.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: /Start studying/ })).toBeVisible();

    expect(net.failed, `failed requests: ${net.failed.join(', ')}`).toEqual([]);
    expect(
      net.fromNetwork,
      `requests that left the device: ${net.fromNetwork.join(', ')}`,
    ).toEqual([]);
  });

  test('X16 — a deep link into a focus mode boots offline too', async ({ page, context }) => {
    const net = watchNetwork(page);
    await primeServiceWorker(page);
    await context.setOffline(true);
    net.reset();

    // No server to fall back to, so the navigation fallback is the only thing
    // that can serve this (grounding §1).
    await page.goto('/study/session?q=stp-002');
    await expect(page.locator('.stem')).toBeVisible();
    await expect(page.locator('.choice').first()).toBeVisible();

    expect(net.failed, `failed requests: ${net.failed.join(', ')}`).toEqual([]);
    expect(net.fromNetwork).toEqual([]);
  });

  test('X17/X18 — a whole study, exam, signs and progress session, entirely offline', async ({
    page,
    context,
  }) => {
    test.setTimeout(180_000);
    const net = watchNetwork(page);
    const noise = watchConsole(page);

    await primeServiceWorker(page);
    await context.setOffline(true);
    await page.reload({ waitUntil: 'load' });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Everything from here happens at zero bytes of network.
    net.reset();

    /* ---- a study question, answered and explained, citation and all ---- */
    await page.goto('/study/session?q=stp-002,int-016');
    await expect(page.locator('.stem')).toBeVisible();
    await page.locator('.choice').first().click();
    await expect(page.locator('.panel--guide')).toBeVisible();
    await expect(page.locator('.cite__quote')).toBeVisible();

    /* ---- a full 30-question exam ---- */
    await page.goto('/exam/run?seed=11');
    await page.getByRole('button', { name: /Start the exam/ }).click();
    await expect(page.locator('.stem')).toBeVisible();
    for (let i = 0; i < 30; i += 1) {
      if ((await page.locator('[data-qid]').count()) === 0) break;
      await answerExam(page, !(i === 3 || i === 9 || i === 15));
    }
    await expect(page).toHaveURL(/\/exam\/report/);
    await expect(page.getByRole('heading', { level: 1, name: 'You passed' })).toBeVisible();

    /* ---- the sign library, all 87 faces ---- */
    await page.goto('/signs?expand=all');
    const signsHeading = page.getByRole('heading', { level: 1 });
    await expect(signsHeading).toBeVisible();
    await expect(signsHeading).not.toHaveText('Loading');
    expect(await page.locator('svg.sign').count()).toBeGreaterThanOrEqual(80);
    // Hand-authored geometry, offline: nothing unresolved, and nothing raster
    // that could have been waiting on a network that is not there.
    expect(await page.locator('[data-missing-sign], [data-pending-sign]').count()).toBe(0);
    expect(await page.locator('image, img').count()).toBe(0);

    /* ---- progress, with a real record behind it now ---- */
    await page.goto('/progress');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('.chart svg').first()).toBeVisible();
    await expect(page.locator('.meter').first()).toBeVisible();

    expect(net.failed, `failed requests: ${net.failed.join(', ')}`).toEqual([]);
    expect(
      net.fromNetwork,
      `requests that left the device: ${net.fromNetwork.join(', ')}`,
    ).toEqual([]);
    // And the whole run was quiet (practices E8, and X22's condition met while
    // offline as well as on).
    expect(noise, noise.join('\n')).toEqual([]);
    // The session really did ask for things — an empty log would prove nothing.
    expect(net.all.length).toBeGreaterThan(5);
  });

  test('F2 — the precache holds the shell, every font, the bank, the signs and the rules', async ({
    page,
  }) => {
    await primeServiceWorker(page);
    const urls = await precachedUrls(page);

    const has = (pattern: RegExp) => urls.some((url) => pattern.test(url));
    expect(has(/^\/index\.html$/), 'app shell').toBe(true);
    expect(has(/^\/manifest\.webmanifest$/), 'manifest').toBe(true);
    expect(has(/\/assets\/index-.*\.css$/), 'stylesheet').toBe(true);
    expect(has(/\/assets\/questions-.*\.js$/), 'question bank').toBe(true);
    expect(has(/\/assets\/rules-.*\.js$/), 'manual rules').toBe(true);
    expect(has(/\/icons\/icon-512\.png$/), 'install icon').toBe(true);

    for (const font of [
      'overpass-latin',
      'overpass-mono-latin',
      'newsreader-latin',
      'newsreader-italic-latin',
    ]) {
      expect(has(new RegExp(`/fonts/${font}\\.woff2$`)), font).toBe(true);
    }
    // The sign registry ships inside the shell chunk rather than its own file
    // (`src/signs/registry.ts` imports it statically), so the assertion that
    // matters is that the library renders offline — covered above.
  });
});
