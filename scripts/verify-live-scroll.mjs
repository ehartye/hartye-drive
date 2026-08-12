/**
 * Confirm the scroll fix on the deployed site, at a phone-in-landscape height
 * where every surface genuinely overflows.
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'https://ehartye.github.io/hartye-drive/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 480 } });

const y = () => page.evaluate(() => Math.round(window.scrollY));
let bad = 0;

async function surface(label, url, start, nextName) {
  await page.goto(url, { waitUntil: 'networkidle' });
  if (start) await start();
  await page.locator('.choice').first().waitFor();
  await page.locator('.choice').first().click();
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  await page.waitForTimeout(250);
  const before = await y();
  await page.getByRole('button', { name: nextName }).first().click();
  await page.locator('.choice').first().waitFor();
  await page.waitForTimeout(350);
  const after = await y();
  const ok = after === 0;
  if (!ok) bad++;
  console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${label.padEnd(16)} scrolled to ${String(before).padStart(4)} → after Next: ${after}`);
}

console.log(`\nlive scroll check — ${BASE} @ 390x480\n`);
await surface('study session', `${BASE}study/session?seed=7`, null, /Next question/);
await surface('exam', `${BASE}exam/run?seed=7`, async () => {
  await page.getByRole('button', { name: /Start the exam/ }).click();
}, /Next question|Finish the exam/);
await surface('sign drill', `${BASE}signs/drill?seed=7`, null, /Next sign|Finish drill/);

await browser.close();
console.log(bad === 0 ? '\nPASS — every surface starts the next item at the top.\n' : `\nFAIL — ${bad}\n`);
process.exit(bad ? 1 : 0);
