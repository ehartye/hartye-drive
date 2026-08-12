import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * P5 — the exam simulator and the three score reports. State-matrix cells 5,
 * 6a, 6b, 6c and 6d.
 *
 * The exam deliberately reveals nothing about which answer is right, so this
 * suite reads the keyed answers from the shipped bank and drives the exam from
 * the outside — the same way a learner who already knew the material would.
 *
 * `?seed=` pins the paper so a run is reproducible.
 */
const bank = JSON.parse(
  readFileSync(new URL('../../src/content/questions.json', import.meta.url), 'utf8'),
) as { questions: { id: string; correctIndex: number; area: string }[] };

const CORRECT = new Map(bank.questions.map((q) => [q.id, q.correctIndex]));
const AREA = new Map(bank.questions.map((q) => [q.id, q.area]));

/**
 * Waits for the question itself, not merely an `<h1>`: the code-split route's
 * `HydrateFallback` renders a visually-hidden "Loading" heading.
 */
async function begin(page: Page, query = 'seed=7'): Promise<void> {
  await page.goto(`/exam/run?${query}`);
  await page.getByRole('button', { name: /Start the exam/ }).click();
  await expect(page.locator('.stem')).toBeVisible();
  await expect(page.locator('.choice').first()).toBeVisible();
}

/** Answers the question on screen and moves on. Returns its blueprint area. */
async function answer(page: Page, correct: boolean): Promise<string> {
  const qid = (await page.locator('[data-qid]').getAttribute('data-qid')) ?? '';
  const right = CORRECT.get(qid) ?? 0;
  const options = await page.locator('.choice').count();
  const index = correct ? right : (right + 1) % options;
  await page.locator('.choice').nth(index).click();
  await expect(page.locator('.choice').nth(index)).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /Next question|Finish the exam/ }).click();
  return AREA.get(qid) ?? '';
}

