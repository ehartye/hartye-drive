#!/usr/bin/env node
/**
 * Content validator — the gate that decides whether the question bank is fit to
 * ship. Enforces `docs/superpowers/bars/2026-08-11-tn-drivers-test-app/executable-floor.md` §3.
 *
 *   npm run validate:content
 *   node scripts/validate-content.mjs --json      machine-readable summary
 *   node scripts/validate-content.mjs --content-dir <dir>   validate a fixture
 *
 * Exit 0 only when every check passes. Any failure prints the offending id and
 * exits 1 — this runs in `npm run verify`, so a bad citation breaks the build
 * rather than reaching a learner.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { normalizeForMatch } from './lib/content-normalize.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const argv = process.argv.slice(2);
const jsonOut = argv.includes('--json');
const dirFlag = argv.indexOf('--content-dir');
const contentDir = dirFlag === -1 ? join(root, 'src/content') : resolve(process.cwd(), argv[dirFlag + 1]);
const extractPath = join(root, 'docs/research/tn-dl-manual-extract.txt');

const BLUEPRINT_AREAS = ['signs', 'safe-driving', 'rules-of-road', 'alcohol-drugs'];
const MIN_QUESTIONS = 300;
const MIN_TOPICS = 12;
const MIN_PER_TOPIC = 10;
const MIN_PER_AREA = 60;
const MIN_SIGNS = 80;
const MIN_THREE_OPTION_SHARE = 0.8;
const OFFICIAL_COUNT = 27;
const EXAM_SIZE = 30;
const EXAM_RUNS = 10;
// MUTCD 2009 designations: R1-1, R1-3P, W13-1P, R5-1a, OM3-L, I-13, G20-2, S5-1.
const MUTCD_PATTERN = /^[A-Z]{1,3}-?\d{1,3}[a-z]?(-(\d{1,2}[a-z]?|[LR]))?P?$/;

const failures = [];
const warnings = [];
const fail = (check, id, message) => failures.push({ check, id, message });

function readJson(name) {
  const path = join(contentDir, name);
  if (!existsSync(path)) {
    fail('files', name, `missing required content file ${path}`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    fail('files', name, `is not valid JSON: ${err.message}`);
    return null;
  }
}

const bank = readJson('questions.json');
const taxonomy = readJson('taxonomy.json');
const signRegistry = readJson('signs.json');
const neverGenerate = readJson('never-generate.json');
const corrections = readJson('corrections.json');

if (failures.length > 0) report();

const extract = readFileSync(extractPath, 'utf8');
const haystack = normalizeForMatch(extract);

const questions = bank.questions ?? [];
const topics = new Map((taxonomy.topics ?? []).map((t) => [t.id, t]));
const signs = signRegistry.signs ?? [];
const signIds = new Set(signs.map((s) => s.id));
const correctionIds = new Set((corrections.corrections ?? []).map((c) => c.id));

/* ------------------------------------------------------------------ *
 * 1. Taxonomy
 * ------------------------------------------------------------------ */
{
  const declared = (taxonomy.blueprint?.areas ?? []).map((a) => a.id);
  for (const area of BLUEPRINT_AREAS) {
    if (!declared.includes(area)) fail('taxonomy', 'blueprint', `blueprint is missing area "${area}"`);
  }
  for (const t of taxonomy.topics ?? []) {
    if (!BLUEPRINT_AREAS.includes(t.area)) {
      fail('taxonomy', t.id, `topic maps to "${t.area}", which is not one of the four blueprint areas`);
    }
  }
  const bpQuote = taxonomy.blueprint?.quote;
  if (bpQuote && !haystack.includes(normalizeForMatch(bpQuote))) {
    fail('taxonomy', 'blueprint', 'the blueprint quote does not appear verbatim in the manual extract');
  }
}

/* ------------------------------------------------------------------ *
 * 2. Never-generate list (D15)
 * ------------------------------------------------------------------ */
const REQUIRED_BANS = [
  'move-over-lane-threshold',
  'license-renewal-cycle',
  'temporary-driver-license-fees',
  'gdl-fee-figures',
  'back-seat-belt-age-17',
  'bicyclists-may-disregard-signals',
];
{
  const present = new Set((neverGenerate.entries ?? []).map((e) => e.id));
  for (const id of REQUIRED_BANS) {
    if (!present.has(id)) fail('never-generate', id, 'required never-generate entry is missing');
  }
  for (const entry of neverGenerate.entries ?? []) {
    if (!entry.reason || !entry.source) {
      fail('never-generate', entry.id, 'every entry needs a reason and a source');
    }
  }
}

