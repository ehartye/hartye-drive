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
