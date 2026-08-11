/**
 * Assembles `src/content/questions.json` from the authoring files in
 * `src/content/authoring/`.
 *
 * Authoring files carry the part a human wrote — stem, options, keyed answer,
 * explanation — and reference the manual by rule id. This script resolves each
 * `ruleId` into a full citation (PDF page, printed page, verbatim quote) out of
 * `src/content/rules.json`, so no quote is ever retyped and no citation can
 * drift from the manual text it came from. Inline citations (a raw pdfPage plus
 * quote, for passages the rule inventory does not cover) are passed through and
 * are checked by the validator exactly like the rest.
 *
 *   node scripts/build-questions.mjs
 *
 * The output is committed data. `npm run validate:content` is the gate that
 * decides whether it is fit to ship.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const contentDir = join(root, 'src/content');
const authoringDir = join(contentDir, 'authoring');

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

const taxonomy = readJson(join(contentDir, 'taxonomy.json'));
const rulesById = new Map(readJson(join(contentDir, 'rules.json')).rules.map((r) => [r.id, r]));
const topicsById = new Map(taxonomy.topics.map((t) => [t.id, t]));

const LETTERS = ['A', 'B', 'C', 'D'];

/**
 * Authored questions are written with the correct answer first, because that is
 * the order a human can proofread. Shipping them that way would teach the
 * learner "the answer is always A", so the bank rotates each question's options
 * by a hash of its own id: deterministic (the same bank every build, so the
 * validator and the tests are stable) but with no position tell.
 *
 * Two exceptions are never rotated:
 *  - the 27 official questions, which ship exactly as the State printed them;
 *  - any question with a combination option ("Both of the above", "A & B"),
 *    which is only meaningful in its authored position.
 */
const COMBINATION_OPTION = /\b(both|all|none|neither)\b.*\b(above|a and|a & b|of these)\b|^\s*a\s*&\s*b\s*$/i;

function fnv1a(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

function rotateOptions(id, options, answerIndex, isOfficial) {
  if (isOfficial || options.some((o) => COMBINATION_OPTION.test(o))) {
    return { options, answerIndex, rotated: false };
  }
  const shift = fnv1a(id) % options.length;
  if (shift === 0) return { options, answerIndex, rotated: false };
  return {
    options: [...options.slice(shift), ...options.slice(0, shift)],
    answerIndex: (answerIndex - shift + options.length) % options.length,
    rotated: true,
  };
}

/** printed = pdf - 14 for PDF pp.15-132 (manual-spine.md page mapping). */
function printedPageFor(pdfPage) {
  return pdfPage >= 15 && pdfPage <= 132 ? pdfPage - 14 : null;
}

function sectionFor(pdfPage) {
  if (pdfPage >= 39 && pdfPage <= 104) return 'B';
  if (pdfPage >= 105 && pdfPage <= 132) return 'C';
  return 'A';
}

function resolveCitation(cite, questionId) {
  if (cite.ruleId) {
    const rule = rulesById.get(cite.ruleId);
    if (!rule) throw new Error(`${questionId}: unknown ruleId ${cite.ruleId}`);
    const quotes = [rule.quote, ...rule.extraQuotes];
    const quote = quotes[cite.quotePick ?? 0];
    if (!quote) throw new Error(`${questionId}: ruleId ${cite.ruleId} has no quote at index ${cite.quotePick}`);
    return {
      pdfPage: cite.pdfPage ?? rule.pdfPage,
      printedPage: printedPageFor(cite.pdfPage ?? rule.pdfPage),
      quote,
      ruleId: rule.id,
    };
  }
  if (!cite.pdfPage || !cite.quote) throw new Error(`${questionId}: citation needs either ruleId or pdfPage+quote`);
  return { pdfPage: cite.pdfPage, printedPage: printedPageFor(cite.pdfPage), quote: cite.quote };
}

const files = readdirSync(authoringDir)
  .filter((f) => f.endsWith('.json'))
  .sort();

/** @type {any[]} */
const questions = [];

for (const file of files) {
  const doc = readJson(join(authoringDir, file));
  const isOfficial = file === 'official.json';
  for (const q of doc.questions) {
    const topic = topicsById.get(q.topic);
    if (!topic) throw new Error(`${q.id}: topic "${q.topic}" is not in taxonomy.json`);

    const citations = q.cite.map((c) => resolveCitation(c, q.id));
    const placed = rotateOptions(q.id, q.options, q.answer, isOfficial);
    const options = placed.options.map((text, i) => ({ letter: LETTERS[i], text }));

    questions.push({
      id: q.id,
      topic: q.topic,
      area: topic.area,
      section: sectionFor(citations[0].pdfPage),
      stem: q.stem,
      options,
      correctIndex: placed.answerIndex,
      correctOption: placed.options[placed.answerIndex],
      explanation: q.explanation,
      citations,
      ...(q.signs ? { signs: q.signs } : {}),
      official: isOfficial,
      ...(q.correctionId ? { correctionId: q.correctionId } : {}),
      ...(isOfficial && q.manualAnswerPointer
        ? {
            manualAnswerPointer: {
              printedPage: q.manualAnswerPointer.printedPage,
              pdfPage: q.manualAnswerPointer.printedPage + 14,
            },
          }
        : {}),
      ...(q.artworkNote ? { artworkNote: q.artworkNote } : {}),
      ...(q.pointerNote ? { pointerNote: q.pointerNote } : {}),
      sourceFile: `src/content/authoring/${file}`,
    });
  }
}

const byArea = {};
const byTopic = {};
const byOptionCount = {};
for (const q of questions) {
  byArea[q.area] = (byArea[q.area] ?? 0) + 1;
  byTopic[q.topic] = (byTopic[q.topic] ?? 0) + 1;
  const n = String(q.options.length);
  byOptionCount[n] = (byOptionCount[n] ?? 0) + 1;
}

const bank = {
  schemaVersion: 1,
  note: 'Generated by scripts/build-questions.mjs from src/content/authoring/. Do not hand-edit: edit the authoring file and rebuild. Every citation quote is verified verbatim against docs/research/tn-dl-manual-extract.txt by npm run validate:content.',
  counts: {
    total: questions.length,
    official: questions.filter((q) => q.official).length,
    byArea,
    byTopic,
    byOptionCount,
  },
  questions,
};

writeFileSync(join(contentDir, 'questions.json'), `${JSON.stringify(bank, null, 2)}\n`);
console.log(`wrote src/content/questions.json — ${questions.length} questions`);
console.log('  by area :', byArea);
console.log('  options :', byOptionCount);