const bannedRuleIds = new Map();
for (const entry of neverGenerate.entries ?? []) {
  for (const rid of entry.bannedRuleIds ?? []) bannedRuleIds.set(rid, entry.id);
}

function checkBanned(question) {
  const haystacks = [
    question.stem,
    ...question.options.map((o) => o.text),
    question.explanation,
    ...question.citations.map((c) => c.quote),
  ];
  const blob = haystacks.join('\n');

  for (const c of question.citations) {
    const banned = c.ruleId && bannedRuleIds.get(c.ruleId);
    if (banned) fail('never-generate', question.id, `cites rule ${c.ruleId}, banned by "${banned}"`);
  }

  for (const entry of neverGenerate.entries ?? []) {
    for (const sub of entry.bannedQuoteSubstrings ?? []) {
      if (blob.includes(sub)) {
        fail('never-generate', question.id, `contains banned phrase "${sub}" (${entry.id})`);
      }
    }
    for (const pattern of entry.bannedPatterns ?? []) {
      const hitsAll = pattern.allOf.every((src) => new RegExp(src, pattern.flags ?? '').test(blob));
      if (hitsAll) {
        fail('never-generate', question.id, `matches banned pattern [${pattern.allOf.join(' + ')}] (${entry.id})`);
      }
    }
  }
}

/* ------------------------------------------------------------------ *
 * 3. Page-scoped quote lookup
 *
 * A quote must not merely exist somewhere in the manual — it must exist on
 * the page the citation names, or straddling that page's break, or a learner
 * who follows the citation lands on the wrong rule.
 * ------------------------------------------------------------------ */
const pageIndex = new Map();
{
  const parts = extract.split(/===== PAGE (\d+) =====/);
  for (let i = 1; i < parts.length; i += 2) {
    pageIndex.set(Number(parts[i]), normalizeForMatch(parts[i + 1] ?? ''));
  }
}

function quoteIsOnPage(quote, pdfPage) {
  const needle = normalizeForMatch(quote);
  for (const page of [pdfPage, pdfPage + 1]) {
    const text = pageIndex.get(page);
    if (text && text.includes(needle)) return true;
  }
  const joined = `${pageIndex.get(pdfPage) ?? ''} ${pageIndex.get(pdfPage + 1) ?? ''}`;
  return joined.includes(needle);
}

/* ------------------------------------------------------------------ *
 * 4. Per-question invariants
 * ------------------------------------------------------------------ */
const seenIds = new Set();
const seenStems = new Map();
const byArea = Object.fromEntries(BLUEPRINT_AREAS.map((a) => [a, 0]));
const byTopic = new Map();
let threeOptionCount = 0;

