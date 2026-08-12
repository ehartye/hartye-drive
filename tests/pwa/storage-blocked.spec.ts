import { test, expect } from '@playwright/test';

/**
 * The bug this file exists for: a store called `useXStore.setState(...)` from a
 * storage-failure callback that fires at module scope, before the binding is
 * initialised. The result is a `ReferenceError` during module evaluation — so
 * React never mounts, no error boundary runs, and the learner is left on the
 * static boot plate forever.
 *
 * It was found, fixed and documented in four stores, and then reintroduced in a
 * fifth added later. Hence a test, not a comment.
 *
 * X21's own wording is "`localStorage.setItem` stubbed to throw", and the
 * existing suites stub exactly that — the mild variant. A blocked site-data
 * policy throws on the *property access*, which is the variant that broke.
 */

const BLOCK_ACCESS = `Object.defineProperty(window, 'localStorage', {
  configurable: true,
  get() { throw new DOMException('blocked', 'SecurityError'); },
});`;

const BLOCK_SETITEM = `Storage.prototype.setItem = function () {
  throw new DOMException('quota', 'QuotaExceededError');
};`;

const ROUTES = ['/', '/study', '/exam', '/signs', '/progress', '/settings'];

for (const [name, script] of [
  ['the property access throws (blocked site data)', BLOCK_ACCESS],
  ['setItem throws (quota / private mode)', BLOCK_SETITEM],
  ['both throw', `${BLOCK_ACCESS}\n${BLOCK_SETITEM}`],
] as const) {
  test(`the app still mounts when ${name}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(script);

    for (const route of ROUTES) {
      await page.goto(route);
      // The boot plate in index.html is static markup that React replaces on
      // mount. If a module threw during evaluation, the plate is all there is —
      // which is exactly what the learner saw. No app source change needed to
      // detect it: the plate's own copy is the tell.
      await expect(
        page.getByText('it opens at zero bytes of network'),
        `${route} never mounted — the learner sees only the static boot plate`,
      ).toBeHidden({ timeout: 10_000 });
    }

    expect(
      errors.filter((e) => /before initialization/i.test(e)),
      'a store touched its own binding from a module-scope storage callback',
    ).toEqual([]);
    expect(errors, 'uncaught error while storage is unavailable').toEqual([]);
  });
}

test('blocked storage offers session-only mode rather than failing silently', async ({ page }) => {
  await page.addInitScript(BLOCK_ACCESS);
  await page.goto('/');
  await expect(page.getByText(/save|storage|session/i).first()).toBeVisible();
});
