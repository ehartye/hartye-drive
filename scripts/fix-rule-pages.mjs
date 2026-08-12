/**
 * One-shot: correct rule pdfPage values that the audit proves wrong.
 * Only rewrites a rule when its quote is found on exactly ONE page, so there
 * is never a guess. Re-run scripts/audit-rule-pages.mjs afterwards.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const norm = (s) =>
  s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();

const raw = readFileSync(join(root, 'docs/research/tn-dl-manual-extract.txt'), 'utf8');
const pages = new Map();
let cur = null;
for (const line of raw.split(/\r?\n/)) {
  const m = /^===== PAGE (\d+) =====$/.exec(line);
  if (m) { cur = Number(m[1]); pages.set(cur, []); }
  else if (cur !== null) pages.get(cur).push(line);
}
for (const [n, l] of pages) pages.set(n, norm(l.join(' ')));

const path = join(root, 'src/content/rules.json');
const doc = JSON.parse(readFileSync(path, 'utf8'));
const list = Array.isArray(doc) ? doc : (doc.rules ?? null);
if (!list) throw new Error('unexpected rules.json shape');

let fixed = 0;
for (const r of list) {
  const quote = norm(r.quote ?? '');
  const cited = Number(r.pdfPage ?? r.page);
  if (!quote || !Number.isFinite(cited)) continue;
  if ((pages.get(cited) ?? '').includes(quote)) continue;

  const found = [...pages.entries()].filter(([, t]) => t.includes(quote)).map(([n]) => n);
  if (found.length !== 1) continue; // never guess

  const actual = found[0];
  const key = 'pdfPage' in r ? 'pdfPage' : 'page';
  console.log(`  ${r.id}: ${key} ${cited} -> ${actual}`);
  r[key] = actual;
  // printed = pdf - 14 for PDF pp.15-132
  if ('printedPage' in r && actual >= 15 && actual <= 132) r.printedPage = actual - 14;
  fixed++;
}

writeFileSync(path, JSON.stringify(doc, null, 2) + '\n', 'utf8');
console.log(`\ncorrected ${fixed} rule page(s)`);
