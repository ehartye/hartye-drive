import { test, expect } from '@playwright/test';
import { blocksFor, setUpDevice, stylesheetText, visit } from './support';

/**
 * TAP BEHAVIOUR AND SCROLLING.
 *
 * The failures here are all things a mouse never does.
 *
 * **Double-tap zoom.** A control without `touch-action: manipulation` is a
 * double-tap-to-zoom target on iOS Safari. Answering two questions quickly, or
 * an impatient second tap on a choice that has already been taken, zooms the
 * page instead. `manipulation` keeps pan and pinch-zoom — the learner loses
 * nothing — and drops only the double-tap gesture, which also removes the
 * legacy 300ms click delay wherever it survives.
 *
 * **Selection fighting taps.** A long press, or a tap that drags a pixel,
 * starts a text selection on a `<button>` unless told not to. On the sign cards
 * that means the iOS selection callout appears over the sign the learner is
 * trying to learn. Prose is deliberately left selectable — a manual quotation
 * is something a learner may well want to copy.
 *
 * **Scroll chaining.** Scrolling past the end of a dialog hands the scroll to
 * the page underneath, which then sits behind the dialog at a different offset.
 * `overscroll-behavior: contain` is the fix and is honoured on iOS Safari 16+.
 */

test.describe('tap behaviour', () => {
  test('no interactive control leaves double-tap zoom enabled', async ({ page }) => {
    await setUpDevice(page);
    const offenders: string[] = [];

    for (const route of ['/study/session', '/exam/run', '/signs', '/signs/drill', '/settings']) {
      await visit(page, route);

      const bad = await page.evaluate(() => {
        const out: string[] = [];
        const sel = 'button, a[href], [role="button"], summary, label.pick, label.gate';
        for (const el of document.querySelectorAll(sel)) {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          const action = getComputedStyle(el).touchAction;
          // `manipulation` and `none` both suppress the double-tap gesture.
          if (action === 'manipulation' || action === 'none') continue;
          out.push(
            `${location.pathname}  ${el.tagName}.${String(
              (typeof el.className === 'string' ? el.className : '').split(' ')[0],
            )} "${(el.textContent ?? '').trim().slice(0, 30)}" → touch-action: ${action}`,
          );
        }
        return out;
      });
      offenders.push(...bad);
    }

    expect(
      offenders,
      `these controls double-tap-to-zoom on iOS:\n${[...new Set(offenders)].join('\n')}`,
    ).toEqual([]);
  });

  test('a second tap on an answered choice does not zoom the page', async ({ page }) => {
    await setUpDevice(page);
    await visit(page, '/study/session');
    const choice = page.locator('.choice').first();
    await expect(choice).toBeVisible();

    const before = await page.evaluate(() => visualViewport?.scale ?? 1);
    // `force`, because answering marks every choice `aria-disabled` and the
    // second tap is exactly the impatient one this test is about — Playwright's
    // actionability check would otherwise refuse to deliver it.
    await choice.tap();
    await choice.tap({ force: true });
    const after = await page.evaluate(() => visualViewport?.scale ?? 1);

    expect(after, 'a double tap on an answer choice zoomed the page').toBe(before);
  });

  test('sign cards and choices do not start a text selection under the thumb', async ({ page }) => {
    await setUpDevice(page);
    await visit(page, '/signs');

    const selectable = await page.evaluate(() => {
      const out: string[] = [];
      // Widgets, not every anchor: an inline citation link lives inside a
      // manual quotation, and `user-select: none` there would punch a hole in
      // a selection the learner has every reason to want. See `base.css`.
      for (const el of document.querySelectorAll(
        'button, [role="button"], .signcard, nav.nav a, a.btn, .chip, .choice',
      )) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        const style = getComputedStyle(el);
        // WebKit implements this as `-webkit-user-select` and reports nothing
        // for the unprefixed name, so both have to be asked. The app declares
        // both; reading only `userSelect` would report every control on WebKit
        // as selectable when none of them are.
        const select = style.userSelect || style.webkitUserSelect;
        if (select === 'none') continue;
        out.push(
          `${el.tagName}.${String((typeof el.className === 'string' ? el.className : '').split(' ')[0])}`,
        );
      }
      return [...new Set(out)];
    });

    expect(
      selectable,
      `a long press on these raises the iOS selection callout:\n${selectable.join('\n')}`,
    ).toEqual([]);
  });

  /**
   * The other half of the same rule: the app must NOT have reached for a blanket
   * `user-select: none`. A learner reading a manual quotation has every reason
   * to want to copy it, and the citation is the thing that makes this app
   * trustworthy (practices D1/D2).
   */
  test('manual quotations stay selectable', async ({ page }) => {
    await setUpDevice(page);
    await visit(page, '/rules/R225');

    const bodyUserSelect = await page.evaluate(() => {
      const quote = document.querySelector('blockquote, .quote, .explain__quote');
      const target = quote ?? document.querySelector('main p');
      if (!target) return null;
      const style = getComputedStyle(target);
      return style.userSelect || style.webkitUserSelect;
    });
    expect(bodyUserSelect).not.toBe('none');
  });
});

