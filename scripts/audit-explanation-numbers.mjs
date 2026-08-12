/**
 * Every number a learner reads in an *explanation* should be traceable.
 *
 * The content validator checks that a citation quote is verbatim and on the
 * cited page, and that the quote supports the keyed answer. It says nothing
 * about the explanation prose beside it — which is how `gde-010` shipped
 * "often under 25 m.p.h." for the slow-moving-vehicle emblem, a figure that
 * appears nowhere in the manual.
 *
 * This flags any number in an explanation that appears neither in that
 * question's own cited quotes, nor in its stem or options, nor anywhere in the
 * manual extract. A hit is not automatically wrong — but it is a claim nobody
 * checked.
 *
 * Usage: node scripts/audit-explanation-numbers.mjs
 */
import { readFileSync } from 'node:fs';

const norm = (s) =>
  s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

const doc = JSON.parse(readFileSync('src/content/questions.json', 'utf8'));
const bank = doc.questions ?? doc;
const extract = norm(readFileSync('docs/research/tn-dl-manual-extract.txt', 'utf8'));

/** Ordinals and list markers carry no factual claim. */
const TRIVIAL = new Set(['1', '2', '3', '4', '10', '100']);

const numbersIn = (text) => [...new Set(norm(text).match(/\b\d[\d,]*(?:\.\d+)?\b/g) ?? [])];

const unbacked = [];
for (const q of bank) {
  const explanation = q.explanation ?? '';
  const quotes = norm((q.citations ?? []).map((c) => c.quote).join(' '));
  const own = norm(
    `${q.stem ?? ''} ${(q.options ?? []).map((o) => (typeof o === 'string' ? o : (o.text ?? ''))).join(' ')}`,
  );

  for (const n of numbersIn(explanation)) {
    if (TRIVIAL.has(n)) continue;
    if (quotes.includes(n) || own.includes(n)) continue;
    unbacked.push({
      id: q.id,
      number: n,
      inManualSomewhere: extract.includes(n),
      explanation: explanation.slice(0, 100),
    });
  }
}

console.log(`explanations audited      ${bank.length}`);
console.log(`numbers not in own quote  ${unbacked.length}`);

const notInManual = unbacked.filter((u) => !u.inManualSomewhere);
if (unbacked.length) {
  console.log('\n--- number appears in the explanation but not in its own citation ---');
  for (const u of unbacked) {
    console.log(`  ${u.id}  "${u.number}"  ${u.inManualSomewhere ? '(in the manual elsewhere)' : '*** NOT IN THE MANUAL AT ALL ***'}`);
    console.log(`      ${u.explanation}…`);
  }
}

console.log(
  notInManual.length
    ? `\nFAIL — ${notInManual.length} number(s) appear nowhere in the manual.`
    : '\nPASS — every number in every explanation appears in the manual.',
);
process.exit(notInManual.length ? 1 : 0);