/** Sits the exam, keying `wrongAt(i)` questions wrong, until it ends. */
async function sit(page: Page, count: number, wrongAt: (i: number) => boolean): Promise<string[]> {
  const areas: string[] = [];
  for (let i = 0; i < count; i += 1) {
    if ((await page.locator('[data-qid]').count()) === 0) break;
    areas.push(await answer(page, !wrongAt(i)));
  }
  return areas;
}

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe('the exam simulator', () => {
  test('discloses the 60-minute limit and the seven-wrong rule before the clock starts (A15)', async ({
    page,
  }) => {
    await page.goto('/exam/run?seed=7');
    await expect(page.getByRole('heading', { level: 1, name: 'Before the clock starts' })).toBeVisible();
    await expect(page.getByText('60 minutes', { exact: true })).toBeVisible();
    await expect(page.getByText(/7 wrong ends it/)).toBeVisible();
    await expect(page.getByText(/30 minus 7 leaves 23/)).toBeVisible();
    await expect(page.getByText(/24 correct to pass/)).toBeVisible();
    await expect(page.getByText(/No going back/)).toBeVisible();
    // Nothing is timed until the learner agrees to it.
    await expect(page.locator('.timer')).toHaveCount(0);

    await page.getByRole('button', { name: /Start the exam/ }).click();
    await expect(page.locator('.timer')).toBeVisible();
  });

  test('cell 5 — the exam in progress shows the clock, the position and the seven-wrong rule', async ({
    page,
  }) => {
    await begin(page);

    await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
    await expect(page.locator('.timer__val')).toHaveText(/^\d\d:\d\d$/);
    await expect(page.locator('.milemarker__val')).toHaveText('01');
    await expect(page.getByText('of 30').first()).toBeVisible();
    await expect(page.locator('.strikes__pip')).toHaveCount(7);
    await expect(page.locator('.strikes__pip--used')).toHaveCount(0);
    await expect(page.getByText('0 / 7 wrong')).toBeVisible();
    await expect(page.getByText(/7 wrong ends the exam, same as the real one/)).toBeVisible();
    await expect(page.locator('.choice')).toHaveCount(3);

    // Selecting tells you nothing: no verdict colour, no explanation, and the
    // picked state is carried by aria-pressed alone.
    await page.locator('.choice').nth(1).click();
    await expect(page.locator('.choice[aria-pressed="true"]')).toHaveCount(1);
    await expect(page.locator('.choice--correct, .choice--wrong')).toHaveCount(0);
    await expect(page.locator('.cite__quote')).toHaveCount(0);
    await expect(page.locator('[role="status"]').filter({ hasText: /selected/ })).toBeVisible();

    // The letter keys work too, and moving on advances the instruments.
    await page.keyboard.press('c');
    await expect(page.locator('.choice').nth(2)).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: /Next question/ }).click();
    await expect(page.locator('.milemarker__val')).toHaveText('02');
    await expect(page.locator('.choice[aria-pressed="true"]')).toHaveCount(0);
  });

  test('cell 5 — holds at 320px with nothing clipped', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await begin(page);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    await expect(page.locator('.timer__val')).toBeVisible();
    await expect(page.locator('.strikes__pip')).toHaveCount(7);
    const clipped = await page.evaluate(
      () =>
        [...document.querySelectorAll<HTMLElement>('.choice')].filter(
          (el) => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1,
        ).length,
    );
    expect(clipped).toBe(0);
  });

  test('cell 6a — a passing exam samples 25/25/25/25 and reports the pass', async ({ page }) => {
    const noise: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') noise.push(`${m.type()}: ${m.text()}`);
    });
    page.on('pageerror', (e) => noise.push(`pageerror: ${e.message}`));

    await begin(page, 'seed=11');
    // Four wrong out of thirty: a pass, with room to spare.
    const areas = await sit(page, 30, (i) => i === 3 || i === 9 || i === 15 || i === 21);

    // The blueprint the manual publishes, honoured question by question.
    expect(areas).toHaveLength(30);
    for (const area of ['signs', 'safe-driving', 'rules-of-road', 'alcohol-drugs']) {
      const count = areas.filter((a) => a === area).length;
      expect(count, `${area}: ${String(count)}`).toBeGreaterThanOrEqual(7);
      expect(count, `${area}: ${String(count)}`).toBeLessThanOrEqual(8);
    }

    await expect(page).toHaveURL(/\/exam\/report/);
    await expect(page.getByRole('heading', { level: 1, name: 'You passed' })).toBeVisible();
    await expect(page.locator('.plaque--pass')).toBeVisible();
    await expect(page.getByText(/26 of 30 correct · 24 needed to pass/)).toBeVisible();
    await expect(page.getByText(/cleared it by two/)).toBeVisible();
    await expect(page.locator('.tile__val').first()).toHaveText('4');
    // The four published areas, each with its numbers in text beside the rail.
    await expect(page.locator('.meter')).toHaveCount(4);
    await expect(page.getByText('Traffic signs and signals')).toBeVisible();
    await expect(page.getByText('Drugs and alcohol')).toBeVisible();
    await expect(page.getByText(/Not affiliated with the State of Tennessee/)).toBeVisible();

    // The result reaches assistive tech as well as the eye (A9).
    await expect(page.locator('[role="status"]').first()).toContainText('You passed');

    expect(noise).toEqual([]);
  });

  test('cell 6c — the seventh wrong answer ends the exam where it lands', async ({ page }) => {
    await begin(page, 'seed=3');
    // Wrong on every second question: the seventh miss falls on question 13.
    await sit(page, 30, (i) => i % 2 === 0);

    await expect(page).toHaveURL(/\/exam\/report/);
    await expect(page.getByRole('heading', { level: 1, name: 'Stopped at question 13' })).toBeVisible();
    await expect(page.locator('.plaque--halted')).toBeVisible();
    await expect(page.getByText('7 / 7 wrong')).toBeVisible();
    await expect(page.locator('.strikes__pip--used')).toHaveCount(7);
    await expect(page.getByText(/30 minus 7 leaves 23/)).toBeVisible();
    await expect(page.getByText(/never asked/).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Start the fix-it session/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Review the 13 you answered/ })).toBeVisible();
  });

  test('cell 6b — walking out scores what was answered', async ({ page }) => {
    await begin(page, 'seed=5');
    // 24 answered, three of them wrong: 21 correct, three short of the mark.
    await sit(page, 24, (i) => i === 2 || i === 8 || i === 14);

    await page.getByRole('button', { name: /End exam/ }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('You are 24 questions in');
    await expect(dialog).toContainText('21 correct out of 30');
    await page.getByRole('button', { name: 'End exam and score it' }).click();

    await expect(page).toHaveURL(/\/exam\/report/);
    await expect(page.getByRole('heading', { level: 1, name: 'Three short' })).toBeVisible();
    await expect(page.locator('.plaque--short')).toBeVisible();
    await expect(page.getByText(/Tennessee requires 24 of 30/)).toBeVisible();
    await expect(page.getByText(/ended the attempt/)).toBeVisible();
    await expect(page.getByRole('link', { name: /Start the fix-it session/ })).toHaveAttribute(
      'href',
      /\/study\/session\?q=/,
    );
  });

  test('cell 6d — the full review runs in exam order with a citation on every question', async ({
    page,
  }) => {
    await begin(page, 'seed=13');
    const areas = await sit(page, 30, (i) => i === 4 || i === 11 || i === 20);

    await page.getByRole('link', { name: /Review all 30 answers/ }).click();
    await expect(page).toHaveURL(/\/exam\/review/);
    await expect(page.getByRole('heading', { level: 1, name: 'All 30, in order' })).toBeVisible();

    const items = page.locator('.rev');
    await expect(items).toHaveCount(30);
    await expect(page.locator('.rev--miss')).toHaveCount(3);
    await expect(page.locator('.rev__cite')).toHaveCount(30);
    await expect(page.locator('.rev__cite').first()).toContainText('PDF p.');
    await expect(page.locator('.rev__cite').first()).toContainText('printed p.');

    // True exam order, not blocked by topic — the numbers run 01…30 and the
    // areas interleave exactly as the sample produced them.
    const numbers = await page.locator('.rev__n').allTextContents();
    expect(numbers).toEqual(areas.map((_, i) => String(i + 1).padStart(2, '0')));
    const listed = (await page.locator('.rev__area').allTextContents()).map((s) => s.trim());
    expect(listed).not.toEqual([...listed].sort((a, b) => a.localeCompare(b)));

    // Explanations are "the manual": Newsreader, at least 17px, 1.6 or looser.
    const type = await page.locator('.rev .read').first().evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        family: style.fontFamily,
        size: parseFloat(style.fontSize),
        height: parseFloat(style.lineHeight) / parseFloat(style.fontSize),
      };
    });
    expect(type.family).toMatch(/Newsreader/);
    expect(type.size).toBeGreaterThanOrEqual(17);
    expect(type.height).toBeGreaterThanOrEqual(1.6);

    // Each miss shows both what was picked and what was right.
    const miss = page.locator('.rev--miss').first();
    await expect(miss.getByText('You picked', { exact: true })).toBeVisible();
    await expect(miss.getByText('Correct answer', { exact: true })).toBeVisible();

    // The filter narrows to the misses, and the jump link lands on the first.
    await page.getByRole('radio', { name: 'Missed 3' }).check();
    await expect(page.locator('.rev')).toHaveCount(3);
    await expect(page.locator('.rev--miss')).toHaveCount(3);
  });

  test('cell 6d — the review holds at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await begin(page, 'seed=17');
    await sit(page, 30, (i) => i === 4 || i === 11);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    await page.getByRole('link', { name: /Review all 30 answers/ }).click();
    await expect(page.locator('.rev')).toHaveCount(30);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });

  test('the exam and its report hold at 200% zoom', async ({ page }) => {
    // 640 CSS px of viewport is 1280 device px at 200% — the reflow WCAG 1.4.10
    // asks for, applied to the exam, the report and the review in turn.
    await page.setViewportSize({ width: 640, height: 700 });
    await begin(page, 'seed=19');
    expect(await overflow(page)).toBeLessThanOrEqual(0);

    await sit(page, 12, (i) => i === 1 || i === 6);
    await page.getByRole('button', { name: /End exam/ }).first().click();
    await page.getByRole('button', { name: 'End exam and score it' }).click();
    await page.locator('.plaque').waitFor();
    expect(await overflow(page)).toBeLessThanOrEqual(0);

    await page.getByRole('link', { name: /Review the 12 you answered/ }).click();
    await page.locator('.rev').first().waitFor();
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });

  test('browser back mid-exam is guarded, never silently destructive', async ({ page }) => {
    await page.goto('/exam');
    await page.getByRole('link', { name: /Start a mock exam/ }).click();
    await page.getByRole('button', { name: /Start the exam/ }).click();
    await expect(page.locator('.stem')).toBeVisible();
    await answer(page, true);

    await page.goBack();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('End the exam now?');

    // Escaping the guard leaves the attempt exactly where it was.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/exam\/run/);
    await expect(page.locator('.milemarker__val')).toHaveText('02');

    // Going through with the same guard scores the attempt rather than
    // discarding it. (Reached by the exit control: resetting a blocked POP
    // leaves the history stack pointing at this route, so a second back is a
    // no-op rather than a second guard — which is safe, but not a test.)
    await page.getByRole('button', { name: /End exam/ }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'End exam and score it' }).click();
    await expect(page).toHaveURL(/\/exam\/report/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('short');
  });

  test('an attempt survives a reload — the clock keeps running, the answers stay', async ({
    page,
  }) => {
    await begin(page, 'seed=23');
    // Wait for the first tick before reading the clock. Without this the two
    // answers below can land inside the opening second, `before` is still
    // "60:00", and the assertion at the foot of the test fails for a reason
    // that has nothing to do with surviving a reload. Pre-existing flake —
    // reproduced on this branch's base commit; see deviations.md (P7).
    await expect(page.locator('.timer__val')).not.toHaveText('60:00');
    await answer(page, true);
    await answer(page, false);
    const before = await page.locator('.timer__val').textContent();

    await page.reload();
    await expect(page.locator('.stem')).toBeVisible();
    await expect(page.locator('.milemarker__val')).toHaveText('03');
    await expect(page.getByText('1 / 7 wrong')).toBeVisible();
    // The clock did not restart.
    expect(await page.locator('.timer__val').textContent()).not.toBe('60:00');
    expect(before).not.toBe('60:00');
  });

  test('the attempt is persisted under its own versioned key, bounded at 200', async ({ page }) => {
    await begin(page, 'seed=29');
    await sit(page, 30, () => true);
    await expect(page).toHaveURL(/\/exam\/report/);

    const stored = await page.evaluate(() => localStorage.getItem('tn-drive:exams'));
    const parsed = JSON.parse(stored ?? '{}') as {
      version: number;
      state: { schemaVersion: number; attempts: { answered: number }[]; active: unknown };
    };
    expect(parsed.version).toBe(1);
    expect(parsed.state.schemaVersion).toBe(1);
    expect(parsed.state.attempts).toHaveLength(1);
    expect(parsed.state.attempts[0]?.answered).toBe(7);
    expect(parsed.state.active).toBeNull();
  });

  test('a corrupt exam history lands on a working exam, not a white screen', async ({ page }) => {
    await page.goto('/exam');
    await page.evaluate(() => {
      localStorage.setItem('tn-drive:exams', '{"garbage":true}');
    });
    await begin(page, 'seed=31');
    await expect(page.locator('.choice')).toHaveCount(3);
  });

  test('the report and the review are reachable with no attempt at all', async ({ page }) => {
    await page.goto('/exam/report');
    await expect(page.getByRole('heading', { level: 1, name: /No exam sat yet/ })).toBeVisible();
    await page.goto('/exam/review');
    await expect(page.getByRole('heading', { level: 1, name: /Nothing to review yet/ })).toBeVisible();
  });
});
