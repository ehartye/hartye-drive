import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { colorLabel, shapeLabel } from '~/signs/registry';
import type { SignShape } from '~/signs/registry';

/**
 * P6 — state-matrix cells 7 and 8, driven in the real app.
 *
 * The load-bearing claim of this piece is the one a unit test cannot make:
 * **the drill screen must not name the sign**. Its accessible name has to be
 * shape and colour and nothing else, or a screen-reader learner is handed the
 * answer before they have thought about it. `npm run audit:signs` proves the
 * component does that; this proves the screen actually uses it.
 */
interface RegistrySign {
  id: string;
  name: string;
  meaning: string;
  category: string;
  shape: SignShape;
  faceColor: string;
}

const registry = JSON.parse(
  readFileSync(new URL('../../src/content/signs.json', import.meta.url), 'utf8'),
) as { signs: RegistrySign[] };

const TOTAL = registry.signs.length;
const BY_ID = new Map(registry.signs.map((sign) => [sign.id, sign]));

const words = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

/**
 * The only vocabulary a drill name is allowed: the words its own shape label
 * and colour label are built from. Derived, not hand-listed, so a new shape or
 * a new colour cannot quietly widen what the screen is permitted to say.
 */
const allowedVocabulary = (sign: RegistrySign) =>
  new Set([...words(shapeLabel(sign.shape)), ...words(colorLabel(sign.faceColor))]);

const drillNameFor = (sign: RegistrySign) =>
  `${shapeLabel(sign.shape)}, ${colorLabel(sign.faceColor)}`;

async function openDrill(page: Page, query = 'seed=7'): Promise<void> {
  await page.goto(`/signs/drill?${query}`);
  // Not just an <h1>: the split route's HydrateFallback renders a hidden one.
  await page.locator('.choice').first().waitFor();
}

/**
 * The **text-only** resize path of WCAG 2.2 SC 1.4.4 / 1.4.10 (practices A12).
 *
 * A browser's text-size setting at 200% raises the *root* font size to 32px and
 * leaves the viewport alone. Page zoom does not exercise the same code: zoom
 * scales the viewport too, so a layout that is wrong in `rem` still fits. This
 * injects the setting the way the browser applies it — `html { font-size }` —
 * which is what caught `/signs` overflowing by 174px at 320px.
 */
async function useDoubleTextSize(page: Page): Promise<void> {
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = 'html{font-size:32px !important}';
      document.head.appendChild(style);
    });
  });
}

interface Overflow {
  scroll: number;
  client: number;
  offenders: string[];
}

/** Both readings a critic takes: the document's own scroll, and every box in it. */
async function measureOverflow(page: Page): Promise<Overflow> {
  return page.evaluate(() => {
    const client = document.documentElement.clientWidth;
    const offenders: string[] = [];
    for (const node of document.querySelectorAll('body *')) {
      const box = node.getBoundingClientRect();
      if (box.width === 0 && box.height === 0) continue;
      // Anything inside an <svg> is clipped by that svg's own viewport, so its
      // untransformed rect is not something a learner can ever scroll to. The
      // outermost <svg> itself has a null ownerSVGElement and is still checked.
      if (node instanceof SVGElement && node.ownerSVGElement !== null) continue;
      if (box.right > client + 1 || box.left < -1) {
        const cls = node.getAttribute('class');
        offenders.push(
          `${node.tagName.toLowerCase()}${cls ? `.${cls.split(/\s+/).join('.')}` : ''} ` +
            `[${String(Math.round(box.left))}…${String(Math.round(box.right))}]`,
        );
      }
    }
    return { scroll: document.documentElement.scrollWidth, client, offenders: offenders.slice(0, 12) };
  });
}

