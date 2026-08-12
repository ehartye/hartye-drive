import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyProgress, recordAttempt } from '~/domain/progress';
import type { StudyProgress } from '~/domain/progress';
import { STORAGE_KEY, serializeProgress } from '~/domain/persistence';
import { SETUP_STORAGE_KEY, completeSetup, emptySetup, serializeSetup } from '~/domain/setup';

/**
 * State-matrix cells 1, 1-error and 2 / 2b–2f, driven in the real app.
 *
 * Everything here is seeded the way the device would have it — real bytes in
 * `localStorage`, read by the real stores — so the resilience cells (X19, X20,
 * X21) are exercised end to end rather than asserted about in a unit test.
 *
 * Note for whoever extends this: a split route's `HydrateFallback` and this
 * dashboard's own loading skeleton both publish an `<h1>` before the data
 * lands, so waits must target real content (`.speedplate`, `.guidesign__dest`,
 * a named heading) and never merely "a level-1 heading".
 */

const SETUP = serializeSetup(
  completeSetup(emptySetup(), { goal: 'class-d', testDate: '2026-09-12', at: 1_760_000_000_000 }),
);

const DAY = 86_400_000;

/** Twelve answers: nine right, and right-of-way clearly weak. */
function seededProgress(now: number): StudyProgress {
  const rows: [string, string, string, boolean, number][] = [
    ['rot-001', 'right-of-way', 'rules-of-road', true, now - 2 * DAY],
    ['rot-002', 'right-of-way', 'rules-of-road', false, now - 2 * DAY],
    ['rot-003', 'right-of-way', 'rules-of-road', false, now - DAY],
    ['rot-004', 'right-of-way', 'rules-of-road', false, now],
    ...(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((n, i) => [
      `spd-${n}`,
      'speed-limits',
      'rules-of-road',
      true,
      now - (i % 3) * DAY,
    ]) as [string, string, string, boolean, number][]),
  ];
  return rows.reduce(
    (state, [questionId, topic, area, correct, at]) =>
      recordAttempt(state, { questionId, topic, area, chosenIndex: 0, correct, at }).state,
    emptyProgress(),
  );
}

async function seed(page: Page, entries: [string, string][]): Promise<void> {
  await page.addInitScript((pairs: [string, string][]) => {
    for (const [key, value] of pairs) localStorage.setItem(key, value);
  }, entries);
}

/**
 * The dashboard has arrived when the readiness plate is on screen.
 *
 * Deliberately not the guide sign: the loading skeleton draws that frame too
 * (that is the point of it — nothing moves when the data lands), so waiting on
 * `.guidesign__dest` resolves while the rows are still inert placeholder divs.
 * `.speedplate` exists only once the real figures do.
 */
async function dashboardReady(page: Page): Promise<void> {
  await expect(page.locator('.speedplate')).toBeVisible();
}

test.describe('cell 1 — first run', () => {
  test('asks two questions, promises the rest, and hands over to the dashboard', async ({ page }) => {
    await page.goto('/study');

    await expect(page.getByRole('heading', { level: 1, name: /Pass the/ })).toBeVisible();
    await expect(page.getByRole('radio', { name: /Class D knowledge test/ })).toBeChecked();
    await expect(page.getByRole('radio', { name: /Signs refresher/ })).toBeVisible();
    // No raw browser controls: the date is a DateField, three labelled segments.
    await expect(page.locator('input[type="date"]')).toHaveCount(0);
    await expect(page.getByLabel('Month')).toBeVisible();
    await expect(page.getByText('No account, ever')).toBeVisible();
    await expect(page.getByText('Nothing leaves this phone')).toBeVisible();
    // The nav is not drawn on a screen with nowhere to go yet.
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();

    await page.getByLabel('Month').fill('09');
    await page.getByLabel('Day').fill('12');
    await page.getByLabel('Year').fill(String(new Date().getFullYear() + 1));
    await expect(page.getByText(/questions a day/)).toBeVisible();

    await page.getByRole('button', { name: /Start studying/ }).click();
    await dashboardReady(page);
    await expect(page.getByRole('heading', { level: 1, name: /first mile/i })).toBeVisible();

    const stored = await page.evaluate(() => localStorage.getItem('tn-drive:setup'));
    expect(stored).toContain('completedAt');
  });

  test('is fully operable from the keyboard alone (practices A4)', async ({ page }) => {
    await page.goto('/study');
    await expect(page.getByRole('heading', { level: 1, name: /Pass the/ })).toBeVisible();

    const signs = page.getByRole('radio', { name: /Signs refresher/ });
    await signs.focus();
    await page.keyboard.press('Space');
    await expect(signs).toBeChecked();

    await page.getByRole('button', { name: /Start studying/ }).focus();
    await page.keyboard.press('Enter');
    await dashboardReady(page);
  });
});

