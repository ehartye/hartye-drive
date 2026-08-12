import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { LONG_HISTORY, POPULATED } from '../support/seed';

/**
 * P8 — the progress surface. State-matrix cells 9, 9-empty and 9-long.
 *
 * Every state is driven by writing a real, schema-valid record and loading the
 * page, exactly as the app itself would have written it. There is no query
 * parameter that fabricates data: a screen a reviewer can only reach by lying
 * to the app is not evidence that the screen works.
 */
async function seed(page: Page, payload: Record<string, string> | null): Promise<void> {
  if (payload) {
    await page.addInitScript((records: Record<string, string>) => {
      for (const [key, value] of Object.entries(records)) localStorage.setItem(key, value);
    }, payload);
  }
}

test.describe('progress', () => {
  test('cell 9 — readiness, both charts, topic mastery and the history road', async ({ page }) => {
    await seed(page, POPULATED());
    await page.goto('/progress');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // The readiness plate, the trend and the lanes are all present.
    // Two charts. `> svg` excludes the legends' own shape swatches, which are
    // also SVG and are the point of the key.
    await expect(page.locator('.chart > svg')).toHaveCount(2);
    await expect(page.getByRole('heading', { name: 'Readiness over time' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Accuracy by exam area' })).toBeVisible();

    // Four lanes, always — the blueprint exists before the learner does.
    const lanes = page.getByRole('img', { name: /four lanes/ });
    await expect(lanes).toBeVisible();

    // Topic mastery comes from TopicMeter, whose bands are ratified.
    await expect(page.locator('.meter').first()).toBeVisible();

    // The history is a road with nodes, not a table of rows.
    await expect(page.locator('.trace li').first()).toBeVisible();
    await expect(page.getByText(/most recent 200 answers are kept in full/)).toBeVisible();
  });

  test('every chart is backed by a table, so the figures survive without the picture', async ({
    page,
  }) => {
    await seed(page, POPULATED());
    await page.goto('/progress');
    await page.locator('.chart svg').first().waitFor();

    const tables = page.locator('table.sr-only');
    await expect(tables).toHaveCount(2);
    await expect(tables.nth(1)).toContainText('Against target');
    // The lanes table names every area, including any not yet answered.
    for (const area of [
      'Traffic signs and signals',
      'Safe driving principles',
      'Rules of the road',
      'Drugs and alcohol',
    ]) {
      await expect(tables.nth(1)).toContainText(area);
    }
  });

  test('meaning survives without colour — outcomes are shapes and words', async ({ page }) => {
    await seed(page, POPULATED());
    await page.goto('/progress');
    await page.locator('.chart svg').first().waitFor();

    // The chart's key is a key of SHAPES.
    await expect(page.getByText('Diamond = mock exam passed')).toBeVisible();
    await expect(page.getByText('Octagon = mock exam missed')).toBeVisible();
    await expect(page.getByText('Hatched = short of target')).toBeVisible();

    // And every exam row says its outcome in words next to the coloured node.
    await expect(page.getByText(/Mock exam · (passed|did not pass|ended early)/).first()).toBeVisible();
  });

  test('cell 9-empty — no attempts, and no chart drawn over nothing', async ({ page }) => {
    await page.goto('/progress');
    await expect(page.getByRole('heading', { level: 1, name: /set off yet/ })).toBeVisible();

    // The readiness chart is NOT drawn: an empty time series has nothing true
    // to say, and its axes would be theatre (state-matrix cell 9-empty).
    await expect(page.getByRole('img', { name: /road climbing toward/ })).toHaveCount(0);
    await expect(page.getByText('This chart needs one session to exist')).toBeVisible();

    // The blueprint IS drawn, because it is true before the first answer.
    await expect(page.getByRole('img', { name: /four empty lanes/ })).toBeVisible();
    await expect(page.getByText('NOT DRIVEN YET').first()).toBeVisible();

    // It reads as an invitation, not a failure.
    await expect(page.getByRole('link', { name: /Answer your first 12 questions/ })).toBeVisible();
    await expect(page.getByText('You are here')).toBeVisible();
  });

  test('cell 9-long — 50+ sittings stay legible, paged and grouped by month', async ({ page }) => {
    await seed(page, LONG_HISTORY());
    await page.goto('/progress');
    await page.locator('.chart svg').first().waitFor();

    await expect(page.locator('.tile')).toHaveCount(3);
    await expect(page.locator('.monthhead').first()).toBeVisible();

    // Paged, not dumped: the first page is bounded and the rest is one press away.
    const firstPage = await page.locator('.trace li').count();
    expect(firstPage).toBeLessThanOrEqual(20);
    const more = page.getByRole('button', { name: /Load \d+ more/ });
    await expect(more).toBeVisible();
    await more.click();
    expect(await page.locator('.trace li').count()).toBeGreaterThan(firstPage);
  });

  test('the trend’s range control narrows the road without redrawing the page', async ({ page }) => {
    await seed(page, LONG_HISTORY());
    await page.goto('/progress');
    await page.locator('.chart svg').first().waitFor();

    const group = page.getByRole('group', { name: 'Chart range' });
    await expect(group).toBeVisible();
    await group.getByRole('button', { name: 'Exams only' }).click();
    await expect(group.getByRole('button', { name: 'Exams only' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByText(/Each point is a mock exam/)).toBeVisible();
  });

  test('the trend says so when it is drawing less than the headline counts', async ({ page }) => {
    // 57 sittings of four is 228 answers; the log keeps 200. The headline reads
    // every answer ever given and the chart can only read what is retained, so
    // the page has to say which is which.
    await seed(page, LONG_HISTORY());
    await page.goto('/progress');
    await page.locator('.chart svg').first().waitFor();
    await expect(page.getByText(/no longer plotted individually/)).toBeVisible();
  });

  test('a citation-free surface still names its source and its non-affiliation', async ({
    page,
  }) => {
    await page.goto('/progress');
    await expect(page.getByText(/Not affiliated with the State of Tennessee/)).toBeVisible();
  });

  test('holds at 320px and at 200% zoom', async ({ page }) => {
    await seed(page, LONG_HISTORY());
    for (const size of [
      { width: 320, height: 900 },
      { width: 640, height: 800 }, // 1280 CSS px at 200%
    ]) {
      await page.setViewportSize(size);
      await page.goto('/progress');
      await page.locator('.chart svg').first().waitFor();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `progress scrolls horizontally at ${String(size.width)}px`).toBeLessThanOrEqual(0);
    }
  });
});
