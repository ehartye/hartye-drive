import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { STORAGE_KEY } from '~/domain/persistence';
import { SETUP_STORAGE_KEY, completeSetup, emptySetup, serializeSetup } from '~/domain/setup';

/**
 * The three screens that speak about the learner's saved record must say the
 * same thing about it.
 *
 * This is the defect no single piece owner could see, because each screen was
 * correct on its own terms. The dashboard read the quarantine flag and promised
 * the file was intact; `/progress` and `/settings` read only their own derived
 * figures, which are legitimately zero while the record cannot be read — so one
 * screen promised nothing had been deleted while another reported the record
 * did not exist and offered to erase it, under a confirmation reading "Erase
 * all 0 of your answers?".
 *
 * Driven the honest way: a real, plausible payload in the real key at a schema
 * this build has never heard of. No query parameter fabricates the state.
 */

const SETUP = serializeSetup(
  completeSetup(emptySetup(), { goal: 'class-d', testDate: null, at: 1_760_000_000_000 }),
);

/** 41 KB of a learner's real work, written by a build from the future. */
function futureRecord(): string {
  const attempts = Array.from({ length: 200 }, (_, i) => ({
    questionId: `sig-${String(100 + i)}`,
    topic: 'right-of-way',
    area: 'rules-of-road',
    chosenIndex: i % 3,
    correct: i % 4 !== 0,
    at: 1_770_000_000_000 + i * 40_000,
  }));
  return JSON.stringify({
    version: 77,
    state: {
      schemaVersion: 77,
      cards: {},
      topics: { 'right-of-way': { seen: 612, correct: 514 } },
      attempts,
      sessionsCompleted: 57,
      lastStudiedAt: 1_770_008_000_000,
    },
  });
}

const RECORD = futureRecord();

/**
 * Written once into a real origin, not re-applied on every navigation. The
 * last test in this file erases the record and then walks the other two
 * screens, so an init script would helpfully put it back and prove nothing.
 */
async function seed(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(
    ([setupKey, setup, progressKey, record]: string[]) => {
      localStorage.setItem(setupKey ?? '', setup ?? '');
      localStorage.setItem(progressKey ?? '', record ?? '');
    },
    [SETUP_STORAGE_KEY, SETUP, STORAGE_KEY, RECORD],
  );
}

/** The promise all three screens have to keep, checked after every visit. */
async function recordIsIntact(page: Page): Promise<void> {
  expect(await page.evaluate((key: string) => localStorage.getItem(key), STORAGE_KEY)).toBe(RECORD);
}

test.describe('an unreadable saved record, across every screen that mentions it', () => {
  test('the dashboard names it and promises nothing was deleted', async ({ page }) => {
    await seed(page);
    await page.goto('/study');

    await expect(page.getByRole('heading', { level: 1, name: /can.t be read/ })).toBeVisible();
    await expect(page.getByText('schema 77')).toBeVisible();
    await expect(page.getByText(/Nothing has been deleted/)).toBeVisible();
    await recordIsIntact(page);
  });

  test('progress refuses to report zeroes it cannot stand behind', async ({ page }) => {
    await seed(page);
    await page.goto('/progress');

    // The empty state is a different claim — "you have not started yet" — and
    // showing it here would deny a record the dashboard has just vouched for.
    await expect(page.getByRole('heading', { name: /haven.t set off yet/ })).toHaveCount(0);
    await expect(page.getByText(/0% of everything you have answered/)).toHaveCount(0);
    await expect(page.getByText(/0 topics touched/i)).toHaveCount(0);

    await expect(page.getByRole('heading', { level: 1, name: /nothing to chart/i })).toBeVisible();
    await expect(page.getByText(/Nothing has been deleted/)).toBeVisible();
    // A dead end is not acceptable: the way on is the screen that owns recovery.
    await expect(page.getByRole('link', { name: /what is on the device/i })).toBeVisible();
    await recordIsIntact(page);
  });

  test('settings does not count the record as empty, nor offer to erase it', async ({ page }) => {
    await seed(page);
    await page.goto('/settings');
    await page.getByRole('heading', { name: 'Your data' }).waitFor();

    // The storage meter reads the real bytes, so a "0 answered" beside it is a
    // contradiction on one panel rather than merely a wrong number.
    await expect(page.getByText(/0 sittings · 0 answered questions/)).toHaveCount(0);
    await expect(page.getByText(/There is nothing to erase yet/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Reset all progress/ })).toHaveCount(0);

    await expect(page.getByText(/cannot read, so none of it can be counted/)).toBeVisible();
    await expect(page.getByRole('link', { name: /unreadable record/i })).toBeVisible();
    await recordIsIntact(page);
  });

  test('the export still hands the learner a copy of the file it cannot read', async ({ page }) => {
    await seed(page);
    await page.goto('/settings');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export your progress' }).click();
    expect((await download).suggestedFilename()).toMatch(/^tn-drive-progress-\d{4}-\d{2}-\d{2}\.json$/);
    await recordIsIntact(page);
  });

  test('clearing it on the recovery screen puts all three screens back in step', async ({
    page,
  }) => {
    await seed(page);
    await page.goto('/study');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: /Reset saved progress/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: /first mile/i })).toBeVisible();

    await page.goto('/progress');
    await expect(page.getByRole('heading', { name: /haven.t set off yet/ })).toBeVisible();

    await page.goto('/settings');
    await expect(page.getByRole('button', { name: /Reset all progress/ })).toBeVisible();
    await expect(page.getByText(/There is nothing to erase yet/)).toBeVisible();
  });
});
