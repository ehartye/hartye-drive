import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { EXAM_KEY, POPULATED, PROGRESS_KEY } from '../support/seed';

/**
 * P8 — settings & about. State-matrix cells 11, 11b (the destructive
 * confirmation) and 11c (its failure path).
 *
 * 11c is the cell a build omits, because "delete" is assumed to always succeed.
 * It is reached here the only honest way: by making the browser genuinely
 * refuse the erase and letting the app discover that for itself. No query
 * parameter fabricates the screen.
 */
async function seed(page: Page): Promise<void> {
  await page.addInitScript((records: Record<string, string>) => {
    for (const [key, value] of Object.entries(records)) localStorage.setItem(key, value);
  }, POPULATED());
}

/** A profile that refuses removals by throwing — private mode, blocked data. */
async function refuseRemoval(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Storage.prototype.removeItem = function removeItem() {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    };
  });
}

/** A profile that accepts the removal and changes nothing — a read-only disk. */
async function swallowRemoval(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Storage.prototype.removeItem = function removeItem() {
      /* accepted, and quietly ignored */
    };
  });
}

async function openReset(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Reset all progress…' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

test.describe('settings', () => {
  test('cell 11 — the source, the currency date and the non-affiliation are all stated', async ({
    page,
  }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { level: 1, name: /Settings/ })).toBeVisible();

    await expect(
      page.getByRole('heading', { name: 'Tennessee Comprehensive Driver License Manual' }),
    ).toBeVisible();
    await expect(page.getByText(/current as of/).first()).toBeVisible();
    await expect(page.getByText('July 1, 2022').first()).toBeVisible();

    // Non-affiliation, in the body and again in the footer. Not collapsed.
    await expect(
      page.getByText(/not affiliated with, endorsed by, or connected to the State of Tennessee/),
    ).toBeVisible();
    await expect(
      page.getByText(/Not affiliated with, or endorsed by, the State of Tennessee/),
    ).toBeVisible();
  });

  test('every post-2022 correction carries its real effective date and public chapter', async ({
    page,
  }) => {
    await page.goto('/settings');
    await page.getByRole('heading', { name: /corrected since 2022/ }).waitFor();

    const cards = page.locator('.corr');
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(3);

    // Not "in force 2023": a real date, and the chapter that made it.
    for (const [summary, when, authority] of [
      ['Move Over Law', 'In force July 1, 2023', 'Public Chapter 354'],
      ['vehicular assault', 'In force July 1, 2025', 'Public Chapter 430'],
      ['REAL ID', 'In force May 7, 2025', 'REAL ID Act'],
    ] as const) {
      const card = cards.filter({ hasText: summary }).first();
      await expect(card).toContainText(when);
      await expect(card).toContainText(authority);
    }

    // And the corrections are disclosed, never applied silently.
    await expect(page.getByText(/never change an answer quietly/)).toBeVisible();
  });

  test('low-confidence changes are listed as not taught, rather than taught anyway', async ({
    page,
  }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: /won’t teach/ })).toBeVisible();
    await expect(page.getByText(/Left-lane/)).toBeVisible();
  });

  test('the reading preferences persist and actually change the reading text', async ({ page }) => {
    await page.goto('/settings');
    const preview = page.locator('.preview .read');
    const before = await preview.evaluate((el) => getComputedStyle(el).fontSize);

    await page.getByRole('radio', { name: 'Larger' }).check();
    const after = await preview.evaluate((el) => getComputedStyle(el).fontSize);
    expect(parseFloat(after)).toBeGreaterThan(parseFloat(before));
    await expect(page.getByText('Preview · Larger')).toBeVisible();

    // It survives a reload, and it applies outside settings too.
    await page.reload();
    await expect(page.getByRole('radio', { name: 'Larger' })).toBeChecked();
    expect(
      await page.evaluate(() => document.documentElement.dataset.textSize),
    ).toBe('larger');

    await page.getByRole('switch', { name: 'Reduce motion' }).click();
    expect(await page.evaluate(() => document.documentElement.dataset.motion)).toBe('reduced');
  });

  test('the declared reduced-motion preference stops transitions app-wide', async ({ page }) => {
    await page.goto('/settings');
    await page.getByRole('switch', { name: 'Reduce motion' }).click();
    await page.goto('/signs');
    await page.locator('.signcard').first().waitFor();
    const durations = await page.evaluate(() =>
      [...document.querySelectorAll('.btn, .chip')].map(
        (el) => getComputedStyle(el).transitionDuration,
      ),
    );
    expect(durations.length).toBeGreaterThan(0);
    for (const duration of durations) expect(parseFloat(duration)).toBeLessThan(0.01);
  });

  test('cell 11b — the reset is guarded, two-step, and cancellable', async ({ page }) => {
    await seed(page);
    await page.goto('/settings');
    await openReset(page);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Cannot be undone');
    // The ledger, itemised: what goes and what stays.
    await expect(dialog.getByText('Gone for good')).toBeVisible();
    await expect(dialog.getByText('Stays exactly as it is')).toBeVisible();
    await expect(dialog.getByText(/text size and reduced-motion settings/)).toBeVisible();

    // Erase is unavailable until the gate is ticked — and stays reachable so a
    // screen-reader user can hear why (SC 3.3.1).
    const erase = dialog.getByRole('button', { name: 'Erase everything' });
    await expect(erase).toHaveAttribute('aria-disabled', 'true');
    // `force` because Playwright will not click an aria-disabled control — and
    // pressing it anyway is exactly the case worth proving does nothing.
    await erase.click({ force: true });
    await expect(dialog).toBeVisible();

    await dialog.getByRole('checkbox').check();
    await expect(erase).not.toHaveAttribute('aria-disabled', 'true');

    // Cancelling keeps everything.
    await dialog.getByRole('button', { name: 'Keep my progress' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    expect(await page.evaluate((k) => localStorage.getItem(k), PROGRESS_KEY)).not.toBeNull();
  });

  test('the confirmation traps focus, restores it, and closes on Escape (practices A16)', async ({
    page,
  }) => {
    await seed(page);
    await page.goto('/settings');
    const opener = page.getByRole('button', { name: 'Reset all progress…' });
    await openReset(page);

    // Tabbing never reaches the page behind. Chromium's own modal wrap passes
    // through `<body>` for one tick on its way back to the top of the dialog,
    // which is the native behaviour and not an escape — what would be an escape
    // is landing on a control in the page underneath.
    for (let i = 0; i < 14; i += 1) {
      await page.keyboard.press('Tab');
      const where = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return 'boundary';
        return el.closest('dialog') ? 'inside' : `escaped: ${el.tagName}.${el.className}`;
      });
      expect(where, 'focus escaped the modal dialog').not.toContain('escaped');
    }

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test('a confirmed reset erases the records and leaves the preferences alone', async ({
    page,
  }) => {
    await seed(page);
    await page.goto('/settings');
    await page.getByRole('radio', { name: 'Large', exact: true }).check();

    await openReset(page);
    await page.getByRole('dialog').getByRole('checkbox').check();
    await page.getByRole('dialog').getByRole('button', { name: 'Erase everything' }).click();

    await expect(page.getByText('Everything was erased')).toBeVisible();

    // The keys are removed, and then the now-empty stores write themselves back
    // — so what must be true is that nothing the learner earned survives, not
    // that the key is absent.
    const progress = JSON.parse(
      (await page.evaluate((k) => localStorage.getItem(k), PROGRESS_KEY)) ?? 'null',
    ) as { state: { topics: Record<string, unknown>; attempts: unknown[] } } | null;
    expect(progress?.state.topics).toEqual({});
    expect(progress?.state.attempts).toEqual([]);
    const exams = JSON.parse(
      (await page.evaluate((k) => localStorage.getItem(k), EXAM_KEY)) ?? 'null',
    ) as { state: { attempts: unknown[] } } | null;
    expect(exams?.state.attempts).toEqual([]);
    await expect(page.getByRole('radio', { name: 'Large', exact: true })).toBeChecked();

    // And the progress page is genuinely back to its empty state. Navigated in
    // app rather than by `goto`, because the seeding init script would re-run
    // on a fresh document load and put the record straight back.
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Progress' }).click();
    await expect(page.getByRole('heading', { level: 1, name: /set off yet/ })).toBeVisible();
  });

  test('cell 11c — the erase is refused, and the page says so before anything else', async ({
    page,
  }) => {
    await seed(page);
    await refuseRemoval(page);
    await page.goto('/settings');
    await openReset(page);
    await page.getByRole('dialog').getByRole('checkbox').check();
    await page.getByRole('dialog').getByRole('button', { name: 'Erase everything' }).click();

    // Relief first: the learner's live question is "did I lose it?".
    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(page.getByText('Nothing was erased', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 1, name: /won’t let the app write/ }),
    ).toBeVisible();

    // No octagon: nothing stopped, the erase simply did not happen.
    await expect(page.locator('[data-sign="r1-1-stop"]')).toHaveCount(0);

    // The record is provably intact, and the page proves it back to the learner.
    expect(await page.evaluate((k) => localStorage.getItem(k), PROGRESS_KEY)).not.toBeNull();
    await expect(alert).toContainText('Still here');
    await expect(alert).toContainText('Questions answered');

    // Every recovery is a real action.
    await expect(page.getByRole('button', { name: 'Try the reset again' })).toBeVisible();
    await expect(page.getByText('Clear it from the browser instead')).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Export a copy of my progress first/ }),
    ).toBeVisible();
  });

  test('cell 11c — an erase that is accepted and quietly ignored also fails honestly', async ({
    page,
  }) => {
    // The dangerous case: no exception at all. A build that trusts the call
    // reports success over a record that is still sitting there.
    await seed(page);
    await swallowRemoval(page);
    await page.goto('/settings');
    await openReset(page);
    await page.getByRole('dialog').getByRole('checkbox').check();
    await page.getByRole('dialog').getByRole('button', { name: 'Erase everything' }).click();

    await expect(page.getByText('Nothing was erased', { exact: true })).toBeVisible();
    expect(await page.evaluate((k) => localStorage.getItem(k), PROGRESS_KEY)).not.toBeNull();
  });

  test('the export downloads one JSON file holding every record', async ({ page }) => {
    await seed(page);
    await page.goto('/settings');

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export your progress' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^tn-drive-progress-\d{4}-\d{2}-\d{2}\.json$/);

    const stream = await file.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const bundle = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
      app: string;
      records: Record<string, unknown>;
    };
    expect(bundle.app).toBe('tn-drive');
    expect(Object.keys(bundle.records)).toContain(PROGRESS_KEY);
    expect(Object.keys(bundle.records)).toContain(EXAM_KEY);

    await expect(page.locator('.toast__title', { hasText: 'Exported' })).toBeVisible();
  });

  test('exporting still works when writing does not', async ({ page }) => {
    await seed(page);
    await refuseRemoval(page);
    await page.goto('/settings');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export your progress' }).click();
    expect((await download).suggestedFilename()).toContain('tn-drive-progress');
  });

  /**
   * Mockup 11's third section, in its published order. It was missing from the
   * build entirely, and with it the only permanent statement of the update
   * policy the service worker actually implements.
   */
  test('cell 11 — the offline & install section states what is stored and how updates land', async ({
    page,
  }) => {
    await seed(page);
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Offline & install' })).toBeVisible();

    const section = page.locator('section[aria-labelledby="offline-h"]');
    await expect(section).toContainText(/questions/);
    await expect(section).toContainText(/87 signs/);
    // The headline promise of `registerType: 'prompt'`, said out loud.
    await expect(section).toContainText(/Ask me first/);
    await expect(section).toContainText(/never applied in the middle of an exam/);
    await expect(section).toContainText(/Add to home screen/);

    // Published order: Your data · Reset · Offline & install · About.
    const headings = await page.locator('.sect > h2').allInnerTexts();
    expect(headings.slice(-3)).toEqual(['Your data', 'Offline & install', 'About']);
  });

  test('holds at 320px with no horizontal scrolling', async ({ page }) => {
    await seed(page);
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto('/settings');
    await page.getByRole('heading', { level: 1 }).waitFor();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
