import { test, expect } from '@playwright/test';
import { LANDSCAPE, emulateNotch, setUpDevice, visit } from './support';

/**
 * VIEWPORT HEIGHT AND ORIENTATION.
 *
 * `100vh` on iOS Safari is the height of the viewport with the browser chrome
 * *retracted* — it is larger than what the learner can actually see whenever
 * the URL bar and toolbar are showing, which is most of the time. A full-screen
 * focus mode sized in `vh` therefore hangs its bottom edge, and the action bar
 * with it, below the fold; the learner sees a question they cannot answer.
 *
 * `dvh` is the fix and the app already uses it. These tests are the guard that
 * keeps it that way, plus the case a portrait viewport never reaches: a phone
 * held sideways is 390px tall, and the three focus modes have to keep their
 * primary action on screen at that height or the product stops working.
 */

const FOCUS_MODES = ['/study/session', '/exam/run', '/signs/drill'] as const;

test.describe('viewport height', () => {
  test('nothing is sized in 100vh — dvh only (iOS Safari overshoots vh)', async ({ page }) => {
    await page.goto('/gallery');

    const offenders = await page.evaluate(() => {
      const bad: string[] = [];
      // `document.styleSheets` reaches the real, shipped CSS — including what
      // Tailwind generated — rather than the authored source a grep would see.
      for (const sheet of document.styleSheets) {
        let rules: CSSRuleList;
        try {
          rules = sheet.cssRules;
        } catch {
          continue; // cross-origin; the app has none, but never throw here
        }
        const walk = (list: CSSRuleList) => {
          for (const rule of list) {
            if (rule instanceof CSSGroupingRule) {
              walk(rule.cssRules);
              continue;
            }
            if (!(rule instanceof CSSStyleRule)) continue;
            const text = rule.style.cssText;
            // `\d` guards against matching the "vh" inside e.g. `--x-vha`.
            if (/\b\d+(\.\d+)?vh\b/.test(text)) bad.push(`${rule.selectorText} { ${text} }`);
          }
        };
        walk(rules);
      }
      return bad;
    });

    expect(
      offenders,
      `these rules size in vh, which overshoots the visible area on iOS Safari:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  test('the focus modes fit the visible viewport, not an overshot one', async ({ page }) => {
    await setUpDevice(page);
    for (const route of FOCUS_MODES) {
      await visit(page, route);
      const shell = await page.evaluate(() => {
        const el = document.querySelector('.shell--focus');
        if (!el) return null;
        return {
          minHeight: parseFloat(getComputedStyle(el).minHeight),
          innerHeight: window.innerHeight,
        };
      });
      expect(shell, `${route} renders no focus shell`).not.toBeNull();
      expect(
        shell!.minHeight,
        `${route}: the focus shell claims ${String(shell!.minHeight)}px of a ` +
          `${String(shell!.innerHeight)}px viewport`,
      ).toBeLessThanOrEqual(shell!.innerHeight + 1);
    }
  });
});

test.describe('landscape on a phone', () => {
  test.use({ viewport: LANDSCAPE });

  test('every focus mode keeps its primary action reachable', async ({ page }) => {
    await setUpDevice(page);

    for (const route of FOCUS_MODES) {
      await visit(page, route);
      await emulateNotch(page);

      // The primary action is whatever the mode asks the learner to press next:
      // a choice in the study session and the drill, "Start the exam" at the
      // exam gate. Reachability is what is being asserted — that it is on the
      // page and can be scrolled to, not that it happens to be above the fold.
      const action = page
        .locator('.choice, .actionbar button, .actionbar a')
        .first();
      await expect(action, `${route} draws no primary action in landscape`).toBeAttached();
      await action.scrollIntoViewIfNeeded();
      await expect(action).toBeInViewport();
    }
  });

  test('no route scrolls sideways in landscape', async ({ page }) => {
    await setUpDevice(page);
    for (const route of ['/study', '/signs', '/progress', '/settings', ...FOCUS_MODES]) {
      await visit(page, route);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${route} scrolls horizontally at ${String(LANDSCAPE.width)}px`).toBeLessThanOrEqual(0);
    }
  });

  /**
   * A dialog is the one thing that cannot be scrolled *past*. At 390px of
   * height a confirmation whose buttons fall below the fold, in a box that does
   * not itself scroll, is a dead end — and the exam-exit confirm is the dialog
   * a learner meets under the most pressure.
   */
  test('a confirmation dialog keeps its buttons reachable at 390px tall', async ({ page }) => {
    await setUpDevice(page);
    await visit(page, '/study/session');
    await emulateNotch(page);

    await page.getByRole('button', { name: 'End session' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const fits = await page.evaluate(() => {
      const el = document.querySelector('dialog[open]');
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      const buttons = [...el.querySelectorAll('button')];
      return {
        bottom: rect.bottom,
        top: rect.top,
        viewport: window.innerHeight,
        scrollable: /auto|scroll/.test(style.overflowY),
        lowestButton: Math.max(...buttons.map((b) => b.getBoundingClientRect().bottom)),
      };
    });

    expect(fits).not.toBeNull();
    // Either the whole dialog fits, or the dialog scrolls internally. Anything
    // else strands the buttons.
    const contained = fits!.lowestButton <= fits!.viewport + 1 && fits!.top >= -1;
    expect(
      contained || fits!.scrollable,
      `the exam-exit dialog runs from ${String(Math.round(fits!.top))} to ` +
        `${String(Math.round(fits!.bottom))} in a ${String(fits!.viewport)}px viewport and does not scroll`,
    ).toBe(true);
  });
});
