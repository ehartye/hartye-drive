import { test, expect, type Page } from '@playwright/test';
import { servablePaths } from '~/app/route-paths';
import type { Target } from './support';
import { describe, measureTargets, setUpDevice, visit } from './support';

/**
 * TOUCH TARGET SIZE — measured on the real device profile, never read off CSS.
 *
 * Two floors, and they are different commitments:
 *
 *  - **24×24** is WCAG 2.2 SC 2.5.8 level AA, which `practices-checklist.md` A7
 *    ratifies. It is a conformance floor and a hard gate here.
 *  - **44×44** is the Apple HIG figure, and it is the one that matters for a
 *    product whose stated target is a phone held one-handed in a parking lot.
 *    It is asserted for every control a learner actually drives the app with.
 *
 * What is measured is the **hit area**, not the drawn box: several controls
 * present a deliberately small visual (a 28px switch, a 24px dismiss glyph) and
 * take a full 44px tap through a transparent `::before`. `support.ts` probes
 * with `elementsFromPoint`, so a control passes only if a tap at that distance
 * from its centre really would land on it.
 *
 * Inline links inside a sentence are exempt from SC 2.5.8 and from the 44px
 * figure both — growing `browse the 87 road signs` to 44px tall would break the
 * line it sits in. They are still held to 24px.
 */

const AA_FLOOR = 24;
const THUMB_FLOOR = 44;

/** A link whose box is a line of running text, covered by the SC 2.5.8 inline exception. */
const INLINE_EXEMPT = /(^|\s)(citelink|rulelink)(\s|$)/;

const isInlineLink = (cls: string, tag: string): boolean =>
  tag === 'A' && (INLINE_EXEMPT.test(cls) || cls.includes('underline'));

/**
 * Every route, measured whole.
 *
 * Onboarding is walked separately and first, because it is the one surface a
 * set-up device can never show — and it owns the segmented date field, which is
 * both the fiddliest control in the product and the first one a learner ever
 * touches.
 */
async function sweep(page: Page): Promise<Target[]> {
  const all: Target[] = [];

  await visit(page, '/');
  all.push(...(await measureTargets(page, '/ (onboarding)')));

  await setUpDevice(page);
  for (const route of servablePaths()) {
    await visit(page, route);
    all.push(...(await measureTargets(page, route)));
  }
  return all;
}

test.describe('touch targets', () => {
  test('every control clears the 24px conformance floor (SC 2.5.8, A7)', async ({ page }) => {
    const offenders: string[] = [];
    for (const target of await sweep(page)) {
      if (target.width < AA_FLOOR || target.height < AA_FLOOR) offenders.push(describe(target));
    }
    expect(offenders, `below 24×24:\n${offenders.join('\n')}`).toEqual([]);
  });

  test('every control a thumb drives clears 44×44', async ({ page }) => {
    const offenders: string[] = [];
    for (const target of await sweep(page)) {
      if (isInlineLink(target.cls, target.tag)) continue;
      if (target.width < THUMB_FLOOR || target.height < THUMB_FLOOR) {
        offenders.push(describe(target));
      }
    }
    expect(offenders, `below 44×44 on a touch device:\n${offenders.join('\n')}`).toEqual([]);
  });

  /**
   * The answer choices carry their own explicit floor in A7 ("≥44px tall"),
   * because they are the control the whole product exists to present. Asserted
   * by name so the sweep above cannot go green by the choices not rendering.
   */
  test('answer choices are at least 44px tall wherever they appear', async ({ page }) => {
    await setUpDevice(page);
    for (const route of ['/study/session', '/signs/drill']) {
      await visit(page, route);
      const choices = page.locator('.choice');
      await expect(choices.first()).toBeVisible();
      const heights = await choices.evaluateAll((els) =>
        els.map((el) => el.getBoundingClientRect().height),
      );
      expect(heights.length).toBeGreaterThanOrEqual(2);
      for (const height of heights) {
        expect(height, `${route}: an answer choice is ${String(height)}px tall`).toBeGreaterThanOrEqual(44);
      }
    }
  });

  /**
   * The search field draws a 48px box around a 24px input. Tapping the padding
   * — most of the field — did nothing at all, because the padding belongs to
   * the wrapper and the wrapper focuses nothing. The field has to *be* the
   * target, not merely look like one.
   */
  test('tapping anywhere in the sign-library search field focuses it', async ({ page }) => {
    await setUpDevice(page);
    await page.goto('/signs');
    const field = page.locator('.search');
    await expect(field).toBeVisible();

    const box = await field.boundingBox();
    expect(box).not.toBeNull();
    // Near the bottom edge of the drawn field, well outside a 24px input.
    await page.mouse.click(box!.x + box!.width * 0.6, box!.y + box!.height - 4);

    await expect(page.getByRole('searchbox')).toBeFocused();
  });
});
