/**
 * Prove the app works when mounted at a sub-path — including offline.
 *
 * Loads the app at `<base>`, waits for the service worker to control the page,
 * drives a real study question, then kills the network and hard-reloads. If the
 * worker's scope is wrong for the base, the reload lands on nothing and this
 * fails — which is exactly the silent failure a sub-path deploy causes.
 *
 * Usage: node scripts/check-subpath.mjs [url]
 */
import { chromium } from 'playwright';

const URL_ = process.argv[2] ?? 'http://localhost:4300/hartye-drive/';
const say = (ok, msg) => console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${msg}`);

let failures = 0;
const check = (ok, msg) => {
  if (!ok) failures++;
  say(ok, msg);
};

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

const failed = [];
page.on('requestfailed', (r) => failed.push(r.url()));
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

console.log(`\nchecking ${URL_}\n`);

await page.goto(URL_, { waitUntil: 'networkidle' });
check(
  !(await page.getByText('it opens at zero bytes of network').isVisible().catch(() => false)),
  'the app mounts (boot plate replaced)',
);
check(errors.length === 0, `no page errors${errors.length ? `: ${errors[0]}` : ''}`);
check(failed.length === 0, `no failed requests${failed.length ? `: ${failed[0]}` : ''}`);

// Deep link through the router at the sub-path.
await page.goto(`${URL_}signs`, { waitUntil: 'networkidle' });
check(await page.getByRole('heading', { level: 1 }).isVisible(), 'a deep link resolves (router basename)');

// Wait for the worker to take control.
const controlled = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return { registered: false, scope: null };
  await navigator.serviceWorker.ready;
  for (let i = 0; i < 40 && !navigator.serviceWorker.controller; i++) {
    await new Promise((r) => setTimeout(r, 250));
  }
  return { registered: true, scope: reg.scope, controlling: !!navigator.serviceWorker.controller };
});
check(controlled.registered, 'a service worker registered');
check(
  typeof controlled.scope === 'string' && controlled.scope.includes('/hartye-drive/'),
  `worker scope covers the sub-path (${controlled.scope ?? 'none'})`,
);
check(controlled.controlling === true, 'the worker is controlling the page');

// The real test: no network at all.
await context.setOffline(true);
failed.length = 0;
await page.goto(`${URL_}study`, { waitUntil: 'domcontentloaded' });
check(
  !(await page.getByText('it opens at zero bytes of network').isVisible().catch(() => false)),
  'OFFLINE: the app boots with the network disabled',
);
check(await page.getByRole('heading', { level: 1 }).isVisible(), 'OFFLINE: a route renders');
check(failed.length === 0, `OFFLINE: nothing failed to load${failed.length ? `: ${failed[0]}` : ''}`);

await browser.close();
console.log(failures === 0 ? '\nPASS — the sub-path deploy works, offline included.\n' : `\nFAIL — ${failures} check(s).\n`);
process.exit(failures ? 1 : 0);
