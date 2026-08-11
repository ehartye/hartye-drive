/**
 * Tests for the content validator and the shipped question bank.
 *
 * The point of these is not that the validator runs — it is that the validator
 * *fails* when the content is wrong. A gate nobody has watched fail is not a
 * gate. `tests/fixtures/broken-content/` is a bank with one deliberate defect
 * per question, and the suite asserts each defect is caught by name.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { normalizeForMatch, quoteAppearsIn } from '../../scripts/lib/content-normalize.mjs';
import { buildPageIndex, locateQuote } from '../../scripts/lib/page-locator.mjs';
import { scoreCitationSupport } from '../../scripts/lib/citation-support.mjs';
import type {
  Correction,
  NeverGenerateEntry,
  QuestionBank,
  SignRegistry,
  Taxonomy,
} from './types';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(join(root, relativePath), 'utf8')) as T;
}

const extract = readFileSync(join(root, 'docs/research/tn-dl-manual-extract.txt'), 'utf8');
const normalizedExtract = normalizeForMatch(extract);
const bank = readJson<QuestionBank>('src/content/questions.json');
const taxonomy = readJson<Taxonomy>('src/content/taxonomy.json');
const registry = readJson<SignRegistry>('src/content/signs.json');
const neverGenerate = readJson<{ entries: NeverGenerateEntry[] }>('src/content/never-generate.json').entries;
const corrections = readJson<{ corrections: Correction[] }>('src/content/corrections.json').corrections;

interface ValidatorFailure {
  check: string;
  id: string;
  message: string;
}

interface ValidatorSummary {
  ok: boolean;
  questions: number;
  signs: number;
  failures: ValidatorFailure[];
}

function runValidator(contentDir?: string): { status: number; summary: ValidatorSummary } {
  const args = [join(root, 'scripts/validate-content.mjs'), '--json'];
  if (contentDir) args.push('--content-dir', join(root, contentDir));
  try {
    const stdout = execFileSync(process.execPath, args, { encoding: 'utf8' });
    return { status: 0, summary: JSON.parse(stdout) as ValidatorSummary };
  } catch (err) {
    const failure = err as { status: number; stdout: string };
    return { status: failure.status, summary: JSON.parse(failure.stdout) as ValidatorSummary };
  }
}

describe('normalizeForMatch', () => {
  it('collapses every run of whitespace, including newlines, to one space', () => {
    expect(normalizeForMatch('a\n  b\t\tc\r\nd')).toBe('a b c d');
  });

  it('normalizes curly quotes and apostrophes to ASCII', () => {
    expect(normalizeForMatch('“GDL” and it’s')).toBe('"GDL" and it\'s');
  });

  it('normalizes en and em dashes to ASCII hyphens', () => {
    expect(normalizeForMatch('signals—25% – yes')).toBe('signals-25% - yes');
  });

  it('is case sensitive, so a paraphrase in different case does not slip through', () => {
    const source = normalizeForMatch('NEVER OUTRUN YOUR HEADLIGHTS');
    expect(quoteAppearsIn('never outrun your headlights', source)).toBe(false);
    expect(quoteAppearsIn('NEVER OUTRUN YOUR HEADLIGHTS', source)).toBe(true);
  });
});

describe('the line-spanning quote rule', () => {
  // This sentence is broken across five lines in the extract (PDF p.88). It is
  // the reason naive substring matching cannot be used.
  const lineSpanning =
    'Driving at night is considerably more hazardous and difficult than daytime driving because your range of visibility is limited by your headlights.';

  it('is present in the raw extract only as broken lines, so a naive search misses it', () => {
    expect(extract.includes(lineSpanning)).toBe(false);
    expect(extract.includes('considerably more\nhazardous')).toBe(true);
  });

  it('matches once both sides are normalized', () => {
    expect(quoteAppearsIn(lineSpanning, normalizedExtract)).toBe(true);
  });

  it('is the quote actually shipped on official question 19', () => {
    const question = bank.questions.find((q) => q.id === 'official-19');
    expect(question?.citations.some((c) => c.quote === lineSpanning)).toBe(true);
  });

  it('also matches a quote whose curly-quoted word is split across lines', () => {
    const spansQuotes =
      'A license issued under the first three steps will have "GDL" printed in the bottom left corner.';
    expect(extract.includes(spansQuotes)).toBe(false);
    expect(quoteAppearsIn(spansQuotes, normalizedExtract)).toBe(true);
  });
});

describe('validate-content on the shipped bank', () => {
  const run = runValidator();

  it('exits 0 with no failures', () => {
    expect(run.summary.failures).toEqual([]);
    expect(run.status).toBe(0);
  });

  it('meets the volume floors', () => {
    expect(run.summary.questions).toBeGreaterThanOrEqual(300);
    expect(run.summary.signs).toBeGreaterThanOrEqual(80);
  });
});

describe('validate-content on a deliberately broken fixture', () => {
  const run = runValidator('tests/fixtures/broken-content');
  const failed = (check: string, id: string) =>
    run.summary.failures.some((f) => f.check === check && f.id === id);

  it('exits non-zero', () => {
    expect(run.status).toBe(1);
    expect(run.summary.ok).toBe(false);
  });

  it('catches a fabricated quote that appears nowhere in the manual', () => {
    expect(failed('citation', 'broken-fabricated-quote')).toBe(true);
  });

  it('catches a question with no citation at all', () => {
    expect(failed('citation', 'broken-no-citation')).toBe(true);
  });

  it('catches duplicate choice text', () => {
    expect(failed('options', 'broken-duplicate-option')).toBe(true);
  });

  it('catches a keyed answer that is not a valid option', () => {
    expect(failed('answer', 'broken-answer-index')).toBe(true);
  });

  it('catches a question tagged to a never-generate rule', () => {
    expect(failed('never-generate', 'broken-banned-rule')).toBe(true);
  });

  it('catches content sourced from Section A', () => {
    expect(failed('section', 'broken-section-a')).toBe(true);
  });

  it('catches a topic that is not in the taxonomy', () => {
    expect(failed('topic', 'broken-unknown-topic')).toBe(true);
  });

  it('catches a reference to a sign that is not in the registry', () => {
    expect(failed('signs', 'broken-unknown-sign')).toBe(true);
  });

  it('catches a printed page that does not follow printed = pdf - 14', () => {
    expect(failed('citation', 'broken-printed-page')).toBe(true);
  });

  it('catches duplicate question ids', () => {
    expect(failed('ids', 'broken-printed-page')).toBe(true);
  });

  it('catches a missing official sample question set', () => {
    expect(failed('official', 'set')).toBe(true);
  });

  it('catches a sign with no MUTCD designation', () => {
    expect(run.summary.failures.some((f) => f.check === 'signs' && /MUTCD/.test(f.message))).toBe(true);
  });

  it('catches the volume floors', () => {
    expect(failed('volume', 'questions')).toBe(true);
    expect(failed('volume', 'topics')).toBe(true);
  });

  const supportProblem = (id: string, code: string) =>
    run.summary.failures.some((f) => f.check === 'support' && f.id === id && f.message.startsWith(code));

  it('catches a citation whose quote contradicts the keyed answer', () => {
    // Real, verbatim, on the cited page — but it is the opposite branch of the
    // rule, so it argues for a distractor.
    expect(supportProblem('broken-key-quote-contradiction', 'no-keyed-support')).toBe(true);
    expect(supportProblem('broken-key-quote-contradiction', 'distractor-dominant')).toBe(true);
  });

  it('catches a numeric keyed answer that the quote contradicts', () => {
    expect(supportProblem('broken-numeric-key', 'numeric-contradiction')).toBe(true);
  });

  it('catches a quote that supports a distractor more than the key', () => {
    expect(supportProblem('broken-distractor-dominant', 'distractor-dominant')).toBe(true);
  });

  it('catches a citation that is one page early', () => {
    expect(
      run.summary.failures.some(
        (f) => f.check === 'citation' && f.id === 'broken-off-by-one-page' && /does not appear on PDF page 126/.test(f.message),
      ),
    ).toBe(true);
  });
});

describe('page-exact quote lookup', () => {
  const synthetic = [
    '===== PAGE 40 =====',
    'Alpha beta gamma. A sentence that begins on this page and',
    '',
    '===== PAGE 41 =====',
    '27',
    'delta epsilon. Wholly on the next page.',
    '',
  ].join('\n');
  const pages = buildPageIndex(synthetic);

  it('accepts a quote that is on the page the citation names', () => {
    expect(locateQuote(pages, 'Alpha beta gamma.', 40)).toEqual({ ok: true, how: 'exact' });
  });

  it('rejects a quote that lives entirely on the NEXT page — the off-by-one bug', () => {
    expect(locateQuote(pages, 'Wholly on the next page.', 40).ok).toBe(false);
    expect(locateQuote(pages, 'Wholly on the next page.', 41)).toEqual({ ok: true, how: 'exact' });
  });

  it('admits, as the one exception, a sentence that genuinely straddles the boundary', () => {
    const straddle = 'A sentence that begins on this page and 27 delta epsilon.';
    expect(pages.get(40)!.includes(straddle)).toBe(false);
    expect(pages.get(41)!.includes(straddle)).toBe(false);
    expect(locateQuote(pages, straddle, 40)).toEqual({ ok: true, how: 'straddle' });
  });

  it('rejects a quote found nowhere on either page', () => {
    expect(locateQuote(pages, 'omega omega omega', 40)).toEqual({ ok: false, how: 'none' });
  });

  it('holds every shipped citation to the page it names', () => {
    const realPages = buildPageIndex(extract);
    const offPage = bank.questions.flatMap((q) =>
      q.citations
        .filter((c) => !locateQuote(realPages, c.quote, c.pdfPage).ok)
        .map((c) => `${q.id} p${c.pdfPage}`),
    );
    expect(offPage).toEqual([]);
    const offPageSigns = registry.signs
      .filter((s) => !locateQuote(realPages, s.citation.quote, s.citation.pdfPage).ok)
      .map((s) => s.id);
    expect(offPageSigns).toEqual([]);
  });
});

describe('citations must support the keyed answer, not just exist', () => {
  it('flags a numeric key the quote contradicts', () => {
    const score = scoreCitationSupport({
      stem: 'How many points does contributing to a crash that causes bodily injury add to your record?',
      options: [{ text: '4 points' }, { text: '1 point' }, { text: '8 points' }],
      correctIndex: 0,
      citations: [{ quote: '8 Contributing to occurrence of a crash resulting in the death of another person' }],
    });
    expect(score.problems.map((p) => p.code)).toContain('numeric-contradiction');
  });

  it('passes the same question once the citation names the right row', () => {
    const score = scoreCitationSupport({
      stem: 'How many points does contributing to a crash that causes bodily injury add to your record?',
      options: [{ text: '4 points' }, { text: '1 point' }, { text: '8 points' }],
      correctIndex: 0,
      citations: [{ quote: '4 Contributing to a crash resulting in bodily injury' }],
    });
    expect(score.problems).toEqual([]);
  });

  it('exempts combination options, which carry no evidence of their own', () => {
    const score = scoreCitationSupport({
      stem: 'Interstate driving demands require the driver to:',
      options: [
        { text: 'Have a complete awareness of higher speed driving' },
        { text: 'Constant alertness by the driver' },
        { text: 'Both of the above.' },
      ],
      correctIndex: 2,
      citations: [
        {
          quote:
            'Safe use of the interstates demands a complete awareness of a higher speed type of driving and constant alertness by the driver.',
        },
      ],
    });
    expect(score.combination).toBe(true);
    expect(score.problems).toEqual([]);
  });

  it('exempts a negated stem from the dominance rule, where the quote is meant to name the distractors', () => {
    const score = scoreCitationSupport({
      stem: 'Which type of insurance is NOT required by Tennessee law?',
      options: [
        { text: 'Collision insurance' },
        { text: 'Liability coverage or other evidence of financial responsibility' },
        { text: 'None — all coverage types are required' },
      ],
      correctIndex: 0,
      citations: [
        {
          quote:
            'Although collision insurance is not required by Tennessee law, the Financial Responsibility Law requires drivers to produce evidence of financial responsibility.',
        },
      ],
    });
    expect(score.negatedStem).toBe(true);
    expect(score.problems).toEqual([]);
  });

  it('holds for every question in the shipped bank', () => {
    const flagged = bank.questions
      .map((q) => ({ id: q.id, problems: scoreCitationSupport(q).problems }))
      .filter((r) => r.problems.length > 0)
      .map((r) => `${r.id}: ${r.problems[0]!.code}`);
    expect(flagged).toEqual([]);
  });
});

describe('the question bank itself', () => {
  it('carries every citation quote verbatim in the manual extract', () => {
    const bad = bank.questions.flatMap((q) =>
      q.citations
        .filter((c) => !quoteAppearsIn(c.quote, normalizedExtract))
        .map((c) => `${q.id}: ${c.quote.slice(0, 60)}`),
    );
    expect(bad).toEqual([]);
  });

  it('records both the PDF page and the printed page on every citation', () => {
    for (const q of bank.questions) {
      for (const c of q.citations) {
        expect(c.printedPage).toBe(c.pdfPage >= 15 && c.pdfPage <= 132 ? c.pdfPage - 14 : null);
      }
    }
  });

  it('draws only from Sections B and C', () => {
    expect(bank.questions.every((q) => q.section === 'B' || q.section === 'C')).toBe(true);
  });

  it('has exactly one keyed answer per question, matching the option text', () => {
    for (const q of bank.questions) {
      expect(q.options[q.correctIndex]!.text).toBe(q.correctOption);
      expect(q.options.filter((o) => o.text === q.correctOption)).toHaveLength(1);
    }
  });

  it('uses the real three-option format for at least 80% of questions', () => {
    const three = bank.questions.filter((q) => q.options.length === 3).length;
    expect(three / bank.questions.length).toBeGreaterThanOrEqual(0.8);
    expect(bank.questions.every((q) => q.options.length >= 2 && q.options.length <= 4)).toBe(true);
  });

  it('ships the 27 official sample questions, flagged and pointed at the manual answer key', () => {
    const official = bank.questions.filter((q) => q.official);
    expect(official).toHaveLength(27);
    expect(official.every((q) => (q.manualAnswerPointer?.printedPage ?? 0) > 0)).toBe(true);
  });

  it('does not inherit the manual\'s "both of the above" tell into generated questions', () => {
    const combination = /both of the above|all of the above|both a and|a & b/i;
    const generatedWithCombination = bank.questions.filter(
      (q) => !q.official && q.options.some((o) => combination.test(o.text)),
    );
    expect(generatedWithCombination).toEqual([]);
  });

  it('spreads the correct answer across every option position', () => {
    const generated = bank.questions.filter((q) => !q.official);
    const counts = new Map<number, number>();
    for (const q of generated) counts.set(q.correctIndex, (counts.get(q.correctIndex) ?? 0) + 1);
    // No single position may hold more than half the answers.
    for (const n of counts.values()) expect(n).toBeLessThan(generated.length * 0.5);
  });

  it('maps every topic to a blueprint area and every area to a real one', () => {
    const topicAreas = new Map(taxonomy.topics.map((t) => [t.id, t.area]));
    const areas = new Set(['signs', 'safe-driving', 'rules-of-road', 'alcohol-drugs']);
    for (const q of bank.questions) {
      expect(topicAreas.get(q.topic)).toBe(q.area);
      expect(areas.has(q.area)).toBe(true);
    }
  });
});

describe('the never-generate list', () => {
  const ids = new Set(neverGenerate.map((e) => e.id));

  it('contains every contradiction the bar names', () => {
    for (const required of [
      'move-over-lane-threshold',
      'license-renewal-cycle',
      'temporary-driver-license-fees',
      'gdl-fee-figures',
      'back-seat-belt-age-17',
      'bicyclists-may-disregard-signals',
    ]) {
      expect(ids.has(required)).toBe(true);
    }
  });

  it('gives every entry a reason and a source', () => {
    for (const entry of neverGenerate) {
      expect(entry.reason.length).toBeGreaterThan(30);
      expect(entry.source).toBeTruthy();
    }
  });

  it('is not violated by any shipped question', () => {
    const bannedRules = new Set(neverGenerate.flatMap((e) => e.bannedRuleIds ?? []));
    for (const q of bank.questions) {
      for (const c of q.citations) {
        expect(c.ruleId !== undefined && bannedRules.has(c.ruleId)).toBe(false);
      }
    }
  });

  it('never teaches the age-17 back-seat-belt case the manual leaves undefined', () => {
    const seventeen = /\b17[ -]year[ -]old|\bage(d)? 17\b/i;
    const backSeat = /back ?seat|rear seat/i;
    for (const q of bank.questions) {
      const blob = [q.stem, q.explanation, ...q.options.map((o) => o.text)].join(' ');
      expect(seventeen.test(blob) && backSeat.test(blob)).toBe(false);
    }
  });
});

describe('post-2022 corrections', () => {
  it('carries a real effective date and a naming authority for each', () => {
    for (const c of corrections) {
      expect(c.effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(c.authority.length).toBeGreaterThan(5);
    }
  });

  it('is disclosed on at least one question wherever it touches taught content', () => {
    for (const c of corrections.filter((x) => x.appliesToContent)) {
      expect(bank.questions.some((q) => q.correctionId === c.id)).toBe(true);
    }
  });

  it('states plainly where the manual says nothing, so an absence is never "corrected"', () => {
    const insurance = corrections.find((c) => c.id === 'minimum-liability-insurance');
    expect(insurance?.manualStates).toBeNull();
    expect(insurance?.appliesToContent).toBe(false);
  });
});

describe('the sign registry', () => {
  it('has at least 80 signs, each with a MUTCD designation', () => {
    expect(registry.signs.length).toBeGreaterThanOrEqual(80);
    for (const s of registry.signs) expect(s.mutcd).toMatch(/^[A-Z]{1,3}-?\d/);
  });

  it('gives every sign a category, shape, face and legend color, and a meaning', () => {
    for (const s of registry.signs) {
      expect(s.category).toBeTruthy();
      expect(s.shape).toBeTruthy();
      expect(s.faceColor).toBeTruthy();
      expect(s.legendColor).toBeTruthy();
      expect(s.meaning.length).toBeGreaterThan(15);
    }
  });

  it('backs every sign with a verbatim manual citation', () => {
    const bad = registry.signs
      .filter((s) => !quoteAppearsIn(s.citation.quote, normalizedExtract))
      .map((s) => s.id);
    expect(bad).toEqual([]);
  });

  it('cites the MUTCD by reference wherever the manual gives only a caption', () => {
    for (const s of registry.signs.filter((x) => x.meaningSource)) {
      expect(s.meaningSource?.kind).toBe('mutcd');
      expect(s.meaningSource?.reference).toMatch(/MUTCD/);
    }
  });

  it('uses only colors from the declared palette', () => {
    const palette = new Set(registry.palette);
    for (const s of registry.signs) {
      for (const color of [s.faceColor, s.legendColor, ...(s.accentColors ?? [])]) {
        expect(palette.has(color)).toBe(true);
      }
    }
  });

  it('is referenced only by ids that exist, wherever a question names a sign', () => {
    const ids = new Set(registry.signs.map((s) => s.id));
    for (const q of bank.questions) {
      for (const signId of q.signs ?? []) expect(ids.has(signId)).toBe(true);
    }
  });
});
