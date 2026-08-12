/**
 * Page-audit every rule in rules.json against the manual extract.
 *
 * rules.json is generated from manual-spine.md and, until now, was never
 * page-checked — a wrong page stayed invisible until a question happened to
 * cite it (that is how R376 was found). This sweeps all of them at once.
 *
 * Usage: node scripts/audit-rule-pages.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const norm = (s) =>
  s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

const raw = readFileSync(join(root, 'docs/research/tn-dl-manual-extract.txt'), 'utf8');

// Build a normalized text blob per PDF page.
const pages = new Map();
let current = null;
for (const line of raw.split(/\r?\n/)) {
  const m = /^===== PAGE (\d+) =====$/.exec(line);
  if (m) {
    current = Number(m[1]);
    pages.set(current, []);
  } else if (current !== null) {
    pages.get(current).push(line);
  }
}
for (const [n, lines] of pages) pages.set(n, norm(lines.join(' ')));

const rules = JSON.parse(readFileSync(join(root, 'src/content/rules.json'), 'utf8'));
const list = Array.isArray(rules) ? rules : (rules.rules ?? Object.values(rules));

let exact = 0;
const wrongPage = [];
const notFound = [];

for (const r of list) {
  const quote = norm(r.quote ?? '');
  const cited = Number(r.pdfPage ?? r.page);
  if (!quote || !Number.isFinite(cited)) continue;

  if ((pages.get(cited) ?? '').includes(quote)) {
    exact++;
    continue;
  }
  // Where does it actually live?
  const found = [...pages.entries()].filter(([, text]) => text.includes(quote)).map(([n]) => n);
  if (found.length) wrongPage.push({ id: r.id, cited, actual: found, quote: quote.slice(0, 90) });
  else notFound.push({ id: r.id, cited, quote: quote.slice(0, 90) });
}

console.log(`rules audited     ${list.length}`);
console.log(`page-exact        ${exact}`);
console.log(`wrong page        ${wrongPage.length}`);
console.log(`quote not found   ${notFound.length}`);

if (wrongPage.length) {
  console.log('\n--- cited on the wrong page ---');
  for (const w of wrongPage) console.log(`  ${w.id}: cited ${w.cited}, actually on ${w.actual.join(',')} :: "${w.quote}…"`);
}
if (notFound.length) {
  console.log('\n--- quote not found anywhere (normalization or transcription) ---');
  for (const n of notFound.slice(0, 20)) console.log(`  ${n.id}: cited ${n.cited} :: "${n.quote}…"`);
  if (notFound.length > 20) console.log(`  … and ${notFound.length - 20} more`);
}

process.exit(wrongPage.length || notFound.length ? 1 : 0);
