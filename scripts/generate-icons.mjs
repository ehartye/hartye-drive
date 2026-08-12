#!/usr/bin/env node
/**
 * Rasterizes the home-screen icons from `scripts/assets/*.svg`.
 *
 * The sources are hand-authored SVG built from the product's own sign
 * vocabulary — the `squareFace` construction and the two §2 colour tokens the
 * registry uses — and lettered in Overpass, the same self-hosted face the signs
 * are. There is no clipart and no stock art anywhere in this pipeline.
 *
 * The rasterizer is Playwright's Chromium, which is already a devDependency, so
 * no native image toolchain is added to the build. The Overpass woff2 is
 * inlined as a data URI rather than requested, so the render is hermetic and
 * the script works with the network disabled — like everything else here.
 *
 * The PNGs it writes are committed. `npm run build` never runs this; a checkout
 * with no browsers installed still builds.
 *
 *   npm run icons
 */
import { mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from '@playwright/test';

/* The `page.evaluate` callback below is serialized and run inside Chromium,
   not in Node — hence the browser global. */
/* global document */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'icons');

/** source svg · output basename · sizes in CSS px */
const TARGETS = [
  { source: 'icon-any.svg', name: 'icon', sizes: [192, 512] },
  { source: 'icon-maskable.svg', name: 'icon-maskable', sizes: [192, 512] },
  // iOS applies its own mask and never honours `purpose`, so the safe-zone
  // drawing is the one that survives the corner radius Safari imposes.
  { source: 'icon-maskable.svg', name: 'apple-touch-icon', sizes: [180] },
];

const fontData = readFileSync(path.join(ROOT, 'public', 'fonts', 'overpass-latin.woff2')).toString(
  'base64',
);

const page$ = (svg, size) => `<!doctype html>
<html><head><meta charset="utf-8"><style>
  @font-face {
    font-family: 'Overpass';
    font-style: normal;
    font-weight: 300 900;
    src: url(data:font/woff2;base64,${fontData}) format('woff2');
  }
  html, body { margin: 0; padding: 0; background: transparent; }
  svg { display: block; width: ${size}px; height: ${size}px; }
</style></head><body>${svg}</body></html>`;

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
try {
  for (const target of TARGETS) {
    const svg = readFileSync(path.join(ROOT, 'scripts', 'assets', target.source), 'utf8');
    for (const size of target.sizes) {
      const page = await browser.newPage({
        viewport: { width: size, height: size },
        deviceScaleFactor: 1,
      });
      await page.setContent(page$(svg, size), { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      const png = await page.screenshot({ omitBackground: true, type: 'png' });
      await page.close();

      const file = path.join(OUT, `${target.name}-${size}.png`);
      writeFileSync(file, png);
      const kb = (statSync(file).size / 1024).toFixed(1);
      console.log(`  ${path.relative(ROOT, file).replaceAll('\\', '/')}  ${size}×${size}  ${kb} KB`);
    }
  }
} finally {
  await browser.close();
}

console.log('\nPASS — icons rasterized from the sign vocabulary.');
