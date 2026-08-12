import { test, expect } from '@playwright/test';
import { servablePaths } from '~/app/route-paths';

/**
 * Derived from the route table, never hand-written. A literal list here once
 * excluded `/gallery/focus` — the single route that overflowed at 320px — so
 * the reflow test passed by omitting the only case that failed.
 */
const ROUTES = servablePaths();

/** `/` is an alias of `/study`, so it shares that destination's title. */
const INDEX_ALIAS = '/';

/**
 * `index.html`'s own title, which every route replaces once it mounts.
 *
 * Waiting on an `<h1>` is not enough to know a split route has arrived: the
 * `HydrateFallback` renders a visually-hidden one, and a 1px clipped element
 * still counts as visible. The title assertion below would then read the static
 * title and see several routes "share" it. Pre-existing race — it only became
 * reliable once there were enough split routes to lose it consistently.
 */
const STATIC_TITLE = 'TN Drive · Tennessee Class D knowledge test';

test.describe('foundation', () => {
  test('every destination boots and carries a unique title', async ({ page }) => {
    const titles = new Set<string>();
    for (const route of ROUTES) {
      await page.goto(route);
      // A split route's HydrateFallback publishes its own visually-hidden
      // `<h1>Loading</h1>` (deviations.md, P4 note 9), so the heading resolves
      // before the page mounts and `document.title` is still the previous
      // route's. Two routes then collide on one title and this test fails for a
      // reason that has nothing to do with titles.
      //
      // Two pieces fixed this race independently, from different angles: wait
      // for the fallback heading to go, and wait for the static title to go.
      // Both conditions are kept — either alone can still let the race through.
      const heading = page.getByRole('heading', { level: 1 });
      await expect(heading).toBeVisible();
      await expect(heading).not.toHaveText('Loading');
      await expect(page).not.toHaveTitle(STATIC_TITLE);
      const title = await page.title();
      expect(title, `${route} has no product title`).toContain('TN Drive');
      if (route !== INDEX_ALIAS) titles.add(title);
    }
    expect(titles.size).toBe(ROUTES.filter((r) => r !== INDEX_ALIAS).length);

    await page.goto(INDEX_ALIAS);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await page.title()).toBe('Study · TN Drive');
  });

  test('covers every route the router serves', () => {
    // The guard on the guard: if this list ever shrinks below the table, the
    // sweeps above silently stop covering something.
    expect(ROUTES).toContain('/gallery/focus');
    expect(ROUTES.length).toBeGreaterThanOrEqual(8);
  });

  test('makes zero requests to any third-party origin (practices B2/B3/F5)', async ({ page }) => {
    const external: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.hostname !== 'localhost' && url.protocol !== 'data:') external.push(request.url());
    });
    await page.goto('/gallery');
    await page.waitForLoadState('networkidle');
    expect(external).toEqual([]);
  });

  test('loads the self-hosted faces, not a font CDN', async ({ page }) => {
    const fonts: string[] = [];
    page.on('request', (r) => {
      if (r.resourceType() === 'font') fonts.push(new URL(r.url()).pathname);
    });
    await page.goto('/gallery');
    await page.waitForLoadState('networkidle');
    expect(fonts.length).toBeGreaterThan(0);
    for (const path of fonts) expect(path.startsWith('/fonts/')).toBe(true);
  });

  test('reflows at 320px with no horizontal scrolling (WCAG SC 1.4.10)', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    for (const route of ROUTES) {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${route} scrolls horizontally at 320px`).toBeLessThanOrEqual(0);
    }
  });

  test('keeps the focus-mode instruments whole at 320px, not clipped', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/gallery/focus');
    // The timer is the last instrument in the bar and the first thing lost when
    // the row refuses to reflow.
    const timer = page.locator('.timer');
    await expect(timer).toBeVisible();
    const box = await timer.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x, 'the timer starts off the left edge').toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width, 'the timer runs off the right edge').toBeLessThanOrEqual(320);
  });

  test('holds at 200% zoom without losing function', async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 800 }); // 1280 CSS px at 200%
    await page.goto('/gallery');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link')).toHaveCount(4);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('gives every focused control a visible ring (practices A6)', async ({ page }) => {
    await page.goto('/gallery');
    for (let i = 0; i < 25; i += 1) {
      await page.keyboard.press('Tab');
      const ring = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const s = getComputedStyle(el);
        return { width: s.outlineWidth, style: s.outlineStyle, color: s.outlineColor };
      });
      if (!ring) continue;
      expect(ring.style, 'focused element has no outline style').not.toBe('none');
      expect(parseFloat(ring.width), 'focused element has a zero-width outline').toBeGreaterThan(0);
    }
  });

  test('nav is a bottom bar on mobile and a side rail on desktop (grounding §4)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    // Setup answered: on first run `/study` is onboarding, which draws no nav
    // at all (mockups 01 / 01b — nothing to navigate to yet). This test is
    // about where the nav sits, so it starts from a set-up device.
    await page.addInitScript(() => {
      localStorage.setItem(
        'tn-drive:setup',
        JSON.stringify({
          state: { schemaVersion: 1, goal: 'class-d', testDate: null, completedAt: 1 },
          version: 1,
        }),
      );
    });
    await page.goto('/study');
    const nav = page.getByRole('navigation', { name: 'Main' });
    const mobile = await nav.boundingBox();
    const viewport = page.viewportSize();
    expect(mobile).not.toBeNull();
    expect(mobile!.y + mobile!.height).toBeGreaterThan(viewport!.height - 4);
    await expect(page.locator('.railbrand')).toBeHidden();

    await page.setViewportSize({ width: 1440, height: 900 });
    const rail = await nav.boundingBox();
    expect(rail!.x).toBeLessThan(4);
    expect(rail!.height).toBeGreaterThan(400);
    await expect(page.locator('.railbrand')).toBeVisible();
  });

  test('honours prefers-reduced-motion (practices A13)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/gallery');
    const durations = await page.evaluate(() =>
      [...document.querySelectorAll('.btn, .choice, .skel, .toast')].map((el) => {
        const s = getComputedStyle(el);
        return [s.transitionDuration, s.animationDuration].join(' ');
      }),
    );
    expect(durations.length).toBeGreaterThan(0);
    for (const d of durations) {
      expect(d).not.toMatch(/\b0\.1[5-9]s|\b1\.4s|\b0\.18s/);
    }
  });

  test('focus mode hides the nav and reclaims its offset (grounding §4)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/gallery/focus');
    await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'End session' })).toBeVisible();
    await expect(page.getByRole('progressbar')).toBeVisible();
  });

  test('a choice can be answered with the keyboard alone (practices A4)', async ({ page }) => {
    await page.goto('/gallery/focus');
    const choice = page.getByRole('button', { name: /Stop, and stay stopped/ });
    await choice.focus();
    await expect(choice).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(choice).toBeVisible();
  });

  test('an unknown deep link lands on a recoverable screen, not a blank one', async ({ page }) => {
    await page.goto('/definitely-not-a-route');
    await expect(page.getByRole('heading', { level: 1, name: /Wrong turn/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Back to studying/ })).toBeVisible();
  });
});
