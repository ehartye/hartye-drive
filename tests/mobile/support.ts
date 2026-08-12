import { expect, type Page } from '@playwright/test';

/**
 * Shared ground for the mobile suite.
 *
 * Everything here drives the app the way the app is really driven — real
 * `localStorage` payloads and real navigation. Nothing fabricates a screen
 * through a query parameter, for the reason `tests/support/seed.ts` gives: a
 * screen a reviewer can only reach by lying to the app is not evidence that the
 * screen works.
 */

/** A device that has finished onboarding, so every route draws its real chrome. */
export async function setUpDevice(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem(
      'tn-drive:setup',
      JSON.stringify({
        state: { schemaVersion: 1, goal: 'class-d', testDate: null, completedAt: 1 },
        version: 1,
      }),
    );
  });
}

/**
 * Navigates, and waits for the route to have actually mounted.
 *
 * Every route below the shell is code-split, and a split route's
 * `HydrateFallback` publishes its own visually-hidden `<h1>Loading</h1>`. A
 * 1px clipped element still counts as visible, so waiting on "an h1 appeared"
 * resolves against the fallback and any measurement taken next reads the
 * skeleton instead of the page. `tests/e2e/foundation.spec.ts` documents the
 * same race; it cost a whole red suite there.
 */
export async function visit(page: Page, route: string): Promise<void> {
  await page.goto(route);
  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading).toBeVisible();
  // Not `not.toHaveText('Loading')` alone: mid-swap the heading can be present
  // and **empty**, which satisfies "is not Loading" and lets the measurement
  // run against a half-mounted page. Observed once under load. The route has
  // arrived only when the heading says something that is not the fallback.
  await expect(heading).not.toHaveText(/^\s*(Loading)?\s*$/);
}

/**
 * The insets a notched iPhone reports. Playwright cannot emulate a notch: no
 * engine build it ships resolves `env(safe-area-inset-*)` to anything but zero,
 * so a test that merely loads the page on an "iPhone 14" is testing the
 * un-notched case and will pass whatever the CSS says.
 *
 * The app therefore reads its insets through **one variable per edge**
 * (`--safe-b`, `--safe-t`), each defaulting to the real `env()`. Production
 * resolves the `env()`; this helper overrides the variable with the figure a
 * real device reports. The declaration under test — `calc(... + var(--safe-b))`
 * — is the same one either way, which is what makes the assertion mean
 * something.
 *
 * 34px is the portrait home-indicator inset on every notched iPhone from the X
 * to the 16 Pro Max; 21px is the landscape figure, where the indicator is
 * shorter but the display cutout takes the sides instead.
 */
export const IPHONE_SAFE_BOTTOM = 34;
export const IPHONE_SAFE_TOP = 47;

export async function emulateNotch(
  page: Page,
  bottom: number = IPHONE_SAFE_BOTTOM,
  top: number = IPHONE_SAFE_TOP,
): Promise<void> {
  await page.addStyleTag({
    content: `:root { --safe-b: ${String(bottom)}px; --safe-t: ${String(top)}px; }`,
  });
}

/** Landscape on a phone: short and wide, the case a desktop viewport never is. */
export const LANDSCAPE = { width: 844, height: 390 };

/** Every interactive thing a thumb can reach. */
export const INTERACTIVE =
  'a[href], button, input, select, textarea, summary, [role="button"], [tabindex]:not([tabindex="-1"])';

export interface Target {
  tag: string;
  label: string;
  cls: string;
  width: number;
  height: number;
  route: string;
  /** Stable per element within a route — its index in document order. */
  key: string;
}

/**
 * Measures every visible interactive control on the page, on the real device
 * profile. Deliberately measured rather than read off the stylesheet: a control
 * can carry `min-height: 44px` and still render at 30px because a flex parent
 * shrank it, and only the rendered box is what a thumb has to hit.
 *
 * The hit area, not the border box: a control may present a small visual and
 * still take a 44px tap through a transparent `::before`, which is how the
 * switch and the toast dismiss keep their drawn size. `elementsFromPoint` at
 * the corners of the notional 44×44 square is what actually answers "would this
 * tap land", so that is what is asked.
 */
export async function measureTargets(page: Page, route: string): Promise<Target[]> {
  // `elementsFromPoint` only answers for the current scroll position, so the
  // page is walked a screen at a time. Measuring only the first screenful is
  // how a sweep like this quietly stops covering the controls further down —
  // the onboarding date field and the confirm gate were both below the fold.
  const screens = await page.evaluate(() =>
    Math.min(40, Math.ceil(document.documentElement.scrollHeight / window.innerHeight)),
  );

  const seen = new Map<string, Target>();
  for (let screen = 0; screen < Math.max(1, screens); screen += 1) {
    await page.evaluate((index) => {
      window.scrollTo(0, index * window.innerHeight);
    }, screen);
    for (const target of await measureScreen(page, route)) {
      // Keyed by the element's own position in the document, keeping the
      // largest box measured for a control that straddles two screens. Keying
      // on tag+class+label instead would collapse the three date segments — all
      // unlabelled, all identically classed — into one, and the sweep would
      // then report the largest of them and quietly stop checking the other
      // two.
      const key = target.key;
      const previous = seen.get(key);
      if (
        previous === undefined ||
        target.width * target.height > previous.width * previous.height
      ) {
        seen.set(key, target);
      }
    }
  }
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
  return [...seen.values()];
}

