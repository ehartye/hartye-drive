/**
 * Fast authoring aid: check every citation quote in the built bank against the
 * manual extract, both globally and on the cited page. Prints only failures.
 * The real gate is `npm run validate:content`; this exists so an author can
 * check a quote the moment they write it.
 *
 *   node scripts/check-quotes.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { normalizeForMatch } from './lib/content-normalize.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const extract = readFileSync(join(root, 'docs/research/tn-dl-manual-extract.txt'), 'utf8');
const haystack = normalizeForMatch(extract);

const pages = new Map();
const parts = extract.split(/===== PAGE (\d+) =====/);
for (let i = 1; i < parts.length; i += 2) pages.set(Number(parts[i]), normalizeForMatch(parts[i + 1] ?? ''));

const bank = JSON.parse(readFileSync(join(root, 'src/content/questions.json'), 'utf8'));
let bad = 0;
for (const q of bank.questions) {
  for (const [i, c] of q.citations.entries()) {
    const needle = normalizeForMatch(c.quote);
    const anywhere = haystack.includes(needle);
    const here = `${pages.get(c.pdfPage) ?? ''} ${pages.get(c.pdfPage + 1) ?? ''}`.includes(needle);
    if (!anywhere || !here) {
      bad += 1;
      console.log(`${q.id} citation ${i} (p.${c.pdfPage}) ${anywhere ? 'WRONG PAGE' : 'NOT FOUND'}: ${JSON.stringify(c.quote.slice(0, 100))}`);
    }
  }
}
console.log(`${bad} bad citation${bad === 1 ? '' : 's'} across ${bank.questions.length} questions`);
process.exit(bad === 0 ? 0 : 1);