test.describe('cell 1-error — storage blocked (X21)', () => {
  test('offers session-only mode, says what it costs, and never dead-ends', async ({ page }) => {
    const noise: string[] = [];
    page.on('pageerror', (error) => noise.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') noise.push(`console: ${message.text()}`);
    });

    // The failure mode itself: a browser that throws on every write.
    await page.addInitScript(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException('QuotaExceededError');
      };
    });
    await page.goto('/study');

    await expect(page.getByRole('heading', { level: 1, name: /won.t let the app save/ })).toBeVisible();
    await expect(page.getByText('Session-only mode drops')).toBeVisible();
    await expect(page.getByText('Everything else still works')).toBeVisible();
    await expect(page.getByRole('button', { name: /Check storage again/ })).toBeVisible();
    await expect(page.getByText(/How to let the app save/)).toBeVisible();

    await page.getByRole('button', { name: /Continue in session-only mode/ }).click();
    await dashboardReady(page);
    await expect(page.getByText(/Session-only mode/)).toBeVisible();

    expect(noise).toEqual([]);
  });
});

test.describe('cell 2 — the dashboard, populated', () => {
  test.beforeEach(async ({ page }) => {
    await seed(page, [
      [SETUP_STORAGE_KEY, SETUP],
      [STORAGE_KEY, serializeProgress(seededProgress(Date.now()))],
    ]);
  });

  test('states readiness, the route, the weak topics and the streak', async ({ page }) => {
    await page.goto('/study');
    await dashboardReady(page);

    // Readiness is overall accuracy — 9 of 12 — and reads as a speed-limit sign.
    await expect(page.locator('.speedplate strong')).toHaveText('75');
    await expect(page.getByText(/Readiness 75 percent/)).toBeAttached();

    const guide = page.getByRole('region', { name: /Route to your test/i });
    await expect(guide.getByText('Practice questions')).toBeVisible();
    await expect(guide.getByText(/OF 506/)).toBeVisible();
    await expect(guide.getByText('Mock exams passed')).toBeVisible();

    const weak = page.locator('.weakrow');
    await expect(weak).toHaveCount(1);
    await expect(weak.first()).toContainText('Right-of-way');
    await expect(weak.first()).toContainText('1 of 4 correct');
    await expect(weak.first()).toHaveAttribute('href', /\/study\/session\?q=/);

    await expect(page.getByRole('link', { name: /Continue studying/ })).toBeVisible();
    await expect(page.getByText(/Study streak/)).toBeVisible();
    await expect(page.locator('.day--today')).toHaveCount(1);
  });

  test('the weak-topic row opens a session made of that topic', async ({ page }) => {
    await page.goto('/study');
    await dashboardReady(page);
    await page.locator('.weakrow').first().click();
    await expect(page).toHaveURL(/\/study\/session\?q=/);
    await expect(page.locator('.stem')).toBeVisible();
  });

  test('holds at 320px and at 200% zoom without clipping (A12)', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto('/study');
    await dashboardReady(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    // 200% zoom on a 640px-wide window is the same reflow test at double size.
    await page.setViewportSize({ width: 640, height: 720 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    const zoomed = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(zoomed).toBeLessThanOrEqual(0);
  });
});

test.describe('cell 2b — the dashboard, empty', () => {
  test('is an invitation, not a blank slate', async ({ page }) => {
    await seed(page, [[SETUP_STORAGE_KEY, SETUP]]);
    await page.goto('/study');
    await dashboardReady(page);

    await expect(page.getByRole('heading', { level: 1, name: /first mile/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Your first 12 questions/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Answer your first question/ })).toBeVisible();
    // The guide sign still stands; its readings are honestly zero.
    await expect(page.locator('.guidesign__dist em').first()).toHaveText('0');
    await expect(page.locator('.weakrow--unmeasured')).toHaveCount(4);
    await expect(page.getByText(/Today starts it/)).toBeVisible();
  });
});

test.describe('cell 2c — loading', () => {
  test('shows the dashboard with its words removed, and no layout jump', async ({ page }) => {
    await seed(page, [[SETUP_STORAGE_KEY, SETUP]]);
    // Hold the content pack back so the skeleton is observable at all.
    await page.route('**/questions.json**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });

    await page.goto('/study');
    await expect(page.locator('main[aria-busy="true"]')).toBeVisible();
    await expect(page.locator('.skel').first()).toBeVisible();
    await expect(page.getByRole('status')).toHaveText(/Loading your progress/);
    // The frame is real even while the readings are pending.
    await expect(page.locator('.guidesign')).toBeVisible();

    await dashboardReady(page);
    await expect(page.locator('main[aria-busy="true"]')).toHaveCount(0);
  });
});

test.describe('cell 2d — the saved record cannot be read', () => {
  test('garbage in the key lands on a recoverable screen and is left alone (X19)', async ({
    page,
  }) => {
    await seed(page, [
      [SETUP_STORAGE_KEY, SETUP],
      [STORAGE_KEY, '{"garbage":true'],
    ]);
    await page.goto('/study');

    await expect(page.getByRole('heading', { level: 1, name: /can.t be read/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Export a diagnostic file/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Study without saving/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Reset saved progress/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );

    // The screen promises the file is untouched. Prove it.
    expect(await page.evaluate(() => localStorage.getItem('tn-drive:progress'))).toBe(
      '{"garbage":true',
    );
  });

  test('a future schema version is refused, named, and not overwritten (X20)', async ({ page }) => {
    const payload = JSON.stringify({
      version: 99,
      state: { attempts: [{ at: 1 }, { at: 2 }, { at: 3 }] },
    });
    await seed(page, [
      [SETUP_STORAGE_KEY, SETUP],
      [STORAGE_KEY, payload],
    ]);
    await page.goto('/study');

    await expect(page.getByRole('heading', { level: 1, name: /can.t be read/ })).toBeVisible();
    await expect(page.getByText('schema 99')).toBeVisible();
    await expect(page.getByText(/newer version of TN Drive/)).toBeVisible();
    await expect(page.getByText('3', { exact: true })).toBeVisible();

    // Studying is still offered, and studying must not destroy the file.
    await page.getByRole('link', { name: /Study without saving/ }).click();
    await expect(page.locator('.choice').first()).toBeVisible();
    await page.locator('.choice').first().click();
    await expect(page.locator('.panel--guide').first()).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('tn-drive:progress'))).toBe(payload);
  });

  test('the reset is gated, then clears the file and starts clean', async ({ page }) => {
    await seed(page, [
      [SETUP_STORAGE_KEY, SETUP],
      [STORAGE_KEY, '{"garbage":true'],
    ]);
    await page.goto('/study');
    await expect(page.getByRole('heading', { level: 1, name: /can.t be read/ })).toBeVisible();

    // `force` on purpose: the gate is `aria-disabled`, so the control stays in
    // the tab order and reachable (SC 3.3.1). Pressing it anyway must do
    // nothing — which is the assertion, and Playwright's own actionability
    // check would otherwise skip the case entirely.
    await page.getByRole('button', { name: /Reset saved progress/ }).click({ force: true });
    expect(await page.evaluate(() => localStorage.getItem('tn-drive:progress'))).toBe(
      '{"garbage":true',
    );

    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: /Reset saved progress/ }).click();
    await dashboardReady(page);
    await expect(page.getByRole('heading', { level: 1, name: /first mile/i })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('tn-drive:progress'))).not.toBe(
      '{"garbage":true',
    );
  });
});