test.describe('sign drill — cell 7', () => {
  test('shows one sign at hero scale with no text label anywhere near it', async ({ page }) => {
    await openDrill(page);
    const stage = page.locator('.stage');
    await expect(stage).toBeVisible();
    await expect(stage.locator('svg.sign--hero')).toHaveCount(1);

    const id = (await page.locator('[data-sign-drill]').getAttribute('data-sign-drill')) ?? '';
    const sign = BY_ID.get(id);
    expect(sign, `the drill rendered an id the registry does not carry: ${id}`).toBeDefined();

    // The sign's own name must not be printed anywhere on the unanswered screen.
    const body = (await page.locator('main').innerText()).toLowerCase();
    expect(body).not.toContain((sign?.name ?? '@@').toLowerCase());
  });

  test('names the sign by shape and colour only — never by its meaning', async ({ page }) => {
    for (const seed of [3, 7, 11, 23]) {
      await openDrill(page, `seed=${String(seed)}`);
      const id = (await page.locator('[data-sign-drill]').getAttribute('data-sign-drill')) ?? '';
      const sign = BY_ID.get(id);
      expect(sign).toBeDefined();

      const name = (await page.locator('.stage svg.sign--hero').getAttribute('aria-label')) ?? '';
      expect(name.trim(), 'the drill sign is nameless').not.toBe('');

      // Not merely non-empty: exactly the shape and the colour, nothing else.
      if (!sign) throw new Error(`unknown sign id ${id}`);
      expect(name, `seed ${String(seed)}: the stage is not using drill mode`).toBe(
        drillNameFor(sign),
      );

      const allowed = allowedVocabulary(sign);
      const leaks = words(name).filter((word) => !allowed.has(word));
      expect(leaks, `seed ${String(seed)}: drill name "${name}" says more than shape and colour`)
        .toEqual([]);
    }
  });

  test('offers three choices, and reveals the rule and its citation either way', async ({
    page,
  }) => {
    await openDrill(page);
    await expect(page.locator('.choice')).toHaveCount(3);
    await page.locator('.choice').first().click();
    await expect(page.locator('.verdict').first()).toBeVisible();
    await expect(page.locator('.cite__quote')).toBeVisible();
    await expect(page.locator('.cite__src')).toContainText('Driver License Manual');
    await expect(page.getByRole('button', { name: /Next sign/ })).toBeVisible();
  });

  test('is answerable with the keyboard alone', async ({ page }) => {
    await openDrill(page);
    await page.keyboard.press('b');
    await expect(page.locator('.choice[aria-pressed="true"]')).toHaveCount(1);
    await expect(page.locator('.cite__quote')).toBeVisible();
  });

  test('announces the verdict in a live region (practices A9)', async ({ page }) => {
    await openDrill(page);
    const live = page.locator('[role="status"][aria-live="polite"]').first();
    await expect(live).toHaveText('');
    await page.locator('.choice').first().click();
    await expect(live).toHaveText(/Correct|Incorrect/);
  });

  test('skipping marks the sign to come back rather than scoring it', async ({ page }) => {
    await openDrill(page);
    await page.getByRole('button', { name: /Skip/ }).click();
    await expect(page.getByText(/Skipped — queued to come back/)).toBeVisible();
    await expect(page.locator('.cite__quote')).toBeVisible();
  });

  test('carries the meaning ⇄ shape-and-colour toggle, and it changes the question', async ({
    page,
  }) => {
    await openDrill(page);
    const toggle = page.getByRole('group', { name: 'What the drill asks you for' });
    await expect(toggle.getByRole('button', { name: 'Meaning' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('What does this sign mean?');

    await toggle.getByRole('button', { name: 'Shape & color' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'What is this shape and color telling you?',
    );
    await expect(toggle.getByRole('button', { name: 'Shape & color' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.locator('.choice')).toHaveCount(3);
  });

  test('holds the answered screen at 320px, sign and citation whole', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await openDrill(page);
    await page.locator('.choice').first().click();
    await page.locator('.cite__quote').waitFor();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'the answered drill scrolls horizontally at 320px').toBeLessThanOrEqual(0);

    const hero = await page.locator('.stage svg.sign--hero').boundingBox();
    expect(hero).not.toBeNull();
    expect(hero!.x).toBeGreaterThanOrEqual(0);
    expect(hero!.x + hero!.width).toBeLessThanOrEqual(320);
  });

  test('the verdict survives without colour (practices A3)', async ({ page }) => {
    await openDrill(page);
    await page.locator('.choice').first().click();
    // The chosen row carries an icon AND a word, not a hue.
    const verdict = page.locator('.verdict').first();
    await expect(verdict).toContainText(/correct|incorrect/i);
    await expect(verdict.locator('svg')).toHaveCount(1);
  });

  test('guards the exit rather than dropping the drill silently', async ({ page }) => {
    await openDrill(page);
    await page.getByRole('button', { name: /End drill/ }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Keep drilling' }).click();
    await expect(page.locator('.choice').first()).toBeVisible();
  });

  test('finishes with a score and a way back', async ({ page }) => {
    await openDrill(page, 'seed=7&n=2');
    for (let i = 0; i < 2; i += 1) {
      await page.locator('.choice').first().click();
      await page.getByRole('button', { name: /Next sign|Finish drill/ }).click();
    }
    await expect(page.getByRole('heading', { level: 1, name: /of 2 right/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Back to the sign library/ })).toBeVisible();
  });
});

test.describe('sign library — cell 8', () => {
  test('renders every one of the registry’s signs when fully expanded', async ({ page }) => {
    await page.goto('/signs?expand=all');
    await page.locator('.signcard').first().waitFor();
    await expect(page.locator('.signcard')).toHaveCount(TOTAL);
    // Every category is present and none was folded into another.
    await expect(page.locator('section.cat')).toHaveCount(7);
    await expect(page.locator('[data-missing-sign], [data-pending-sign]')).toHaveCount(0);
  });

  test('states each category’s shape-and-colour rule as a lesson', async ({ page }) => {
    await page.goto('/signs');
    await page.locator('.signcard').first().waitFor();
    await expect(page.locator('section.cat--warning .cat__rule')).toContainText('Yellow diamond');
    await expect(page.locator('section.cat--work-zone .cat__rule')).toContainText('Orange');
    await expect(page.locator('section.cat--regulatory .cat__rule')).toContainText('the law');
    await expect(page.locator('section.cat--school .cat__rule')).toContainText('Five sides');
  });

  test('search reads shapes and colours, not only names', async ({ page }) => {
    await page.goto('/signs');
    await page.locator('.signcard').first().waitFor();
    await page.getByLabel('Search signs by name, shape, or color').fill('octagon');
    await expect(page.locator('.signcard')).toHaveCount(1);
    await expect(page.locator('.signcard__name')).toHaveText('STOP');
  });

  test('the category chips filter, and the pressed one carries a tick', async ({ page }) => {
    await page.goto('/signs');
    await page.locator('.signcard').first().waitFor();
    const chips = page.getByRole('group', { name: 'Filter by sign category' });
    await chips.getByRole('button', { name: 'School' }).click();
    await expect(page.locator('section.cat')).toHaveCount(1);
    const pressed = page.locator('.chip[aria-pressed="true"]');
    await expect(pressed).toHaveCount(1);
    // Never colour alone (§5): the pressed pill carries a check glyph.
    await expect(pressed.locator('svg.chip__tick')).toHaveCount(1);
  });

  test('a filter that matches nothing offers real recovery, not a shrug', async ({ page }) => {
    await page.goto('/signs?q=roundabout&cat=warning');
    await page.locator('.catlink').first().waitFor();
    await expect(page.locator('.signcard')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 2 })).toContainText('roundabout');
    // The near miss names the rule that actually governs a roundabout.
    await expect(page.getByRole('link', { name: /Open the YIELD sign/ })).toBeVisible();
    await expect(page.locator('.catlink')).toHaveCount(7);

    await page.getByRole('button', { name: /Keep the search, drop the Warning filter/ }).click();
    await expect(page.getByRole('heading', { level: 2 })).not.toContainText('in Warning');

    await page.getByRole('button', { name: /Clear the search and show all/ }).click();
    await expect(page.locator('.signcard').first()).toBeVisible();
  });

  test('a sign card opens its meaning and the manual page behind it', async ({ page }) => {
    await page.goto('/signs?expand=all');
    await page.locator('.signcard').first().waitFor();
    await page.locator('[data-sign="w8-5-slippery-when-wet"]').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('SLIPPERY WHEN WET');
    await expect(dialog).toContainText('Diamond, yellow');
    await expect(dialog.locator('.cite__src')).toContainText('printed p.');
  });

  test('the whole registry on one page holds at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/signs?expand=all');
    await page.locator('.signcard').first().waitFor();
    await expect(page.locator('.signcard')).toHaveCount(TOTAL);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'the full library scrolls horizontally at 320px').toBeLessThanOrEqual(0);

    // Nothing is clipped out of its own card either.
    const clipped = await page.locator('.signcard').evaluateAll((nodes) =>
      nodes.filter((node) => node.scrollWidth > node.clientWidth + 1).length,
    );
    expect(clipped, 'sign cards clip their own content at 320px').toBe(0);
  });

  test('the whole registry on one page holds at 200% zoom', async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 800 }); // 1280 CSS px at 200%
    await page.goto('/signs?expand=all');
    await page.locator('.signcard').first().waitFor();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('per-sign mastery is written in words, then persisted', async ({ page }) => {
    await page.goto('/signs?expand=all');
    await page.locator('.signcard').first().waitFor();
    await expect(page.locator('.mastery__lab').first()).toHaveText('New');

    await openDrill(page, 'seed=7&n=1');
    const id = (await page.locator('[data-sign-drill]').getAttribute('data-sign-drill')) ?? '';
    await page.locator('.choice').first().click();
    await page.getByRole('button', { name: /Finish drill/ }).click();

    await page.goto('/signs?expand=all');
    await page.locator('.signcard').first().waitFor();
    const card = page.locator(`[data-sign="${id}"]`);
    await expect(card.locator('.mastery__lab')).toHaveText(/Review|Solid/);

    // Survives a reload: the record is on the device, not in memory.
    await page.reload();
    await page.locator('.signcard').first().waitFor();
    await expect(page.locator(`[data-sign="${id}"] .mastery__lab`)).toHaveText(/Review|Solid/);
  });
});