for (const q of questions) {
  const id = q.id ?? '(no id)';

  if (seenIds.has(id)) fail('ids', id, 'duplicate question id');
  seenIds.add(id);

  // -- topic + area ------------------------------------------------
  const topic = topics.get(q.topic);
  if (!topic) {
    fail('topic', id, `topic "${q.topic}" is not in taxonomy.json`);
  } else {
    if (topic.area !== q.area) fail('topic', id, `area "${q.area}" disagrees with taxonomy ("${topic.area}")`);
    byTopic.set(q.topic, (byTopic.get(q.topic) ?? 0) + 1);
  }
  if (!BLUEPRINT_AREAS.includes(q.area)) fail('area', id, `area "${q.area}" is not a blueprint area`);
  else byArea[q.area] += 1;

  // -- section B or C, never A ------------------------------------
  if (q.section !== 'B' && q.section !== 'C') {
    fail('section', id, `source section is "${q.section}" — the exam pool is sections B and C only`);
  }

  // -- stem --------------------------------------------------------
  if (!q.stem || q.stem.trim().length < 10) fail('stem', id, 'stem is missing or too short');
  const stemKey = normalizeForMatch(q.stem ?? '').toLowerCase();
  if (seenStems.has(stemKey)) fail('stem', id, `stem is a duplicate of ${seenStems.get(stemKey)}`);
  else seenStems.set(stemKey, id);

  // -- options -----------------------------------------------------
  const options = q.options ?? [];
  if (options.length < 2 || options.length > 4) {
    fail('options', id, `has ${options.length} options — the format allows 2 to 4`);
  }
  if (options.length === 3) threeOptionCount += 1;

  const texts = options.map((o) => normalizeForMatch(o.text ?? '').toLowerCase());
  for (const [i, text] of texts.entries()) {
    if (!text) fail('options', id, `option ${i} has no text`);
    if (texts.indexOf(text) !== i) fail('options', id, `option ${i} duplicates an earlier option`);
  }
  const letters = options.map((o) => o.letter);
  if (new Set(letters).size !== letters.length) fail('options', id, 'option letters are not unique');

  // -- exactly one keyed answer ------------------------------------
  if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex >= options.length) {
    fail('answer', id, `correctIndex ${q.correctIndex} is not a valid option index`);
  } else if (q.correctOption !== options[q.correctIndex].text) {
    fail('answer', id, 'correctOption text does not match the option at correctIndex');
  }

  // -- explanation --------------------------------------------------
  if (!q.explanation || q.explanation.trim().length < 20) {
    fail('explanation', id, 'explanation is missing or too short to teach anything');
  }

  // -- citations ----------------------------------------------------
  const citations = q.citations ?? [];
  if (citations.length < 1) {
    fail('citation', id, 'has no citation — every question needs a manual page and a verbatim quote');
  }
  for (const [i, c] of citations.entries()) {
    if (!Number.isInteger(c.pdfPage) || c.pdfPage < 1) {
      fail('citation', id, `citation ${i} has no usable pdfPage`);
      continue;
    }
    const expectedPrinted = c.pdfPage >= 15 && c.pdfPage <= 132 ? c.pdfPage - 14 : null;
    if (c.printedPage !== expectedPrinted) {
      fail('citation', id, `citation ${i} printedPage ${c.printedPage} should be ${expectedPrinted} (printed = pdf - 14 for pp.15-132)`);
    }
    if (!c.quote || c.quote.trim().length < 15) {
      fail('citation', id, `citation ${i} has no usable quote`);
      continue;
    }
    if (!haystack.includes(normalizeForMatch(c.quote))) {
      fail('citation', id, `citation ${i} quote does not appear verbatim in the manual extract: "${c.quote.slice(0, 70)}..."`);
    }
    if (!quoteIsOnPage(c.quote, c.pdfPage)) {
      fail('citation', id, `citation ${i} quote does not appear on PDF page ${c.pdfPage}`);
    }
  }

  // -- signs --------------------------------------------------------
  for (const signId of q.signs ?? []) {
    if (!signIds.has(signId)) fail('signs', id, `references sign "${signId}", which is not in the sign registry`);
  }

  // -- corrections --------------------------------------------------
  if (q.correctionId && !correctionIds.has(q.correctionId)) {
    fail('corrections', id, `correctionId "${q.correctionId}" is not in corrections.json`);
  }

  checkBanned(q);
}

/* ------------------------------------------------------------------ *
 * 5. Official set
 * ------------------------------------------------------------------ */
{
  const official = questions.filter((q) => q.official === true);
  if (official.length !== OFFICIAL_COUNT) {
    fail('official', 'set', `expected ${OFFICIAL_COUNT} official sample questions flagged official:true, found ${official.length}`);
  }
  for (let n = 1; n <= OFFICIAL_COUNT; n += 1) {
    const id = `official-${String(n).padStart(2, '0')}`;
    if (!official.some((q) => q.id === id)) fail('official', id, 'official sample question is missing');
  }
  for (const q of official) {
    if (!q.manualAnswerPointer?.printedPage) {
      fail('official', q.id, 'official questions must carry the manual\'s own answer pointer');
    }
  }
}

/* ------------------------------------------------------------------ *
 * 6. Volume floors
 * ------------------------------------------------------------------ */
{
  if (questions.length < MIN_QUESTIONS) {
    fail('volume', 'questions', `${questions.length} questions — the floor is ${MIN_QUESTIONS}`);
  }
  if (byTopic.size < MIN_TOPICS) {
    fail('volume', 'topics', `${byTopic.size} topics — the floor is ${MIN_TOPICS}`);
  }
  for (const [topicId, count] of [...byTopic].sort()) {
    if (count < MIN_PER_TOPIC) fail('volume', topicId, `${count} questions — the floor is ${MIN_PER_TOPIC} per topic`);
  }
  for (const area of BLUEPRINT_AREAS) {
    if (byArea[area] < MIN_PER_AREA) {
      fail('volume', area, `${byArea[area]} questions — the floor is ${MIN_PER_AREA} per blueprint area`);
    }
  }
  const share = questions.length === 0 ? 0 : threeOptionCount / questions.length;
  if (share < MIN_THREE_OPTION_SHARE) {
    fail('options', 'format', `only ${(share * 100).toFixed(1)}% of questions have exactly 3 options — the floor is ${MIN_THREE_OPTION_SHARE * 100}%`);
  }
}

