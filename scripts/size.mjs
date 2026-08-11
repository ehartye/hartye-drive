#!/usr/bin/env node
/**
 * X8 / X9 — bundle size against the offline weight budget (grounding §8).
 *
 *   initial JS (gzipped, excluding the question-bank chunk)  ≤ 180 KB
 *   total precached payload                                  ≤ 2.5 MB
 *
 * Reports gzipped bytes per chunk and exits non-zero on a breach.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

const INITIAL_JS_LIMIT = 180 * 1024;
const TOTAL_LIMIT = 2.5 * 1024 * 1024;

/** Chunks whose weight is content, not app shell, and are excluded from X8. */
const CONTENT_CHUNK = /(question-bank|questions|content)-[\w-]*\.js$/;

if (!existsSync(DIST)) {
  console.error('dist/ is missing. Run `npm run build` first.');
  process.exit(1);
}

const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else
      files.push({
        rel: path.relative(DIST, full).replaceAll('\\', '/'),
        raw: statSync(full).size,
        gz: gzipSync(readFileSync(full), { level: 9 }).length,
      });
  }
};
walk(DIST);
files.sort((a, b) => b.gz - a.gz);

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const entryHtml = readFileSync(path.join(DIST, 'index.html'), 'utf8');

/** A module the entry HTML pulls in directly, plus everything it imports. */
const entryScripts = new Set(
  [...entryHtml.matchAll(/<script[^>]+src="\/([^"]+\.js)"/g)].map((m) => m[1]),
);
const preloaded = new Set(
  [...entryHtml.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="\/([^"]+)"/g)].map((m) => m[1]),
);

const isInitialJs = (f) =>
  f.rel.endsWith('.js') && (entryScripts.has(f.rel) || preloaded.has(f.rel)) && !CONTENT_CHUNK.test(f.rel);

const initialJs = files.filter(isInitialJs).reduce((sum, f) => sum + f.gz, 0);
const totalRaw = files.reduce((sum, f) => sum + f.raw, 0);

console.log('gzipped size per file\n');
for (const f of files) {
  const tag = isInitialJs(f) ? ' [initial JS]' : '';
  console.log(`  ${kb(f.gz).padStart(10)}  ${f.rel}${tag}`);
}

console.log('\n--- budget ---');
console.log(
  `  initial JS (gzip, excl. question bank)  ${kb(initialJs)} / ${kb(INITIAL_JS_LIMIT)}`,
);
console.log(`  total precached payload (raw)           ${kb(totalRaw)} / ${kb(TOTAL_LIMIT)}`);

const failures = [];
if (initialJs > INITIAL_JS_LIMIT) failures.push(`initial JS ${kb(initialJs)} exceeds ${kb(INITIAL_JS_LIMIT)}`);
if (totalRaw > TOTAL_LIMIT) failures.push(`total payload ${kb(totalRaw)} exceeds ${kb(TOTAL_LIMIT)}`);

if (failures.length) {
  console.error(`\nFAIL\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log('\nPASS — within the offline weight budget.');
