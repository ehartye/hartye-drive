import { expect, test } from '@playwright/test';
import { servablePaths } from '~/app/route-paths';

/**
 * The sign system, checked in the running app rather than in a unit test.
 *
 * The bug this exists for: `/study/session?q=stp-002` rendered its topic icon
 * as an empty dashed `data-missing-sign` box, because the topic→sign map held
 * mockup sprite names the registry does not carry. Nothing threw and nothing
 * logged — `SignSvg` degrades quietly on purpose — so only a screenshot or an
 * assertion like this one catches it.
 */
/**
 * Derived from the router, plus the query-string variants no route table can
 * yield. A hand-typed list is how the one route that regresses gets left out.
 */
const ROUTES = [
  ...servablePaths(),
  '/study/session?q=stp-002',
  // P6: the library fully expanded is the whole registry on one page, and the
  // drill is the one screen where a missing face would be invisible — there is
  // no caption beside it to look wrong.
  '/signs?expand=all',
  '/signs/drill?seed=7',
];

test.describe('sign rendering', () => {
  for (const route of ROUTES) {
    test(`every sign on ${route} resolves to a real face`, async ({ page }) => {
      await page.goto(route);
      // Wait for the route to actually render, or the counts below pass
      // vacuously: a split route's HydrateFallback publishes its own
      // visually-hidden `<h1>Loading</h1>` before the page mounts
      // (deviations.md, P4 note 9).
      const heading = page.getByRole('heading', { level: 1 });
      await expect(heading).toBeVisible();
      await expect(heading).not.toHaveText('Loading');

      const missing = await page.locator('[data-missing-sign]').evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute('data-missing-sign')),
      );
      expect(missing, `unresolvable sign ids on ${route}`).toEqual([]);

      const pending = await page.locator('[data-pending-sign]').evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute('data-pending-sign')),
      );
      expect(pending, `registry signs with no geometry on ${route}`).toEqual([]);
    });
  }

  test('the study session draws its topic icon, not a dashed placeholder', async ({ page }) => {
    await page.goto('/study/session?q=stp-002');
    const sign = page.locator('svg.sign').first();
    await expect(sign).toBeVisible();
    // A real face paints fills; the placeholder is a single dashed stroke.
    const fills = await sign.evaluateAll((nodes) =>
      [...(nodes[0]?.querySelectorAll('[fill]') ?? [])].map((n) => n.getAttribute('fill')),
    );
    expect(fills.filter((fill) => fill !== null && fill !== 'none').length).toBeGreaterThan(0);
  });

  test('the gallery renders the whole registry with no raster or clipart', async ({ page }) => {
    await page.goto('/gallery');
    const section = page.locator('section[aria-labelledby="signs"]');
    const faces = section.locator('svg[class*="sign"]');
    await expect(faces.first()).toBeVisible();
    expect(await faces.count()).toBeGreaterThanOrEqual(80);
    // Grounding §2: hand-authored SVG only — no raster, no clipart.
    expect(await section.locator('image, img').count()).toBe(0);
  });
});
