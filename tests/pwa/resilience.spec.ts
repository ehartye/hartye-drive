import { expect, test } from '@playwright/test';
import { STORAGE_KEY } from '~/domain/persistence';
import { SETUP_STORAGE_KEY, completeSetup, emptySetup, serializeSetup } from '~/domain/setup';
import { answerExam, watchConsole } from './support';

/**
 * X19–X22, against the **production** build.
 *
 * P7 already drives these scenarios on the dev server. They are re-run here for
 * a reason that is not redundancy: minification, the service worker and the
 * navigation fallback are all only present in `dist/`, and every one of them
 * is a plausible way for a recoverable screen to turn into a white one. A
 * corrupt record served by a service worker out of a precache is the case a
 * learner in a parking lot actually hits.
 */

const SETUP = serializeSetup(
  completeSetup(emptySetup(), { goal: 'class-d', testDate: '2026-09-12', at: 1_760_000_000_000 }),
);

test.describe('resilience in the production build', () => {
  test('X19 — garbage in a persisted key lands on a recoverable screen, not a white one', async ({
    page,
  }) => {
    const noise = watchConsole(page);
    await page.addInitScript(
      ([setupKey, setup, progressKey]: string[]) => {
        localStorage.setItem(setupKey ?? '', setup ?? '');
        localStorage.setItem(progressKey ?? '', '{"garbage":true');
      },
      [SETUP_STORAGE_KEY, SETUP, STORAGE_KEY],
    );

    await page.goto('/study');

    await expect(page.getByRole('heading', { level: 1, name: /can.t be read/ })).toBeVisible();
    // Recoverable: a way out that is not a reset, and a reset that is gated.
    await expect(page.getByRole('link', { name: /Study without saving/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Reset saved progress/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    // The unreadable bytes are still on the device, untouched.
    expect(await page.evaluate(() => localStorage.getItem('tn-drive:progress'))).toBe(
      '{"garbage":true',
    );

    // And it is not a boot loop: a reload lands on the same screen, still calm.
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: /can.t be read/ })).toBeVisible();
    expect(noise.filter((line) => !line.includes('favicon')), noise.join('\n')).toEqual([]);
  });

  test('X20 — a far-future schemaVersion is refused by name and offers a reset', async ({
    page,
  }) => {
    const payload = JSON.stringify({
      version: 9_999,
      state: { attempts: [{ at: 1 }, { at: 2 }] },
    });
    await page.addInitScript(
      ([setupKey, setup, progressKey, future]: string[]) => {
        localStorage.setItem(setupKey ?? '', setup ?? '');
        localStorage.setItem(progressKey ?? '', future ?? '');
      },
      [SETUP_STORAGE_KEY, SETUP, STORAGE_KEY, payload],
    );

    await page.goto('/study');

    await expect(page.getByRole('heading', { level: 1, name: /can.t be read/ })).toBeVisible();
    await expect(page.getByText('schema 9999')).toBeVisible();
    await expect(page.getByText(/newer version of TN Drive/)).toBeVisible();

    // The offered reset is real: gated, then it clears the file.
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: /Reset saved progress/ }).click();
    await expect(page.locator('.speedplate')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('tn-drive:progress'))).not.toBe(payload);
  });

  test('X21 — a storage that throws becomes session-only mode, not an unhandled rejection', async ({
    page,
  }) => {
    const noise = watchConsole(page);
    let rejections = 0;
    page.on('console', (message) => {
      if (/unhandled/i.test(message.text())) rejections += 1;
    });

    await page.addInitScript(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException('QuotaExceededError');
      };
    });
    await page.goto('/study');

    await expect(
      page.getByRole('heading', { level: 1, name: /won.t let the app save/ }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /Check storage again/ })).toBeVisible();

    await page.getByRole('button', { name: /Continue in session-only mode/ }).click();
    await expect(page.locator('.speedplate')).toBeVisible();

    // And a session really runs in that mode — answering must not throw on the
    // write it cannot make.
    await page.goto('/study/session?q=stp-002');
    await expect(page.locator('.stem')).toBeVisible();
    await page.locator('.choice').first().click();
    await expect(page.locator('.panel--guide')).toBeVisible();

    expect(rejections).toBe(0);
    expect(noise, noise.join('\n')).toEqual([]);
  });

  test('X22 — a full study session and a full exam, with zero console noise', async ({ page }) => {
    test.setTimeout(180_000);
    const noise = watchConsole(page);

    /* ---- a whole study session, answered to the end ---- */
    await page.goto('/study/session?seed=11&n=6');
    await expect(page.locator('.stem')).toBeVisible();
    for (let i = 0; i < 6; i += 1) {
      await page.locator('.choice').nth(i % 3).click();
      await page.getByRole('button', { name: /Next question|Finish session/ }).click();
    }
    await expect(page.getByRole('heading', { level: 1, name: /of 6 right/ })).toBeVisible();

    /* ---- a whole exam, scored, reported and reviewed ---- */
    await page.goto('/exam/run?seed=13');
    await page.getByRole('button', { name: /Start the exam/ }).click();
    await expect(page.locator('.stem')).toBeVisible();
    for (let i = 0; i < 30; i += 1) {
      if ((await page.locator('[data-qid]').count()) === 0) break;
      await answerExam(page, !(i === 4 || i === 11 || i === 20));
    }
    await expect(page).toHaveURL(/\/exam\/report/);
    await expect(page.getByRole('heading', { level: 1, name: 'You passed' })).toBeVisible();

    await page.getByRole('link', { name: /Review all 30 answers/ }).click();
    await expect(page.locator('.rev')).toHaveCount(30);

    /* ---- and the surfaces that read what those two just wrote ---- */
    await page.goto('/progress');
    await expect(page.locator('.chart svg').first()).toBeVisible();

    expect(noise, noise.join('\n')).toEqual([]);
  });

  test('C6 — a chunk that cannot be fetched renders the recoverable state, never a blank page', async ({
    page,
  }) => {
    // Settings is code-split. Killing its chunk is the realistic version of
    // "the render threw": a deploy that moved the file, or a cache that has
    // one build's HTML and another's assets.
    await page.route(/\/assets\/Settings-.*\.js$/, (route) => route.abort());
    await page.goto('/settings');

    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      /could not be drawn|went wrong/i,
    );
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible();
    // The page has real content, not an empty root.
    expect(await page.locator('#root').innerText()).not.toBe('');
  });
});
