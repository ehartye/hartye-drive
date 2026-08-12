import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Advancing must put the next question at the top of the screen.
 *
 * The failure this covers: you answer, the explanation opens *below* the
 * choices, you scroll down to read it, and you press Next — and the new
 * question renders while the page stays where it was, so you land in the
 * middle of a question you have not read yet. On a phone, where the
 * explanation is several screens tall, you can arrive below the answers.
 *
 * Each surface already moved focus to the stage, which normally scrolls an
 * element into view — but only if it is actually out of view, and the stage
 * wrapper is tall enough to still be partly visible. So nothing moved.
 */

/**
 * A deliberately short viewport, so every surface genuinely overflows and the
 * precondition ("the page is scrolled down") is real rather than incidental.
 * A phone in landscape is shorter than this.
 */
test.use({ viewport: { width: 390, height: 480 } });

const scrollY = (page: Page) => page.evaluate(() => window.scrollY);

async function scrollToBottom(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  // Let the scroll settle before asserting on it.
  await expect
    .poll(async () => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(0);
}

test.describe('advancing starts the next item at the top', () => {
  test('study session — after reading an explanation', async ({ page }) => {
    await page.goto('/study/session?seed=7');
    await page.locator('.choice').first().waitFor();

    await page.locator('.choice').first().click();
    await page.locator('.panel--guide').waitFor();

    await scrollToBottom(page);
    expect(await scrollY(page), 'precondition: the page is scrolled down').toBeGreaterThan(0);

    await page.getByRole('button', { name: /Next question/ }).click();
    await page.locator('.choice').first().waitFor();

    expect(await scrollY(page), 'the next question did not start at the top').toBe(0);
  });

  test('exam — no explanation to read, but a long question still scrolls', async ({ page }) => {
    await page.goto('/exam/run?seed=7');
    await page.getByRole('button', { name: /Start the exam/ }).click();
    await page.locator('.choice').first().waitFor();

    await page.locator('.choice').first().click();
    await scrollToBottom(page);
    expect(await scrollY(page)).toBeGreaterThan(0);

    await page.getByRole('button', { name: /Next question|Finish the exam/ }).click();
    await page.locator('.choice').first().waitFor();

    expect(await scrollY(page), 'the next exam question did not start at the top').toBe(0);
  });

  test('sign drill — after the answer is revealed', async ({ page }) => {
    await page.goto('/signs/drill?seed=7');
    await page.locator('.choice').first().waitFor();

    await page.locator('.choice').first().click();
    await scrollToBottom(page);
    expect(await scrollY(page)).toBeGreaterThan(0);

    await page.getByRole('button', { name: /Next sign|Finish drill/ }).click();
    await page.locator('.choice').first().waitFor();

    expect(await scrollY(page), 'the next sign did not start at the top').toBe(0);
  });

  test('focus lands on the new item, not the button that was pressed', async ({ page }) => {
    await page.goto('/study/session?seed=7');
    await page.locator('.choice').first().waitFor();
    await page.locator('.choice').first().click();
    await page.locator('.panel--guide').waitFor();
    await page.getByRole('button', { name: /Next question/ }).click();
    await page.locator('.choice').first().waitFor();

    // Focus on the advance button would leave a screen-reader user reading
    // from three screens down the previous answer.
    const focused = await page.evaluate(() => document.activeElement?.tagName ?? null);
    expect(focused).not.toBe('BUTTON');
  });
});