test.describe('text resized to 200% — practices A12, WCAG 2.2 SC 1.4.4 / 1.4.10', () => {
  /* Every sign screen, at the two widths the bar names. Page zoom is already
     covered above and passes; this is the path it cannot see. */
  const SCREENS = [
    { name: 'the library', path: '/signs', ready: '.signcard' },
    { name: 'the whole library at once', path: '/signs?expand=all', ready: '.signcard' },
    { name: 'the empty filter', path: '/signs?q=roundabout&cat=warning', ready: '.catlink' },
    { name: 'the drill', path: '/signs/drill?seed=7', ready: '.choice' },
  ];

  for (const screen of SCREENS) {
    for (const width of [320, 390]) {
      test(`${screen.name} does not scroll sideways at ${String(width)}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await useDoubleTextSize(page);
        await page.goto(screen.path);
        await page.locator(screen.ready).first().waitFor();
        await expect
          .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).fontSize))
          .toBe('32px');

        const { scroll, client, offenders } = await measureOverflow(page);
        expect(
          scroll - client,
          `${screen.path} overflows at ${String(width)}px with 32px root text: ${offenders.join(' | ')}`,
        ).toBeLessThanOrEqual(0);
        expect(
          offenders,
          `boxes past the viewport on ${screen.path} at ${String(width)}px`,
        ).toEqual([]);
      });
    }
  }

  test('the search field shrinks with the viewport instead of setting its width', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await useDoubleTextSize(page);
    await page.goto('/signs');
    await page.locator('.signcard').first().waitFor();
    for (const selector of ['.field', '.search', '.search input']) {
      const box = await page.locator(selector).first().boundingBox();
      expect(box, `${selector} has no box`).not.toBeNull();
      expect(box!.x + box!.width, `${selector} runs past the 390px viewport`).toBeLessThanOrEqual(
        390,
      );
    }
  });
});

test.describe('the meta separator', () => {
  /* The shipped Overpass subset cut U+00B7 with a zero advance width, so
     "Sign 1 of 30 · 0 right" painted the dot on top of the space after it and
     read as "…30 ·0 right". Nothing in the DOM was wrong — only the metrics. */
  test('the middot occupies width in the UI face, so the space after it survives', async ({
    page,
  }) => {
    await page.goto('/signs');
    await page.locator('.signcard').first().waitFor();
    const advance = await page.evaluate(async () => {
      await document.fonts.ready;
      const context = document.createElement('canvas').getContext('2d');
      if (!context) return -1;
      context.font = `16px ${getComputedStyle(document.body).fontFamily}`;
      return context.measureText('·').width;
    });
    expect(advance, 'U+00B7 has no advance width in the UI font').toBeGreaterThan(2);
  });

  test('a meta line is wider with its separator than without it', async ({ page }) => {
    await openDrill(page);
    // The symptom, not the cause: a zero-advance dot makes "A · B" measure
    // exactly as wide as "A  B", which is why the dot looked glued to the B.
    const widths = await page.evaluate(async () => {
      await document.fonts.ready;
      const context = document.createElement('canvas').getContext('2d');
      if (!context) return { withDot: 0, without: 0 };
      const status = document.querySelector('.focus__status .dim') ?? document.body;
      context.font = `16px ${getComputedStyle(status).fontFamily}`;
      return {
        withDot: context.measureText('Sign 1 of 30 · 0 right so far').width,
        without: context.measureText('Sign 1 of 30  0 right so far').width,
      };
    });
    expect(widths.withDot - widths.without, 'the middot takes up no room at all').toBeGreaterThan(2);
  });
});
