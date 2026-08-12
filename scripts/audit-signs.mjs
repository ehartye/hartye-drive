#!/usr/bin/env node
/**
 * X7b — `npm run audit:signs`. The sign-registry build gate
 * (`executable-floor.md` §3b).
 *
 * Phase 1 shipped three factually wrong signs — school in fluorescent pink,
 * W10-1 drawn as a `+` instead of an `X`, R1-2 with its colours inverted — and
 * each was caught only because a critic happened to look closely. Sign
 * correctness is this product's central claim, so it gets a machine check.
 *
 * What this does, in order:
 *
 *   1. bundles `src/signs/audit-entry.tsx` with esbuild and renders **the real
 *      `SignSvg`** for every registry entry, in labelled and drill mode;
 *   2. lays every face out in headless Chromium at ≥200 px with the app's own
 *      self-hosted Overpass, and measures each `<text>` node's real bounding
 *      box, testing all four corners against the face outline with
 *      `isPointInFill` — legend containment, actually measured;
 *   3. runs `src/signs/audit.ts` over the registry, those measurements and the
 *      question bank;
 *   4. re-runs the checker against `tests/fixtures/sign-audit/`, which proves
 *      each assertion still fails on a sign built to break it.
 *
 * Flags:
 *   --sheet   also write artifacts/signs-contact-sheet.{html,png} — the whole
 *             registry in one image, so a human can scan it in one pass.
 */
/* `measureInPage` and the two `page.evaluate` callbacks below are serialized and
   run inside Chromium, not in Node — hence the browser globals. */
/* global document, DOMPoint */
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUILD_DIR = path.join(ROOT, 'node_modules', '.cache', 'tn-drive-sign-audit');
const BUNDLE = path.join(BUILD_DIR, 'audit-entry.mjs');
const ARTIFACTS = path.join(ROOT, 'artifacts');
const FIXTURES = path.join(ROOT, 'tests', 'fixtures', 'sign-audit');

const wantSheet = process.argv.includes('--sheet');

/* ------------------------------------------------------------------ bundle */

async function buildBundle() {
  const esbuild = await import('esbuild');
  mkdirSync(BUILD_DIR, { recursive: true });
  await esbuild.build({
    entryPoints: [path.join(ROOT, 'src', 'signs', 'audit-entry.tsx')],
    outfile: BUNDLE,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node22',
    jsx: 'automatic',
    logLevel: 'warning',
    external: ['react', 'react-dom', 'react-dom/server', 'react/jsx-runtime'],
    alias: { '~': path.join(ROOT, 'src') },
  });
  return import(pathToFileURL(BUNDLE).href);
}

/* -------------------------------------------------------------- the page */

const FONT_FILES = {
  Overpass: 'overpass-latin.woff2',
  'Overpass Mono': 'overpass-mono-latin.woff2',
};

function fontFaces() {
  return Object.entries(FONT_FILES)
    .map(([family, file]) => {
      const data = readFileSync(path.join(ROOT, 'public', 'fonts', file)).toString('base64');
      return `@font-face{font-family:'${family}';font-weight:300 900;font-style:normal;src:url(data:font/woff2;base64,${data}) format('woff2');}`;
    })
    .join('\n');
}

/**
 * Sizes are the gate's own, not the app's: `executable-floor.md` §3b requires
 * every sign on the contact sheet at **≥200 px**, so no face is judged at a
 * size where a legend error is invisible. Both dimensions clear 200.
 */
const SIZE_CSS = `
  .sign{width:220px;height:220px;display:block}
  .sign--wide{width:280px;height:200px}
  .sign--tall{width:200px;height:253px}
`;