/* ------------------------------------------------------------------ *
 * 7. Sign registry
 * ------------------------------------------------------------------ */
{
  if (signs.length < MIN_SIGNS) fail('signs', 'registry', `${signs.length} signs — the floor is ${MIN_SIGNS}`);
  const seen = new Set();
  const palette = new Set(signRegistry.palette ?? []);
  for (const s of signs) {
    const id = s.id ?? '(no id)';
    if (seen.has(id)) fail('signs', id, 'duplicate sign id');
    seen.add(id);
    if (!s.mutcd || !MUTCD_PATTERN.test(s.mutcd)) {
      fail('signs', id, `MUTCD designation "${s.mutcd}" is missing or malformed — a sign with no designation fails the build`);
    }
    if (!s.category) fail('signs', id, 'missing category');
    if (!s.shape) fail('signs', id, 'missing shape');
    if (!s.faceColor) fail('signs', id, 'missing faceColor');
    if (!s.legendColor) fail('signs', id, 'missing legendColor');
    if (!s.meaning || s.meaning.length < 15) fail('signs', id, 'missing or trivial meaning');
    for (const color of [s.faceColor, s.legendColor, ...(s.accentColors ?? [])]) {
      if (palette.size > 0 && !palette.has(color)) fail('signs', id, `color "${color}" is outside the declared palette`);
    }
    const c = s.citation;
    if (!c || !Number.isInteger(c.pdfPage) || !c.quote) {
      fail('signs', id, 'missing a manual citation with a pdfPage and a quote');
      continue;
    }
    const expectedPrinted = c.pdfPage >= 15 && c.pdfPage <= 132 ? c.pdfPage - 14 : null;
    if (c.printedPage !== expectedPrinted) {
      fail('signs', id, `citation printedPage ${c.printedPage} should be ${expectedPrinted}`);
    }
    if (!haystack.includes(normalizeForMatch(c.quote))) {
      fail('signs', id, `citation quote does not appear verbatim in the manual extract: "${c.quote.slice(0, 60)}..."`);
    }
    if (s.meaningSource && s.meaningSource.kind === 'mutcd' && !s.meaningSource.reference) {
      fail('signs', id, 'meaningSource of kind "mutcd" must carry a reference');
    }
  }
}

/* ------------------------------------------------------------------ *
 * 8. Blueprint conformance — simulated exams
 * ------------------------------------------------------------------ */
const examRuns = [];
{
  const pools = Object.fromEntries(BLUEPRINT_AREAS.map((a) => [a, questions.filter((q) => q.area === a)]));
  // 30 questions at 25% each is 7.5 per area, so an exam takes 8/7/8/7 and
  // rotates which areas get the extra question.
  for (let run = 0; run < EXAM_RUNS; run += 1) {
    const quotas = {};
    BLUEPRINT_AREAS.forEach((area, i) => {
      quotas[area] = (i + run) % 4 < 2 ? 8 : 7;
    });
    const total = Object.values(quotas).reduce((a, b) => a + b, 0);
    if (total !== EXAM_SIZE) fail('blueprint', `run-${run}`, `quotas sum to ${total}, expected ${EXAM_SIZE}`);

    const picked = new Set();
    const counts = Object.fromEntries(BLUEPRINT_AREAS.map((a) => [a, 0]));
    for (const area of BLUEPRINT_AREAS) {
      const pool = pools[area];
      let cursor = (run * 37) % Math.max(pool.length, 1);
      for (let n = 0; n < quotas[area]; n += 1) {
        let guard = 0;
        while (guard < pool.length && picked.has(pool[cursor % pool.length].id)) {
          cursor += 1;
          guard += 1;
        }
        const q = pool[cursor % pool.length];
        if (!q || picked.has(q.id)) {
          fail('blueprint', `run-${run}`, `area "${area}" ran out of unrepeated questions`);
          break;
        }
        picked.add(q.id);
        counts[area] += 1;
        cursor += 1;
      }
    }
    if (picked.size !== EXAM_SIZE) {
      fail('blueprint', `run-${run}`, `sampled ${picked.size} unique questions, expected ${EXAM_SIZE}`);
    }
    for (const area of BLUEPRINT_AREAS) {
      if (Math.abs(counts[area] - 7.5) > 1.5) {
        fail('blueprint', `run-${run}`, `area "${area}" got ${counts[area]} questions, outside 7-8 (±1 of 30 × 25%)`);
      }
    }
    examRuns.push(counts);
  }
}

