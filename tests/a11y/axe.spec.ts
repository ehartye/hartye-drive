import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { servablePaths } from '../../src/app/route-paths';

/**
 * X15 — zero violations at wcag2a, wcag2aa, wcag21aa, wcag22aa across every
 * route P1 stands up, plus the gallery, which is the whole component vocabulary
 * in every state on one page. P4–P8 extend this to their own state-matrix cells.
 */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/**
 * Derived from the router, never hand-maintained. A blind critic found the
 * reflow spec passing only because its literal route list omitted the one
 * route that failed; a list you have to remember to update is a list that
 * silently stops covering things. Plus the 404, which no route table yields.
 */
const ROUTES = [...servablePaths(), '/definitely-not-a-route'];

test('covers every route the router serves', () => {
  for (const path of servablePaths()) expect(ROUTES).toContain(path);
});

for (const route of ROUTES) {
  test(`axe: ${route}`, async ({ page }) => {
    await page.goto(route);
    await page.getByRole('heading', { level: 1 }).first().waitFor();
    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    expect(
      results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
    ).toEqual([]);
  });
}

/* --- P4: state-matrix cells 3 and 4, driven into place before scanning. --- */

const LONGEST = 'int-016';

const STUDY_CELLS: { name: string; query: string; drive?: (page: Page) => Promise<void> }[] = [
  { name: 'cell 3 — question asked', query: 'seed=7' },
  {
    name: 'cell 4a/4b — answer revealed',
    query: 'q=stp-002',
    drive: async (page) => {
      await page.locator('.choice').first().click();
      await page.locator('.panel--guide').waitFor();
    },
  },
  {
    name: 'cell 3 — long content, manual passage open, correction disclosed',
    query: `q=${LONGEST}`,
    drive: async (page) => {
      await page.locator('details.lookup summary').click();
      await page.locator('.cite__quote').waitFor();
    },
  },
  {
    name: 'cell 4 — long content, answer revealed',
    query: `q=${LONGEST}`,
    drive: async (page) => {
      await page.locator('.choice').first().click();
      await page.locator('.panel--guide').waitFor();
    },
  },
];

for (const cell of STUDY_CELLS) {
  test(`axe: study ${cell.name}`, async ({ page }) => {
    await page.goto(`/study/session?${cell.query}`);
    // Not just an <h1>: the split route's fallback renders a hidden one.
    await page.locator('.choice').first().waitFor();
    await cell.drive?.(page);
    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    expect(
      results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
    ).toEqual([]);
  });
}

test('axe: study — the exit guard', async ({ page }) => {
  await page.goto('/study/session?seed=7');
  await page.locator('.choice').first().waitFor();
  await page.getByRole('button', { name: /End session/ }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});

test('axe: study — session complete', async ({ page }) => {
  await page.goto('/study/session?q=stp-002');
  await page.locator('.choice').first().waitFor();
  await page.locator('.choice').first().click();
  await page.getByRole('button', { name: /Finish session/ }).click();
  await page.getByRole('heading', { level: 1, name: /right/ }).waitFor();
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});

/* --- P5: state-matrix cells 5, 6a, 6b, 6c and 6d, driven into place. ------- */

const bank = JSON.parse(
  readFileSync(new URL('../../src/content/questions.json', import.meta.url), 'utf8'),
) as { questions: { id: string; correctIndex: number }[] };
const CORRECT = new Map(bank.questions.map((q) => [q.id, q.correctIndex]));

async function startExam(page: Page, seed: number): Promise<void> {
  await page.goto(`/exam/run?seed=${String(seed)}`);
  await page.getByRole('button', { name: /Start the exam/ }).click();
  await page.locator('.choice').first().waitFor();
}

/** Sits the exam from the outside, keying `wrongAt(i)` questions wrong. */
async function sitExam(page: Page, count: number, wrongAt: (i: number) => boolean): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    if ((await page.locator('[data-qid]').count()) === 0) break;
    const qid = (await page.locator('[data-qid]').getAttribute('data-qid')) ?? '';
    const right = CORRECT.get(qid) ?? 0;
    const options = await page.locator('.choice').count();
    const index = wrongAt(i) ? (right + 1) % options : right;
    await page.locator('.choice').nth(index).click();
    await page.getByRole('button', { name: /Next question|Finish the exam/ }).click();
  }
}

test('axe: exam — the disclosure before the clock starts (cell 5)', async ({ page }) => {
  await page.goto('/exam/run?seed=7');
  await page.getByRole('heading', { level: 1, name: 'Before the clock starts' }).waitFor();
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});

test('axe: exam — in progress, with an answer picked (cell 5)', async ({ page }) => {
  await startExam(page, 7);
  await page.locator('.choice').nth(1).click();
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
  ).toEqual([]);
});

test('axe: exam — the exit guard', async ({ page }) => {
  await startExam(page, 7);
  await page.getByRole('button', { name: /End exam/ }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});

test('axe: exam — the passing report and the full review (cells 6a, 6d)', async ({ page }) => {
  await startExam(page, 11);
  await sitExam(page, 30, (i) => i === 3 || i === 9);
  await page.getByRole('heading', { level: 1, name: 'You passed' }).waitFor();
  const report = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(
    report.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
  ).toEqual([]);

  await page.getByRole('link', { name: /Review all 30 answers/ }).click();
  await page.locator('.rev').first().waitFor();
  const review = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(
    review.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
  ).toEqual([]);
});

test('axe: exam — the report of an attempt ended early (cell 6b)', async ({ page }) => {
  await startExam(page, 5);
  await sitExam(page, 12, (i) => i === 2);
  await page.getByRole('button', { name: /End exam/ }).first().click();
  await page.getByRole('button', { name: 'End exam and score it' }).click();
  await page.locator('.plaque--short').waitFor();
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
  ).toEqual([]);
});

test('axe: exam — the report of an attempt halted at seven wrong (cell 6c)', async ({ page }) => {
  await startExam(page, 3);
  await sitExam(page, 30, (i) => i % 2 === 0);
  await page.locator('.plaque--halted').waitFor();
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
  ).toEqual([]);
});

test('axe: the open dialog traps and is labelled', async ({ page }) => {
  await page.goto('/gallery');
  await page.getByRole('button', { name: 'Open the confirmation' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});
