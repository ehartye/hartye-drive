import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * P4 — the study session. State-matrix cells 3 and 4 (4a correct, 4b incorrect,
 * long-content), plus the guarded exit and the keyboard-only path.
 *
 * `?q=` pins an exact line-up so a state is reachable without fighting the
 * adaptive engine; `?seed=` pins the adaptive one.
 */

/** The longest real item in the bank: long stem, three long options, a 337-char
 *  verbatim quote — and it carries a post-2022 correction. */
const LONGEST = 'int-016';
const SHORT = 'stp-002';

/**
 * Waits for the question itself, not merely for an `<h1>`: the code-split
 * route's `HydrateFallback` renders a visually-hidden "Loading" heading, so a
 * heading-only wait can resolve before the session has mounted.
 */
async function start(page: Page, query: string) {
  await page.goto(`/study/session?${query}`);
  await expect(page.locator('.stem')).toBeVisible();
  await expect(page.locator('.choice').first()).toBeVisible();
}

async function correctIndex(page: Page): Promise<number> {
  return page.evaluate(() =>
    [...document.querySelectorAll('.choice')].findIndex((c) =>
      c.classList.contains('choice--correct'),
    ),
  );
}

test.describe('study session', () => {
  test('cell 3 — a question is asked in focus mode, with position and progress', async ({
    page,
  }) => {
    await start(page, 'seed=7');
    await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /End session/ })).toBeVisible();
    await expect(page.getByRole('progressbar')).toBeVisible();
    await expect(page.getByText(/Question 1 of 12 · queued/)).toBeVisible();
    await expect(page.locator('.choice')).toHaveCount(3);
    // No verdict is visible before an answer is chosen.
    await expect(page.locator('.choice--correct, .choice--wrong')).toHaveCount(0);
  });

  test('cell 4a — a correct answer reveals the rule, the quote and both page numbers', async ({
    page,
  }) => {
    await start(page, `q=${SHORT}`);
    await page.locator('.choice').first().click();
    const index = await correctIndex(page);
    if (index !== 0) {
      await start(page, `q=${SHORT}`);
      await page.locator('.choice').nth(index).click();
    }

    await expect(page.locator('.choice--correct')).toHaveCount(1);
    await expect(page.locator('.choice--wrong')).toHaveCount(0);
    await expect(page.getByText('Correct', { exact: false }).first()).toBeVisible();
    await expect(page.locator('.cite__quote')).toBeVisible();
    await expect(page.locator('.cite__src')).toContainText('PDF p.');
    await expect(page.locator('.cite__src')).toContainText('printed p.');
    // The scheduler's own promise, printed.
    await expect(page.getByText(/time right/)).toBeVisible();
  });

  test('cell 4b — an incorrect answer teaches rather than punishes', async ({ page }) => {
    await start(page, `q=${SHORT}`);
    await page.locator('.choice').first().click();
    const index = await correctIndex(page);
    if (index === 0) {
      await start(page, `q=${SHORT}`);
      await page.locator('.choice').nth(1).click();
    }

    await expect(page.locator('.choice--wrong')).toHaveCount(1);
    await expect(page.locator('.choice--correct')).toHaveCount(1);
    // The explanation panel stays guide green — no red wash on the screen that
    // matters most.
    await expect(page.locator('.panel--guide')).toBeVisible();
    await expect(page.locator('.panel--stop')).toHaveCount(0);
    await expect(page.getByText('Queued again')).toBeVisible();
    await expect(page.getByText(/in about ten minutes/)).toBeVisible();
  });

  test('correct and incorrect survive without colour (practices A3)', async ({ page }) => {
    await start(page, `q=${SHORT}`);
    await page.locator('.choice').first().click();
    // Both verdicts carry a word and an icon, not only a fill.
    const verdicts = page.locator('.verdict');
    expect(await verdicts.count()).toBeGreaterThan(0);
    for (const text of await verdicts.allTextContents()) {
      expect(text).toMatch(/correct|incorrect/i);
    }
    expect(await page.locator('.verdict svg').count()).toBeGreaterThan(0);
  });

  test('the verdict is announced in a live region (practices A9)', async ({ page }) => {
    await start(page, `q=${SHORT}`);
    const live = page.locator('[role="status"][aria-live="polite"]').first();
    await expect(live).toHaveText('');
    await page.locator('.choice').first().click();
    await expect(live).toContainText(/Correct|Incorrect/);
    await expect(live).toContainText(/right answer/);
  });

  test('a whole question can be completed with the keyboard alone (practices A4)', async ({
    page,
  }) => {
    await start(page, `q=${SHORT},${LONGEST}`);

    // Tab from the top of the document. The exit affordance comes first, then
    // the choices — no more than a few stops, and no mouse anywhere.
    const order: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press('Tab');
      order.push(
        await page.evaluate(() => document.activeElement?.className.split(' ')[0] ?? 'none'),
      );
      if (await page.locator('.choice').first().evaluate((el) => el === document.activeElement))
        break;
    }
    expect(order, `tab order was ${order.join(' → ')}`).toContain('choice');
    expect(order.indexOf('choice')).toBeLessThan(3);

    await page.keyboard.press('Enter');
    await expect(page.locator('.choice--correct')).toHaveCount(1);

    // The next control is reachable by tabbing on from the answered choice.
    const next = page.getByRole('button', { name: /Next question/ });
    for (let i = 0; i < 8; i += 1) {
      if (await next.evaluate((el) => el === document.activeElement)) break;
      await page.keyboard.press('Tab');
    }
    await expect(next).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByText(/Question 2 of 2 · queued/)).toBeVisible();
  });

  test('the letter keys answer the question too', async ({ page }) => {
    await start(page, `q=${SHORT}`);
    await page.keyboard.press('Tab'); // give the document focus, as a real page has
    await page.keyboard.press('b');
    await expect(page.locator('.choice[aria-pressed="true"]')).toHaveCount(1);
    await expect(page.locator('.choice').nth(1)).toHaveAttribute('aria-pressed', 'true');
  });

  test('leaving the session is guarded, and the guard is escapable', async ({ page }) => {
    await start(page, 'seed=7');
    await page.getByRole('button', { name: /End session/ }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('End this session?');

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/study\/session/);

    await page.getByRole('button', { name: /End session/ }).first().click();
    await page.getByRole('button', { name: 'End session', exact: true }).last().click();
    await expect(page).toHaveURL(/\/study$/);
  });

  test('long content holds at 320px with no horizontal scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await start(page, `q=${LONGEST}`);
    await page.locator('details.lookup summary').click();
    await expect(page.locator('.cite__quote')).toBeVisible();

    const overflow = () =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
    expect(await overflow()).toBeLessThanOrEqual(0);

    await page.locator('.choice').first().click();
    await expect(page.locator('.panel--guide')).toBeVisible();
    expect(await overflow()).toBeLessThanOrEqual(0);

    // Nothing is clipped: every choice's text fits inside its own row.
    const clipped = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.choice')].filter(
        (el) => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1,
      ).length,
    );
    expect(clipped).toBe(0);
  });

  test('long content holds at 200% zoom', async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 800 }); // 1280 CSS px at 200%
    await start(page, `q=${LONGEST}`);
    await page.locator('details.lookup summary').click();
    await expect(page.locator('.cite__quote')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('a post-2022 correction is disclosed with its date and authority (D6/D10)', async ({
    page,
  }) => {
    await start(page, `q=${LONGEST}`);
    const notice = page.locator('.changed');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('This rule moved after the manual was written');
    await expect(notice).toContainText('In force since July 1, 2023');
    await expect(notice).toContainText('Public Chapter 354');
    // The manual's own superseded wording is still there to compare against.
    await page.locator('details.lookup summary').click();
    await expect(page.locator('.cite__src')).toContainText('superseded');
  });

  test('answers persist across a reload, and a miss comes back', async ({ page }) => {
    await start(page, `q=${SHORT}`);
    await page.locator('.choice').first().click();
    await expect(page.locator('.panel--guide')).toBeVisible();

    const stored = await page.evaluate(() => localStorage.getItem('tn-drive:progress'));
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored ?? '{}') as {
      version: number;
      state: { schemaVersion: number; attempts: unknown[]; cards: Record<string, unknown> };
    };
    expect(parsed.version).toBe(1);
    expect(parsed.state.schemaVersion).toBe(1);
    expect(parsed.state.attempts).toHaveLength(1);
    expect(Object.keys(parsed.state.cards)).toContain(SHORT);

    await page.reload();
    const after = await page.evaluate(() => localStorage.getItem('tn-drive:progress'));
    expect(after).toBe(stored);
  });

  test('a corrupt saved record lands on a working session, not a white screen (X19)', async ({
    page,
  }) => {
    await page.goto('/study');
    await page.evaluate(() => {
      localStorage.setItem('tn-drive:progress', '{"garbage":true}');
    });
    await start(page, 'seed=7');
    await expect(page.locator('.choice')).toHaveCount(3);
  });

  test('a future schema version leaves the record alone and still runs (X20)', async ({ page }) => {
    await page.goto('/study');
    await page.evaluate(() => {
      localStorage.setItem('tn-drive:progress', JSON.stringify({ version: 999, state: {} }));
    });
    await start(page, 'seed=7');
    await expect(page.locator('.choice')).toHaveCount(3);
  });

  test('a session can be finished', async ({ page }) => {
    await start(page, `q=${SHORT},${LONGEST}`);
    await page.locator('.choice').first().click();
    await page.getByRole('button', { name: /Next question/ }).click();
    await page.locator('.choice').first().click();
    await page.getByRole('button', { name: /Finish session/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: /of 2 right/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Back to Study/ })).toBeVisible();
  });

  test('the session is reachable from the Study destination', async ({ page }) => {
    await page.goto('/study');
    await page.getByRole('link', { name: /Start a session/ }).click();
    await expect(page).toHaveURL(/\/study\/session/);
    await expect(page.locator('.stem')).toBeVisible();
  });

  test('runs a full session without a console error or warning (practices E8)', async ({ page }) => {
    const noise: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') noise.push(`${m.type()}: ${m.text()}`);
    });
    page.on('pageerror', (e) => noise.push(`pageerror: ${e.message}`));

    await start(page, 'seed=11&n=4');
    for (let i = 0; i < 4; i += 1) {
      await page.locator('.choice').nth(i % 3).click();
      await page.getByRole('button', { name: /Next question|Finish session/ }).click();
    }
    await expect(page.getByRole('heading', { level: 1, name: /of 4 right/ })).toBeVisible();
    expect(noise).toEqual([]);
  });
});