test.describe('scrolling', () => {
  test('a dialog does not chain its scroll into the page behind it', async ({ page }) => {
    await setUpDevice(page);
    // The study session's exit confirm: a real modal on a real focus mode. The
    // exam's confirm needs a started attempt, and `/exam/run` cold shows only
    // the pre-flight gate, whose "Leave" is a plain link.
    await visit(page, '/study/session');
    await page.getByRole('button', { name: 'End session' }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const contained = await dialog.evaluate((el) => getComputedStyle(el).overscrollBehavior);
    // The build of WebKit Playwright ships does not implement
    // `overscroll-behavior` at all, so it drops the declaration on parse and
    // the CSSOM reports a correct stylesheet as empty. iOS Safari has honoured
    // it since 16. The assertion is therefore on the shipped bytes; see
    // deviations.md for the engine gap.
    const declared = blocksFor(await stylesheetText(page), /\.dialog(?![\w-])/).some((block) =>
      /overscroll-behavior\s*:\s*(contain|none)/.test(block),
    );

    expect(
      declared,
      'the dialog declares no overscroll-behavior, so scrolling past its end moves the page behind it',
    ).toBe(true);
    // Where the engine does implement it, the computed value must be right too.
    // WebKit reports `undefined` rather than an empty string for a property it
    // does not have at all, so the guard has to be truthiness, not `!== ''`.
    if (contained) expect(['contain', 'none']).toContain(contained);
  });

  test('the page underneath a dialog cannot be scrolled away', async ({ page, browserName }) => {
    // Mobile WebKit exposes no wheel; the equivalent gesture is a touch drag,
    // which a native modal already blocks by making the page inert. The
    // declaration-level assertion above covers this engine.
    test.skip(browserName === 'webkit', 'mouse.wheel is unsupported in mobile WebKit');
    await setUpDevice(page);
    await visit(page, '/study/session');

    const before = await page.evaluate(() => window.scrollY);
    await page.getByRole('button', { name: 'End session' }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.mouse.wheel(0, 600);
    const after = await page.evaluate(() => window.scrollY);

    expect(after, 'the page scrolled underneath an open modal dialog').toBe(before);
  });

  test('momentum scrolling is not disabled anywhere', async ({ page }) => {
    await setUpDevice(page);
    await page.goto('/signs');
    // `-webkit-overflow-scrolling: touch` is the legacy opt-IN; the failure mode
    // in 2026 is a container that sets `overflow: hidden` on the scrolling
    // element and traps the page instead.
    const trapped = await page.evaluate(() => {
      const html = getComputedStyle(document.documentElement);
      const body = getComputedStyle(document.body);
      return {
        htmlOverflowY: html.overflowY,
        bodyOverflowY: body.overflowY,
        htmlHeight: html.height,
      };
    });
    expect(trapped.htmlOverflowY).not.toBe('hidden');
    expect(trapped.bodyOverflowY).not.toBe('hidden');
  });
});