/* ------------------------------------------------------------------ *
 * 9. Corrections are disclosable
 * ------------------------------------------------------------------ */
{
  for (const c of corrections.corrections ?? []) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(c.effectiveDate ?? '')) {
      fail('corrections', c.id, 'needs a real effective date (YYYY-MM-DD), not a vague year');
    }
    if (!c.authority) fail('corrections', c.id, 'needs the public chapter / statute / policy that made the change');
    if (c.appliesToContent === true) {
      const used = questions.some((q) => q.correctionId === c.id);
      if (!used) {
        fail('corrections', c.id, 'is marked appliesToContent but no question carries it, so a learner would never see the disclosure');
      }
    }
  }
  for (const q of questions) {
    if (q.correctionId) {
      const c = (corrections.corrections ?? []).find((x) => x.id === q.correctionId);
      if (c && c.appliesToContent !== true) {
        fail('corrections', q.id, `carries correction "${q.correctionId}", which is not marked appliesToContent`);
      }
    }
  }
}

report();

/* ------------------------------------------------------------------ */
function report() {
  const summary = {
    ok: failures.length === 0,
    contentDir,
    questions: questions?.length ?? 0,
    official: questions?.filter?.((q) => q.official).length ?? 0,
    signs: signs?.length ?? 0,
    byArea,
    byTopic: byTopic ? Object.fromEntries([...byTopic].sort()) : {},
    threeOptionShare: questions?.length ? Number((threeOptionCount / questions.length).toFixed(4)) : 0,
    examRuns,
    failures,
    warnings,
  };

  if (jsonOut) {
    console.log(JSON.stringify(summary, null, 2));
    process.exit(failures.length === 0 ? 0 : 1);
  }

  console.log('Tennessee Class D content validation');
  console.log(`  content dir      ${contentDir}`);
  console.log(`  manual extract   ${extractPath}`);
  console.log('');
  console.log(`  questions        ${summary.questions} (floor ${MIN_QUESTIONS})`);
  console.log(`  official set     ${summary.official} of ${OFFICIAL_COUNT}`);
  console.log(`  signs            ${summary.signs} (floor ${MIN_SIGNS})`);
  console.log(`  3-option share   ${(summary.threeOptionShare * 100).toFixed(1)}% (floor ${MIN_THREE_OPTION_SHARE * 100}%)`);
  console.log('');
  console.log('  by blueprint area (floor 60 each)');
  for (const area of BLUEPRINT_AREAS) console.log(`    ${area.padEnd(16)} ${String(byArea[area] ?? 0).padStart(4)}`);
  console.log('');
  console.log(`  by topic (floor ${MIN_PER_TOPIC} each)`);
  for (const [t, n] of [...(byTopic ?? [])].sort()) console.log(`    ${t.padEnd(40)} ${String(n).padStart(4)}`);
  console.log('');
  console.log(`  ${EXAM_RUNS} simulated ${EXAM_SIZE}-question exams — per-area mix (target 7-8 each)`);
  for (const [i, counts] of examRuns.entries()) {
    console.log(`    exam ${String(i + 1).padStart(2)}  ${BLUEPRINT_AREAS.map((a) => `${a}=${counts[a]}`).join('  ')}`);
  }
  console.log('');

  if (failures.length === 0) {
    console.log(`PASS — ${summary.questions} questions, ${summary.signs} signs, 0 failures.`);
    process.exit(0);
  }

  console.log(`FAIL — ${failures.length} problem${failures.length === 1 ? '' : 's'}:`);
  for (const f of failures.slice(0, 60)) console.log(`  [${f.check}] ${f.id}: ${f.message}`);
  if (failures.length > 60) console.log(`  ... and ${failures.length - 60} more`);
  process.exit(1);
}
