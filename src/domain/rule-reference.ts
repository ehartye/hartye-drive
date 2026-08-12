/**
 * The rule reference — what a citation resolves to.
 *
 * Every explanation in this product ends in a citation, and a citation that
 * cannot be followed is a footnote, not a source. This module assembles the
 * page behind one: the manual rule itself, its verbatim words, the questions
 * built on it, the signs those questions depend on, the rest of the topic, and
 * any post-2022 correction that touches it.
 *
 * The linkage is entirely derived from the content bank as authored. Questions
 * carry `citations[].ruleId`; signs do not carry a rule at all, so the signs on
 * this page are the ones the citing questions themselves depend on — a real
 * relationship rather than a guessed one.
 *
 * Structural input types, not the content bank's own: the domain stays loadable
 * without importing ~570 KB of JSON, and these tests run with fixtures.
 */
import type { CardState } from './scheduler';

export interface RuleLike {
  id: string;
  group: string;
  topic: string;
  rule: string;
  pdfPage: number;
  printedPage: number | null;
  quote: string;
  extraQuotes: readonly string[];
}

export interface QuestionLike {
  id: string;
  topic: string;
  stem: string;
  citations: readonly { ruleId?: string }[];
  signs?: readonly string[];
  correctionId?: string;
}

export type Recall = 'unseen' | 'missed' | 'right';

/** Enough rows to be useful, few enough to read without scrolling past the rule. */
const MAX_QUESTIONS = 12;
const MAX_SIGNS = 6;
const MAX_SIBLINGS = 8;

const COUNT_WORDS = ['no', 'once', 'twice'] as const;

export function recallOf(card: CardState | undefined): Recall {
  if (!card || card.seen === 0) return 'unseen';
  return card.streak > 0 ? 'right' : 'missed';
}

/** The state in words. Colour never carries this on its own (§5, practices A3). */
export function recallLabel(recall: Recall, misses: number): string {
  switch (recall) {
    case 'unseen':
      return 'Not seen yet';
    case 'right':
      return 'Correct last time';
    case 'missed':
      return `Missed ${COUNT_WORDS[misses] ?? `${String(misses)} times`}`;
  }
}

export interface RelatedQuestion {
  id: string;
  stem: string;
  topic: string;
  recall: Recall;
  misses: number;
  recallLabel: string;
}

export interface RuleReference {
  rule: RuleLike;
  /** The rule's own quote first, then any supporting ones, in authored order. */
  quotes: string[];
  questions: RelatedQuestion[];
  /** How many questions cite it in total, which may exceed the rows shown. */
  questionCount: number;
  signIds: string[];
  /**
   * `true` when the signs came from the questions citing *this* rule; `false`
   * when they were borrowed from the rest of the topic. Most rules are prose
   * with no sign attached, and the page has to say which it is showing.
   */
  signsAreDirect: boolean;
  /** The taxonomy topic most of the citing questions belong to. */
  primaryTopic: string | null;
  /** Every question in that topic — what "practice this topic" actually runs. */
  practiceQuestionIds: string[];
  /** Other rules the same topic is built on. */
  siblingRuleIds: string[];
  correctionIds: string[];
}

export interface RuleReferenceInput {
  ruleId: string;
  rules: readonly RuleLike[];
  questions: readonly QuestionLike[];
  cards: Readonly<Record<string, CardState>>;
}

const citesRule = (question: QuestionLike, ruleId: string): boolean =>
  question.citations.some((citation) => citation.ruleId === ruleId);

/** Unseen first, then the ones being missed, then the ones going well. */
const RECALL_ORDER: Record<Recall, number> = { missed: 0, unseen: 1, right: 2 };

export function buildRuleReference(input: RuleReferenceInput): RuleReference | null {
  const rule = input.rules.find((candidate) => candidate.id === input.ruleId);
  if (!rule) return null;

  const citing = input.questions.filter((question) => citesRule(question, rule.id));

  const related: RelatedQuestion[] = citing.map((question) => {
    const card = input.cards[question.id];
    const recall = recallOf(card);
    const misses = card?.lapses ?? 0;
    return {
      id: question.id,
      stem: question.stem,
      topic: question.topic,
      recall,
      misses,
      recallLabel: recallLabel(recall, misses),
    };
  });

  related.sort((a, b) =>
    RECALL_ORDER[a.recall] !== RECALL_ORDER[b.recall]
      ? RECALL_ORDER[a.recall] - RECALL_ORDER[b.recall]
      : a.id < b.id
        ? -1
        : 1,
  );

  /* The topic the rule is taught under: whichever the citing questions mostly
     belong to. Ties fall to the first in authored order, which is the bank's
     own sequence rather than an alphabetical accident. */
  const topicCounts = new Map<string, number>();
  for (const question of citing) {
    topicCounts.set(question.topic, (topicCounts.get(question.topic) ?? 0) + 1);
  }
  let primaryTopic: string | null = null;
  let best = 0;
  for (const [topic, count] of topicCounts) {
    if (count > best) {
      primaryTopic = topic;
      best = count;
    }
  }

  const inTopic =
    primaryTopic === null
      ? []
      : input.questions.filter((question) => question.topic === primaryTopic);

  const siblings: string[] = [];
  for (const question of inTopic) {
    for (const citation of question.citations) {
      const id = citation.ruleId;
      if (id === undefined || id === rule.id || siblings.includes(id)) continue;
      if (!input.rules.some((candidate) => candidate.id === id)) continue;
      siblings.push(id);
    }
  }

  const collectSigns = (from: readonly QuestionLike[]): string[] => {
    const ids: string[] = [];
    for (const question of from) {
      for (const signId of question.signs ?? []) {
        if (!ids.includes(signId)) ids.push(signId);
      }
    }
    return ids;
  };

  const direct = collectSigns(citing);
  const signIds = direct.length > 0 ? direct : collectSigns(inTopic);

  const correctionIds: string[] = [];
  for (const question of citing) {
    const id = question.correctionId;
    if (id !== undefined && !correctionIds.includes(id)) correctionIds.push(id);
  }

  return {
    rule,
    quotes: [rule.quote, ...rule.extraQuotes],
    questions: related.slice(0, MAX_QUESTIONS),
    questionCount: related.length,
    signIds: signIds.slice(0, MAX_SIGNS),
    signsAreDirect: direct.length > 0,
    primaryTopic,
    practiceQuestionIds: inTopic.map((question) => question.id),
    siblingRuleIds: siblings.slice(0, MAX_SIBLINGS),
    correctionIds,
  };
}
