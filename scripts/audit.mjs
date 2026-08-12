#!/usr/bin/env node
/**
 * X10–X14 — Lighthouse against the production build.
 *
 *   npm run audit
 *
 * Builds, serves `dist/` on port 4173, runs Lighthouse headless under its
 * default mobile emulation (Slow 4G, 4× CPU), writes `lighthouse-report.json`
 * and `lighthouse-report.html`, then checks the executable floor:
 *
 *   Performance    >= 90      Accessibility  == 100
 *   Best Practices >= 95      SEO            >= 90
 *   Installable PWA           passes (valid manifest + service worker)
 *
 * **X14 is not a Lighthouse score any more.** Lighthouse removed the PWA
 * category in v12 and dropped the last of the `installable-manifest` /
 * `service-worker` audits in v13, which is the version this repo runs. So
 * installability is asserted directly against Chrome's own criteria over the
 * DevTools protocol — the manifest Chrome actually parsed, the errors Chrome
 * actually found, the icons it requires, and a service worker that reaches
 * `activated` and serves a navigation from its cache. That is a stronger check
 * than the retired audit, not a weaker one: it exercises the thing rather than
 * reading a score about it. See deviations.md, 2026-08-12 (P9) §3.
 *
 * The browser is Playwright's Chromium, already a devDependency, so nothing
 * here depends on which browser happens to be installed on the machine.
 */
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';
import { chromium } from '@playwright/test';

/* The `page.evaluate` callback in `checkInstallability` is serialized and run
   inside Chromium, not in Node — hence the browser globals. */
/* global caches */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4173;
const ORIGIN = `http://localhost:${String(PORT)}`;

