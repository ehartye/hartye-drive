#!/usr/bin/env node
/**
 * One-time build-setup fetch of the three self-hosted faces (grounding §2).
 *
 * The shipped app makes ZERO font requests at runtime (practices F5) — this
 * script runs once at setup, writes `public/fonts/*.woff2`, and the results are
 * committed. It is not part of `dev`, `build`, or `verify`.
 *
 * We request the Google Fonts CSS API with a modern-Chrome UA so the response
 * is `woff2` with `unicode-range` subsets, then keep only the `latin` and
 * `latin-ext` subsets — everything this English-only product (ratified
 * exclusion: no i18n) can render.
 *
 *   node scripts/fetch-fonts.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

const OUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'public',
  'fonts',
);

/** Faces we self-host, with the axis ranges the design system actually uses. */
const FACES = [
  {
    file: 'overpass-latin.woff2',
    query: 'family=Overpass:wght@300..900',
    label: 'Overpass (variable weight 300–900)',
  },
  {
    file: 'overpass-mono-latin.woff2',
    query: 'family=Overpass+Mono:wght@300..700',
    label: 'Overpass Mono (variable weight 300–700)',
  },
  {
    file: 'newsreader-latin.woff2',
    query: 'family=Newsreader:opsz,wght@6..72,200..800',
    label: 'Newsreader (variable optical size + weight)',
  },
  {
    file: 'newsreader-italic-latin.woff2',
    query: 'family=Newsreader:ital,opsz,wght@1,6..72,200..800',
    label: 'Newsreader Italic (manual quotations)',
    italic: true,
  },
];

/** Parse `@font-face` blocks out of the CSS API response. */
function parseFaces(css) {
  return [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g)].map(
    ([, subset, body]) => ({
      subset,
      style: /font-style:\s*italic/.test(body) ? 'italic' : 'normal',
      url: body.match(/url\((https:[^)]+\.woff2)\)/)?.[1],
    }),
  );
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const report = [];

  for (const face of FACES) {
    const cssUrl = `https://fonts.googleapis.com/css2?${face.query}&display=swap`;
    const css = await fetch(cssUrl, { headers: { 'User-Agent': UA } }).then((r) => {
      if (!r.ok) throw new Error(`${cssUrl} -> ${r.status}`);
      return r.text();
    });

    const wanted = face.italic ? 'italic' : 'normal';
    const blocks = parseFaces(css).filter(
      (b) => b.subset === 'latin' && b.style === wanted && b.url,
    );
    if (blocks.length !== 1) {
      throw new Error(
        `expected exactly one latin/${wanted} block for ${face.label}, got ${blocks.length}`,
      );
    }

    const bytes = Buffer.from(
      await fetch(blocks[0].url, { headers: { 'User-Agent': UA } }).then((r) => {
        if (!r.ok) throw new Error(`${blocks[0].url} -> ${r.status}`);
        return r.arrayBuffer();
      }),
    );
    await writeFile(path.join(OUT, face.file), bytes);
    report.push(`  ${face.file.padEnd(32)} ${(bytes.length / 1024).toFixed(1)} KB  ${face.label}`);
  }

  console.log(`Wrote ${FACES.length} woff2 files to public/fonts:\n${report.join('\n')}`);
  console.log('\nCommit these. The app never requests a font at runtime.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