function buildHtml(records) {
  const cells = records
    .map((record) => {
      // The face outline goes inside the same root <svg>, so `isPointInFill`
      // reads it in the same user space the text boxes are mapped into. It is
      // painted at zero opacity: present as geometry, invisible as art.
      const withFace = record.svg.replace(
        '</svg>',
        `<path data-face="1" d="${record.face}" fill="#000" opacity="0"></path></svg>`,
      );
      return `<figure class="cell" data-sign-id="${record.id}">
  ${withFace}
  <figcaption><b>${record.mutcd}</b><span>${escapeHtml(record.label)}</span><i>${record.category}</i></figcaption>
</figure>`;
    })
    .join('\n');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>TN Class D — sign registry contact sheet</title>
<style>
${fontFaces()}
${SIZE_CSS}
  :root{color-scheme:dark}
  body{margin:0;padding:28px;background:#14161A;color:#F2F4F1;font-family:'Overpass',system-ui,sans-serif}
  h1{font-size:20px;margin:0 0 4px}
  p.lede{color:#9BA3AE;font-size:13px;margin:0 0 24px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:26px}
  .cell{margin:0;background:#1C1F25;border:1px solid #2A2F38;border-radius:14px;padding:16px;
        display:flex;flex-direction:column;align-items:center;gap:12px}
  .cell svg{filter:drop-shadow(0 2px 8px rgba(0,0,0,.55))}
  figcaption{display:flex;flex-direction:column;align-items:center;gap:2px;text-align:center}
  figcaption b{font-family:'Overpass Mono',monospace;font-size:12px;color:#FFCC00}
  figcaption span{font-size:13px}
  figcaption i{font-size:11px;color:#808894;font-style:normal;text-transform:uppercase;letter-spacing:.08em}
</style></head><body>
<h1>Tennessee Class D — sign registry contact sheet</h1>
<p class="lede">${records.length} signs, every face hand-authored SVG at true MUTCD colour. Rendered at &ge;200&nbsp;px by <code>npm run audit:signs -- --sheet</code>.</p>
<div class="grid">
${cells}
</div></body></html>`;
}

const escapeHtml = (value) =>
  value.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);

/* ---------------------------------------------------------- measurement */

/** Runs inside the page. Returns one record per sign with measured text boxes. */
function measureInPage() {
  const out = [];
  for (const cell of document.querySelectorAll('[data-sign-id]')) {
    const svg = cell.querySelector('svg');
    const face = cell.querySelector('path[data-face]');
    const rootCtm = svg.getScreenCTM();
    const texts = [];
    for (const node of svg.querySelectorAll('text')) {
      const box = node.getBBox();
      const toRoot = rootCtm.inverse().multiply(node.getScreenCTM());
      const corners = [
        [box.x, box.y],
        [box.x + box.width, box.y],
        [box.x, box.y + box.height],
        [box.x + box.width, box.y + box.height],
      ].map(([x, y]) => new DOMPoint(x, y).matrixTransform(toRoot));
      const xs = corners.map((p) => p.x);
      const ys = corners.map((p) => p.y);
      texts.push({
        text: node.textContent ?? '',
        contained:
          face !== null && corners.every((p) => face.isPointInFill(new DOMPoint(p.x, p.y))),
        box: {
          x: Math.min(...xs),
          y: Math.min(...ys),
          width: Math.max(...xs) - Math.min(...xs),
          height: Math.max(...ys) - Math.min(...ys),
        },
      });
    }
    out.push({ id: cell.dataset.signId, texts });
  }
  return out;
}

async function measure(html) {
  let chromium;
  try {
    ({ chromium } = await import('@playwright/test'));
  } catch {
    fatal('Playwright is not installed. `npm ci` then `npx playwright install chromium`.');
  }
  let browser;
  try {
    browser = await chromium.launch();
  } catch (error) {
    fatal(
      `Could not launch headless Chromium, which this gate needs to measure legend bounding boxes for real.\n  Run \`npx playwright install chromium\`.\n  ${String(error)}`,
    );
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const measured = await page.evaluate(measureInPage);
  let screenshot;
  if (wantSheet) screenshot = await page.screenshot({ fullPage: true });
  await browser.close();
  return { measured, screenshot };
}

/* -------------------------------------------------------------- fixtures */

/**
 * Every assertion has to be provably strict, or the gate is decoration. Each
 * fixture is a whole audit input built to break exactly one rule; a fixture
 * that stops failing is itself a failure.
 */
function runFixtures(auditSigns) {
  const files = readdirSync(FIXTURES)
    .filter((name) => name.endsWith('.json'))
    .sort();
  const results = [];
  for (const name of files) {
    const fixture = JSON.parse(readFileSync(path.join(FIXTURES, name), 'utf8'));
    const failures = auditSigns(fixture.input);
    const codes = new Set(failures.map((f) => f.code));
    const ok =
      fixture.expect === null ? failures.length === 0 : codes.has(fixture.expect);
    results.push({
      name,
      expect: fixture.expect,
      ok,
      got: [...codes].sort(),
      note: fixture.note,
      message: failures.find((f) => f.code === fixture.expect)?.message ?? '',
    });
  }
  return results;
}

/* ------------------------------------------------------------------ main */

function fatal(message) {
  console.error(`\naudit:signs FAILED\n  ${message}`);
  process.exit(1);
}

const bundle = await buildBundle();
const records = bundle.collectRenders();
const html = buildHtml(records);
const { measured, screenshot } = await measure(html);

const measuredById = new Map(measured.map((m) => [m.id, m]));
const rendered = records.map((record) => ({
  id: record.id,
  drawn: record.drawn,
  paints: record.paints,
  texts: measuredById.get(record.id)?.texts ?? [],
  name: record.name,
  drillName: record.drillName,
}));

const failures = bundle.auditSigns({
  registry: bundle.registry,
  rendered,
  questions: bundle.questions,
});

const fixtures = runFixtures(bundle.auditSigns);

if (wantSheet) {
  mkdirSync(ARTIFACTS, { recursive: true });
  writeFileSync(path.join(ARTIFACTS, 'signs-contact-sheet.html'), html);
  if (screenshot) writeFileSync(path.join(ARTIFACTS, 'signs-contact-sheet.png'), screenshot);
}

/* ------------------------------------------------------------------ report */

const drawn = records.filter((r) => r.drawn).length;
const textCount = rendered.reduce((sum, r) => sum + r.texts.length, 0);

console.log('audit:signs — MUTCD sign registry gate (executable-floor.md 3b)\n');
console.log(`  registry entries                 ${records.length}`);
console.log(`  hand-authored faces              ${drawn} (floor ${bundle.MIN_DRAWN_SIGNS})`);
console.log(`  legend nodes measured in browser ${textCount}`);
console.log(`  palette tokens                   ${bundle.registry.palette.join(', ')}`);
console.log(
  `  contact sheet                    ${wantSheet ? 'artifacts/signs-contact-sheet.{html,png}' : 'pass --sheet to write it'}`,
);

console.log('\n  self-check — every assertion still fails on its fixture');
for (const result of fixtures) {
  const label = result.expect === null ? 'clean input, no failures' : result.expect;
  console.log(`    ${result.ok ? 'OK  ' : 'DEAD'}  ${label.padEnd(28)} ${result.name}`);
  if (!result.ok) console.log(`          expected ${String(result.expect)}, got [${result.got.join(', ')}]`);
}

const deadFixtures = fixtures.filter((r) => !r.ok);

if (failures.length > 0 || deadFixtures.length > 0 || fixtures.length === 0) {
  if (failures.length > 0) {
    console.error(`\n${failures.length} sign failure(s):\n`);
    for (const failure of failures) {
      console.error(`  [${failure.code}] ${failure.subject}\n      ${failure.message}`);
    }
  }
  if (fixtures.length === 0) console.error('\nNo regression fixtures found — the gate cannot prove it is strict.');
  if (deadFixtures.length > 0) {
    console.error(`\n${deadFixtures.length} assertion(s) no longer fail on their fixture.`);
  }
  console.error('\nFAIL');
  process.exit(1);
}

console.log(`\nPASS — ${drawn} signs drawn, ${textCount} legends inside their faces, 0 failures.`);

// Keep the cache small; the bundle is rebuilt on every run anyway.
try {
  rmSync(BUILD_DIR, { recursive: true, force: true });
} catch {
  /* a locked cache file is not a reason to fail a green audit */
}