const THRESHOLDS = [
  { id: 'performance', label: 'Performance', floor: 90, exact: false },
  { id: 'accessibility', label: 'Accessibility', floor: 100, exact: true },
  { id: 'best-practices', label: 'Best Practices', floor: 95, exact: false },
  { id: 'seo', label: 'SEO', floor: 90, exact: false },
];

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: ROOT, stdio: 'inherit', shell: true });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited ${String(code)}`));
    });
  });
}

async function waitForServer(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error(`${url} did not come up within ${String(timeoutMs)} ms`);
}

/* ------------------------------------------------------- X14 installability */

/** Chrome's own install criteria, asserted against a real browser. */
async function checkInstallability(failures) {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Page.enable');
    await page.goto(`${ORIGIN}/`);

    const { errors = [], data } = await cdp.send('Page.getAppManifest');
    const blocking = errors.filter((error) => error.critical);
    if (blocking.length) {
      failures.push(`manifest errors: ${blocking.map((error) => error.message).join('; ')}`);
    }
    if (!data) {
      failures.push('no web app manifest was served');
      return;
    }

    const manifest = JSON.parse(data);
    const need = (condition, message) => {
      if (!condition) failures.push(message);
      return condition;
    };

    need(typeof manifest.name === 'string' && manifest.name.length > 0, 'manifest has no name');
    need(
      typeof manifest.short_name === 'string' && manifest.short_name.length > 0,
      'manifest has no short_name',
    );
    need(
      typeof manifest.description === 'string' && manifest.description.length > 0,
      'manifest has no description',
    );
    need(manifest.display === 'standalone', `manifest display is ${String(manifest.display)}`);
    need(typeof manifest.start_url === 'string', 'manifest has no start_url');
    need(/^#[0-9a-f]{6}$/i.test(manifest.theme_color ?? ''), 'manifest has no theme_color');
    need(/^#[0-9a-f]{6}$/i.test(manifest.background_color ?? ''), 'manifest has no background_color');

    const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
    const at = (size, purpose) =>
      icons.some(
        (icon) =>
          String(icon.sizes ?? '').split(' ').includes(`${String(size)}x${String(size)}`) &&
          String(icon.purpose ?? 'any').split(' ').includes(purpose),
      );
    need(at(192, 'any'), 'no 192px icon with purpose any');
    need(at(512, 'any'), 'no 512px icon with purpose any');
    need(at(192, 'maskable') || at(512, 'maskable'), 'no maskable icon');

    // Every icon must actually be there, and be a real image.
    for (const icon of icons) {
      const response = await page.request.get(new URL(icon.src, ORIGIN).href);
      if (!response.ok()) failures.push(`icon ${String(icon.src)} returned ${String(response.status())}`);
      else if (!(response.headers()['content-type'] ?? '').startsWith('image/')) {
        failures.push(`icon ${String(icon.src)} is not an image`);
      }
    }

    // A service worker that reaches `activated` and then serves a navigation
    // from its own cache with the network switched off — the second half of
    // Chrome's criteria, exercised rather than assumed.
    // Activation alone is observably reachable a beat before Cache Storage
    // lists the precache, so both are polled.
    const ready = async () => {
      const state = await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration?.active?.state !== 'activated') return 0;
        let entries = 0;
        for (const name of await caches.keys()) {
          entries += (await caches.open(name).then((cache) => cache.keys())).length;
        }
        return entries;
      });
      return state >= 30;
    };
    const deadline = Date.now() + 60_000;
    let installed = false;
    while (Date.now() < deadline && !installed) {
      installed = await ready();
      if (!installed) await sleep(250);
    }
    if (!installed) {
      failures.push('no service worker reached the activated state with a filled precache');
      return;
    }

    await context.setOffline(true);
    const offlineOk = await page
      .reload({ waitUntil: 'load' })
      .then(() => page.locator('h1').first().isVisible())
      .catch(() => false);
    if (!offlineOk) failures.push('the service worker did not serve a navigation offline');
  } finally {
    await browser.close();
  }
}

/* --------------------------------------------------------------------- run */

console.log('\n  building…\n');
await run(npm, ['run', 'build']);

console.log(`\n  serving dist/ on ${ORIGIN}…\n`);
const server = spawn(npx, ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  cwd: ROOT,
  stdio: 'ignore',
  shell: true,
});

let chrome;
let failed = false;
try {
  await waitForServer(ORIGIN);

  chrome = await launch({
    chromePath: chromium.executablePath(),
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
  });

  console.log('  running Lighthouse (mobile emulation, Slow 4G, 4x CPU)…\n');
  const result = await lighthouse(`${ORIGIN}/`, {
    port: chrome.port,
    output: ['json', 'html'],
    logLevel: 'error',
  });
  if (!result) throw new Error('Lighthouse returned nothing');

  const [json, html] = result.report;
  writeFileSync(path.join(ROOT, 'lighthouse-report.json'), json);
  writeFileSync(path.join(ROOT, 'lighthouse-report.html'), html);

  const failures = [];
  const { categories, audits, lighthouseVersion } = result.lhr;

  console.log(`  Lighthouse ${lighthouseVersion} — category scores (simulated throttling)\n`);
  for (const threshold of THRESHOLDS) {
    const raw = categories[threshold.id]?.score;
    const score = raw === null || raw === undefined ? null : Math.round(raw * 100);
    const target = threshold.exact
      ? `= ${String(threshold.floor)}`
      : `>= ${String(threshold.floor)}`;
    const ok =
      score !== null && (threshold.exact ? score === threshold.floor : score >= threshold.floor);
    console.log(
      `    ${threshold.label.padEnd(16)} ${String(score ?? 'n/a').padStart(3)}   (${target})  ${ok ? 'PASS' : 'FAIL'}`,
    );
    if (!ok) failures.push(`${threshold.label} ${String(score ?? 'n/a')} misses ${target}`);
  }

  console.log('\n  key metrics\n');
  for (const id of [
    'first-contentful-paint',
    'largest-contentful-paint',
    'total-blocking-time',
    'cumulative-layout-shift',
    'speed-index',
  ]) {
    const audit = audits[id];
    if (audit) console.log(`    ${id.padEnd(26)} ${String(audit.displayValue ?? '')}`);
  }

  /*
   * A second pass with the same emulation but **real** throttling, reported
   * beside the first and never gated on.
   *
   * Lighthouse's default is `simulate`: it loads the page at full speed and
   * then models a slow one. For a client-rendered app with a static boot plate
   * that model has a blind spot — locally the plate is on screen for a frame or
   * two before React replaces it, so the only largest-contentful-paint
   * candidate in the trace is the post-boot content, and the simulation dates
   * the whole of LCP to the end of the JS chain. Chrome's own LCP observer
   * under real Slow 4G disagrees, and so does this pass. Both numbers are
   * printed because the difference is the honest thing to publish.
   */
  console.log('\n  running Lighthouse again under real (DevTools) throttling…\n');
  const real = await lighthouse(`${ORIGIN}/`, {
    port: chrome.port,
    output: ['json'],
    logLevel: 'error',
    throttlingMethod: 'devtools',
  });
  if (real) {
    console.log('  category scores (real throttling) — reported, not gated\n');
    for (const threshold of THRESHOLDS) {
      const raw = real.lhr.categories[threshold.id]?.score;
      const score = raw === null || raw === undefined ? null : Math.round(raw * 100);
      console.log(`    ${threshold.label.padEnd(16)} ${String(score ?? 'n/a').padStart(3)}`);
    }
    for (const id of ['first-contentful-paint', 'largest-contentful-paint']) {
      const audit = real.lhr.audits[id];
      if (audit) console.log(`    ${id.padEnd(26)} ${String(audit.displayValue ?? '')}`);
    }
  }

  console.log('\n  installability (Chrome criteria, over CDP)\n');
  const installFailures = [];
  await checkInstallability(installFailures);
  console.log(
    `    ${'Installable PWA'.padEnd(16)}       (passes)      ${installFailures.length ? 'FAIL' : 'PASS'}`,
  );
  for (const failure of installFailures) console.log(`      - ${failure}`);
  failures.push(...installFailures);

  console.log('\n  wrote lighthouse-report.json and lighthouse-report.html');

  if (failures.length) {
    failed = true;
    console.error(`\nFAIL\n  ${failures.join('\n  ')}\n`);
  } else {
    console.log('\nPASS — executable-floor.md X10-X14 met.\n');
  }
} finally {
  try {
    if (chrome) await chrome.kill();
  } catch {
    // chrome-launcher's temp-profile cleanup races Windows file locking. The
    // browser is dead either way; a failed rmdir must not fail the audit.
  }
  server.kill();
}

process.exit(failed ? 1 : 0);