test.describe('cell 2e — offline', () => {
  /**
   * The device reports no connection **before** the page loads, which is the
   * real shape of the cell: a learner opening the app in a Driver Service
   * Center car park. Deliberately not `context.setOffline` — that also cuts the
   * dev server's HMR socket, whose client then reloads the page and fails the
   * module fetch, so the test would be measuring Vite rather than the app.
   * Genuine zero-network boot belongs to P9's service worker (X16–X18).
   */
  test('says so in the app bar and on the page, and states what is stored here', async ({
    page,
  }) => {
    await seed(page, [
      [SETUP_STORAGE_KEY, SETUP],
      [STORAGE_KEY, serializeProgress(seededProgress(Date.now()))],
    ]);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });
    });
    await page.goto('/study');
    await dashboardReady(page);

    await expect(page.locator('.offlinestrip')).toBeVisible();
    await expect(page.getByText('No connection.')).toBeVisible();
    await expect(page.locator('.badge--offline')).toContainText('Offline');
    await expect(page.getByText('Content pack')).toBeVisible();
    await expect(page.getByText('506 · 87')).toBeVisible();
    // Nothing on the screen stopped working.
    await expect(page.getByRole('link', { name: /Continue studying/ })).toBeVisible();
  });
});

test.describe('cell 2f — desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('buys a companion column, not wider prose', async ({ page }) => {
    await seed(page, [
      [SETUP_STORAGE_KEY, SETUP],
      [STORAGE_KEY, serializeProgress(seededProgress(Date.now()))],
    ]);
    await page.goto('/study');
    await dashboardReady(page);

    // The brand belongs to the side rail at this width (grounding §3).
    await expect(page.locator('.railbrand')).toBeVisible();
    const aside = page.getByRole('complementary', { name: /Exam and streak/ });
    await expect(aside).toBeVisible();

    const main = await page.locator('.col-main').boundingBox();
    const side = await aside.boundingBox();
    expect(main).not.toBeNull();
    expect(side).not.toBeNull();
    // Side column sits beside the reading column, which keeps its 720px measure.
    expect(side!.x).toBeGreaterThan(main!.x + main!.width - 4);
    expect(main!.width).toBeLessThanOrEqual(720);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
