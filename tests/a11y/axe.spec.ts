import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { servablePaths } from '../../src/app/route-paths';

/**
 * X15 — zero violations at wcag2a, wcag2aa, wcag21aa, wcag22aa across every
 * route P1 stands up, plus the gallery, which is the whole component vocabulary
 * in every state on one page. P4–P8 extend this to their own state-matrix cells.
 */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/**
 * Derived from the router, never hand-maintained. A blind critic found the
 * reflow spec passing only because its literal route list omitted the one
 * route that failed; a list you have to remember to update is a list that
 * silently stops covering things. Plus the 404, which no route table yields.
 */
const ROUTES = [...servablePaths(), '/definitely-not-a-route'];

test('covers every route the router serves', () => {
  for (const path of servablePaths()) expect(ROUTES).toContain(path);
});

for (const route of ROUTES) {
  test(`axe: ${route}`, async ({ page }) => {
    await page.goto(route);
    await page.getByRole('heading', { level: 1 }).first().waitFor();
    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    expect(
      results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
    ).toEqual([]);
  });
}

test('axe: the open dialog traps and is labelled', async ({ page }) => {
  await page.goto('/gallery');
  await page.getByRole('button', { name: 'Open the confirmation' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});