async function measureScreen(page: Page, route: string): Promise<Target[]> {
  return page.evaluate(
    ({ selector, routeName }) => {
      const out: {
        tag: string;
        label: string;
        cls: string;
        width: number;
        height: number;
        route: string;
        key: string;
      }[] = [];

      const all = [...document.querySelectorAll(selector)];
      for (const [index, el] of all.entries()) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        const style = getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none') continue;
        if (style.opacity === '0') continue;
        // Fully off screen: it cannot be probed by point from here, and this
        // screen's pass is not the one that will measure it.
        if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
        // Clipped by an edge — the next screen's pass sees it whole.
        if (rect.top < 0 || rect.bottom > window.innerHeight) continue;

        // Grow the measured box to whatever actually responds to a tap. The
        // element wins a point if it, or a descendant of it, is on top there —
        // or if what is on top is a <label> that controls it, because tapping
        // a label really does operate its control. That is what makes a
        // visually-hidden radio inside a `.pick` row a legitimate 56px target
        // rather than a 0px one.
        const owns = (x: number, y: number): boolean =>
          document.elementsFromPoint(x, y).some((hit) => {
            if (hit === el || el.contains(hit)) return true;
            const label = hit.closest('label');
            return label instanceof HTMLLabelElement && label.control === el;
          });

        const cx = rect.x + rect.width / 2;
        const cy = rect.y + rect.height / 2;

        /**
         * How far past `edge` the element still answers to a tap, along one
         * axis, up to `limit`.
         *
         * Binary search, not a 1px walk. `elementsFromPoint` is the single most
         * expensive call in this sweep, and a walk cost up to 44 of them per
         * axis per control — across every control on every screen of a 20,000px
         * component gallery, that pushed the two sweeps past the 30s timeout
         * whenever the machine was busy. Six probes give the same 1px answer.
         */
        const reach = (
          limit: number,
          bound: number,
          at: (offset: number) => [number, number],
        ): number => {
          if (limit <= 0) return 0;
          const max = Math.min(limit, bound);
          if (max <= 0) return 0;
          // The offset actually needed, asked first and answered exactly. This
          // is the passing case and the overwhelming majority of controls, and
          // it costs one probe. A binary search alone converges from below and
          // would report a healthy 44px target as 43.8px.
          if (owns(...at(max))) return max;
          // It falls short. Five halvings are enough to say by how much, which
          // is only ever read in a failure message.
          let low = 0;
          let high = max;
          for (let step = 0; step < 5; step += 1) {
            const mid = (low + high) / 2;
            if (owns(...at(mid))) low = mid;
            else high = mid;
          }
          return low;
        };

        // Only ever asked of controls that are already short: a control at or
        // above 44 needs no probing at all, which is most of them.
        let height = rect.height;
        if (height < 44) {
          const want = (44 - rect.height) / 2;
          const up = reach(want, rect.top, (o) => [cx, rect.top - o]);
          const down = reach(want, window.innerHeight - rect.bottom, (o) => [cx, rect.bottom + o]);
          // A one-sided expansion still counts: a control against the top of the
          // viewport can only grow downward, and a tap there lands all the same.
          const extra =
            up + down >= want * 2
              ? want * 2
              : up + reach(want * 2 - up, window.innerHeight - rect.bottom, (o) => [
                  cx,
                  rect.bottom + o,
                ]);
          height = rect.height + Math.min(extra, want * 2);
        }

        let width = rect.width;
        if (width < 44) {
          const want = (44 - rect.width) / 2;
          const left = reach(want, rect.left, (o) => [rect.left - o, cy]);
          const right = reach(want, window.innerWidth - rect.right, (o) => [rect.right + o, cy]);
          const extra =
            left + right >= want * 2
              ? want * 2
              : left +
                reach(want * 2 - left, window.innerWidth - rect.right, (o) => [rect.right + o, cy]);
          width = rect.width + Math.min(extra, want * 2);
        }

        out.push({
          tag: el.tagName,
          label:
            (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 44) || '(none)',
          cls: typeof el.className === 'string' ? el.className : '',
          width: Math.round(width * 10) / 10,
          height: Math.round(height * 10) / 10,
          route: routeName,
          key: `${routeName}#${String(index)}`,
        });
      }
      return out;
    },
    { selector: INTERACTIVE, routeName: route },
  );
}

/**
 * The shipped stylesheets, as **text**.
 *
 * The CSSOM is the wrong instrument for asking what a stylesheet says. An
 * engine drops every declaration it does not itself implement, so
 * `rule.style.cssText` answers "what does this engine understand" rather than
 * "what did we ship" — and the two properties that matter most here are exactly
 * the ones with uneven support. Chromium drops `-webkit-backdrop-filter`
 * because it needs no prefix; the WebKit build Playwright ships drops
 * `overscroll-behavior` because it does not implement it. Read through the
 * CSSOM, a correct stylesheet looks broken on one engine and fine on the other,
 * in opposite directions. The bytes are the truth.
 */
export async function stylesheetText(page: Page): Promise<string> {
  const hrefs = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].map((l) => l.href),
  );
  const sheets: string[] = [];
  for (const href of hrefs) sheets.push(await (await page.request.get(href)).text());
  return sheets.join('\n');
}

/**
 * Every declaration block in `css` whose selector matches, as raw text. Crude
 * on purpose — it splits on braces rather than parsing — which is all that is
 * needed to ask whether one property sits beside another in the same rule.
 */
export function blocksFor(css: string, selectorPattern: RegExp): string[] {
  const out: string[] = [];
  for (const chunk of css.split('}')) {
    const brace = chunk.lastIndexOf('{');
    if (brace === -1) continue;
    const selector = chunk.slice(0, brace);
    if (selectorPattern.test(selector)) out.push(chunk.slice(brace + 1));
  }
  return out;
}

/** `route: label (w×h)` — what a failure message needs to be actionable. */
export const describe = (t: Target): string =>
  `${t.route}  ${t.tag}.${t.cls.split(' ')[0] ?? ''} "${t.label}" ${String(t.width)}×${String(t.height)}`;
