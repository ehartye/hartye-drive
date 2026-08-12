import { test, expect } from '@playwright/test';

/**
 * P8 — the rule reference, state-matrix cell 10, and the thing it exists for:
 * a citation opened from an explanation has to land on the right rule.
 *
 * `R119` is the sign-colour rule (three related signs, a real verbatim quote);
 * `R225` is the railroad stopping distance mockup 10 is drawn around.
 */
test.describe('rule reference', () => {
  test('cell 10 — the rule, the verbatim quote and BOTH page numbers', async ({ page }) => {
    await page.goto('/rules/R225');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Railroad stop distance');

    await expect(page.locator('.plain')).toContainText('15 and 50 feet');
    const cite = page.locator('.cite__src');
    // Both numbers, always: the manual's own answer pointers use printed
    // numbers, and mixing them sends a learner to the wrong page (D16).
    await expect(cite).toContainText('PDF p. 64');
    await expect(cite).toContainText('printed p. 50');
    await expect(page.locator('.cite__quote').first()).toContainText(
      'you must stop between 15 and 50 feet from the railroad tracks',
    );
  });

  test('shows the signs a rule’s questions depend on, as real MUTCD faces', async ({ page }) => {
    await page.goto('/rules/R119');
    await page.locator('.plain').waitFor();
    await expect(page.getByRole('heading', { name: /Signs that carry this rule/ })).toBeVisible();
    const signs = page.locator('.relsign');
    expect(await signs.count()).toBeGreaterThanOrEqual(2);
    await expect(signs.first().locator('svg')).toBeVisible();
    // Not clipart: the registry's own hand-authored geometry.
    await expect(page.locator('[data-missing-sign]')).toHaveCount(0);
  });

  test('offers the rest of the topic, and each sibling is itself followable', async ({ page }) => {
    await page.goto('/rules/R225');
    await page.locator('.plain').waitFor();
    const siblings = page.locator('.rulelist a');
    expect(await siblings.count()).toBeGreaterThan(0);
    const href = await siblings.first().getAttribute('href');
    expect(href).toMatch(/^\/rules\/R\d+$/);
    await siblings.first().click();
    await expect(page.locator('.plain')).toBeVisible();
  });

  test('“practice this topic” starts a real session on that topic', async ({ page }) => {
    await page.goto('/rules/R225');
    const practice = page.getByRole('link', { name: /^Practice / });
    await expect(practice).toBeVisible();
    await practice.click();
    await expect(page.locator('.stem')).toBeVisible();
    await expect(page.locator('.choice').first()).toBeVisible();
  });

  test('a citation opened from a study explanation lands on the right rule', async ({ page }) => {
    // The whole reason this route exists. Answer a question, follow the
    // citation under the rule, and confirm the page names the same rule the
    // explanation quoted.
    await page.goto('/study/session?q=stp-002');
    await page.locator('.choice').first().waitFor();
    await page.locator('.choice').first().click();
    await page.locator('.panel--guide').waitFor();

    const link = page.locator('.citelink');
    await expect(link).toBeVisible();
    const quoted = (await page.locator('.cite__quote').first().innerText()).replace(/[“”]/g, '');

    await link.click();
    await expect(page).toHaveURL(/\/rules\/R\d+/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // The same manual sentence, on the page the citation pointed at.
    await expect(page.locator('.cite__quote').first()).toContainText(quoted.slice(0, 40));
  });

  test('an unknown rule id is a recoverable screen, never a white one', async ({ page }) => {
    await page.goto('/rules/R99999');
    await expect(page.getByRole('heading', { level: 1, name: 'No such rule' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Back to studying/ })).toBeVisible();
  });

  /**
   * Two pages in this app have several parents and no single "up": this one,
   * and settings. Both must go back where the learner came from — and neither
   * may leave a dead control on a cold deep link, which is a supported entry
   * (deep links work offline, grounding §1).
   */
  test('back goes where you came from, and still works on a cold deep link', async ({ page }) => {
    // A fresh tab straight onto a rule: no in-app history, so "back" must be a
    // real destination rather than a `navigate(-1)` that does nothing at all.
    await page.goto('/rules/R225');
    await page.locator('.plain').waitFor();
    const cold = page.getByRole('link', { name: 'Back' });
    await expect(cold).toBeVisible();

    // Follow a sibling rule — now there IS somewhere to go back to, and back
    // means there rather than the fixed fallback.
    await page.locator('.rulelist a').first().click();
    await page.locator('.plain').waitFor();
    await expect(page).not.toHaveURL(/R225$/);
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page).toHaveURL(/\/rules\/R225$/);
  });

  test('settings goes back to whichever screen sent you there', async ({ page }) => {
    await page.goto('/rules/R119');
    await page.locator('.plain').waitFor();
    await page.getByRole('link', { name: /See every correction we apply/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: /Settings/ })).toBeVisible();
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page).toHaveURL(/\/rules\/R119$/);
  });

  test('holds at 320px with no horizontal scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto('/rules/R119');
    await page.locator('.plain').waitFor();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
