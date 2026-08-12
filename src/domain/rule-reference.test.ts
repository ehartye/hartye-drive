import { describe, expect, it } from 'vitest';
import { buildRuleReference, recallLabel, recallOf } from './rule-reference';
import type { QuestionLike, RuleLike } from './rule-reference';
import { newCard, reviewCard } from './scheduler';

const rule = (id: string, over: Partial<RuleLike> = {}): RuleLike => ({
  id,
  group: 'Following, braking and required stops',
  topic: 'Railroad stop distance',
  rule: 'You must stop between fifteen and fifty feet from the nearest rail.',
  pdfPage: 55,
  printedPage: 41,
  quote: 'not less than fifteen (15) feet and not more than fifty (50) feet from the nearest rail',
  extraQuotes: [],
  ...over,
});

const question = (id: string, over: Partial<QuestionLike> = {}): QuestionLike => ({
  id,
  topic: 'required-stops',
  stem: `Stem ${id}`,
  citations: [{ ruleId: 'R225' }],
  ...over,
});

const RULES = [
  rule('R225'),
  rule('R226', { topic: 'Railroad signal devices', rule: 'Obey the flashing signals.' }),
  rule('R400', { topic: 'Somewhere else', group: 'Right-of-way' }),
];

describe('recallOf', () => {
  it('is “unseen” with no card — the honest reading of a question never asked', () => {
    expect(recallOf(undefined)).toBe('unseen');
    expect(recallLabel('unseen', 0)).toBe('Not seen yet');
  });

  it('is “missed” while the last answer was wrong, and counts the misses', () => {
    const card = reviewCard(newCard('q1', 't', 0), false, 0);
    expect(recallOf(card)).toBe('missed');
    expect(recallLabel('missed', card.lapses)).toBe('Missed once');
    const twice = reviewCard(reviewCard(card, true, 1), false, 2);
    expect(recallLabel('missed', twice.lapses)).toBe('Missed twice');
  });

  it('names larger miss counts numerically rather than inventing more words', () => {
    expect(recallLabel('missed', 5)).toBe('Missed 5 times');
  });

  it('is “right” once the last answer was correct, whatever came before', () => {
    const card = reviewCard(reviewCard(newCard('q1', 't', 0), false, 0), true, 1);
    expect(recallOf(card)).toBe('right');
    expect(recallLabel('right', 1)).toBe('Correct last time');
  });
});

describe('buildRuleReference', () => {
  it('returns null for a rule id that does not exist, so the route can say so', () => {
    expect(buildRuleReference({ ruleId: 'R999', rules: RULES, questions: [], cards: {} })).toBeNull();
  });

  it('carries the rule, its verbatim quote and both page numbers', () => {
    const ref = buildRuleReference({ ruleId: 'R225', rules: RULES, questions: [], cards: {} });
    expect(ref?.rule.rule).toContain('fifteen and fifty feet');
    expect(ref?.quotes).toEqual([RULES[0]?.quote]);
    expect(ref?.rule.pdfPage).toBe(55);
    expect(ref?.rule.printedPage).toBe(41);
  });

  it('includes the rule’s extra quotes, in order, without duplicating the first', () => {
    const ref = buildRuleReference({
      ruleId: 'R225',
      rules: [rule('R225', { extraQuotes: ['a second sentence', 'a third'] })],
      questions: [],
      cards: {},
    });
    expect(ref?.quotes).toHaveLength(3);
    expect(ref?.quotes[1]).toBe('a second sentence');
  });

  it('lists the questions that cite it, with how the learner has done on each', () => {
    const cards = {
      q2: reviewCard(newCard('q2', 'required-stops', 0), false, 0),
    };
    const ref = buildRuleReference({
      ruleId: 'R225',
      rules: RULES,
      questions: [question('q1'), question('q2'), question('q3', { citations: [{ ruleId: 'R226' }] })],
      cards,
    });
    expect(ref?.questions.map((q) => q.id)).toEqual(['q2', 'q1']);
    expect(ref?.questions[0]).toMatchObject({ recall: 'missed', recallLabel: 'Missed once' });
    expect(ref?.questions[1]?.recall).toBe('unseen');
  });

  it('gathers the signs those questions depend on, de-duplicated', () => {
    const ref = buildRuleReference({
      ruleId: 'R225',
      rules: RULES,
      questions: [
        question('q1', { signs: ['w10-1-rr-advance', 'r15-1-crossbuck'] }),
        question('q2', { signs: ['r15-1-crossbuck'] }),
      ],
      cards: {},
    });
    expect(ref?.signIds).toEqual(['w10-1-rr-advance', 'r15-1-crossbuck']);
  });

  it('names the topic the rule is taught under, so “practice this topic” has somewhere to go', () => {
    const ref = buildRuleReference({
      ruleId: 'R225',
      rules: RULES,
      questions: [question('q1'), question('q2', { topic: 'right-of-way' }), question('q3')],
      cards: {},
    });
    expect(ref?.primaryTopic).toBe('required-stops');
    expect(ref?.practiceQuestionIds).toEqual(['q1', 'q3']);
  });

  it('has no topic when nothing cites it — a rule may be true and untested', () => {
    const ref = buildRuleReference({ ruleId: 'R225', rules: RULES, questions: [], cards: {} });
    expect(ref?.primaryTopic).toBeNull();
    expect(ref?.practiceQuestionIds).toEqual([]);
    expect(ref?.siblingRuleIds).toEqual([]);
  });

  it('offers the other rules the same topic is built on, never itself', () => {
    const ref = buildRuleReference({
      ruleId: 'R225',
      rules: RULES,
      questions: [
        question('q1'),
        question('q2', { citations: [{ ruleId: 'R226' }] }),
        question('q3', { citations: [{ ruleId: 'R400' }], topic: 'right-of-way' }),
      ],
      cards: {},
    });
    expect(ref?.siblingRuleIds).toEqual(['R226']);
  });

  it('surfaces every correction the citing questions carry, so none is applied silently', () => {
    const ref = buildRuleReference({
      ruleId: 'R225',
      rules: RULES,
      questions: [
        question('q1', { correctionId: 'move-over-any-hazard-lights' }),
        question('q2', { correctionId: 'move-over-any-hazard-lights' }),
      ],
      cards: {},
    });
    expect(ref?.correctionIds).toEqual(['move-over-any-hazard-lights']);
  });

  it('caps the lists so a heavily cited rule does not render an unreadable page', () => {
    const many = Array.from({ length: 40 }, (_, i) => question(`q${String(i)}`));
    const ref = buildRuleReference({ ruleId: 'R225', rules: RULES, questions: many, cards: {} });
    expect(ref?.questions.length).toBeLessThanOrEqual(12);
    // The full count is still reported, so the page can say what it is showing.
    expect(ref?.questionCount).toBe(40);
  });
});
