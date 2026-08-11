/**
 * Content schema for the Tennessee Class D study bank.
 *
 * These are types only — no runtime code, no imports. The data lives in the
 * sibling JSON files and is validated by `npm run validate:content`
 * (`scripts/validate-content.mjs`), which is the authority on these invariants.
 */

/** The four areas the manual publishes for the knowledge test (PDF p.35, printed 21). */
export type BlueprintArea = 'signs' | 'safe-driving' | 'rules-of-road' | 'alcohol-drugs';

/**
 * Manual section a question is drawn from. The manual restricts the knowledge
 * test to sections B and C; section A (fees, document checklists, office
 * procedure) is out of the exam pool and is rejected by the validator.
 */
export type ManualSection = 'B' | 'C';

/**
 * A pointer into the manual.
 *
 * `pdfPage` is the `===== PAGE N =====` marker in
 * `docs/research/tn-dl-manual-extract.txt`; `printedPage` is the number printed
 * on the page itself (`printed = pdfPage - 14` for PDF pp.15–132). Both are
 * recorded because the manual's own cross-references use printed numbers.
 *
 * `quote` must appear verbatim in the extract after whitespace, quote and dash
 * normalization — see `scripts/lib/content-normalize.mjs`.
 */
export interface Citation {
  pdfPage: number;
  printedPage: number;
  quote: string;
  /** Rule id in `rules.json` this citation was carried from, when it came from one. */
  ruleId?: string;
}

/** A single testable rule lifted from the manual, with its verbatim support. */
export interface ManualRule {
  id: string;
  group: string;
  topic: string;
  rule: string;
  pdfPage: number;
  printedPage: number | null;
  quote: string;
  extraQuotes: string[];
}

/**
 * A post-2022 correction from `docs/research/live-facts.md` that the UI must
 * disclose to the learner rather than apply silently.
 */
export interface Correction {
  id: string;
  /** What the learner sees, in one sentence. */
  summary: string;
  /** What the 2022 manual says, or `null` when the manual says nothing at all. */
  manualStates: string | null;
  /** What is true now. */
  currentlyTrue: string;
  /** ISO date the change took effect. */
  effectiveDate: string;
  /** Public Chapter / bill / rule that made the change. */
  authority: string;
  sourceUrl: string;
  confidence: 'high' | 'medium-high';
  /** Whether any question in the bank teaches content touched by this correction. */
  appliesToContent: boolean;
  note?: string;
}

export interface QuestionOption {
  /** Stable per-question letter, matching the manual's A/B/C format. */
  letter: string;
  text: string;
}

export interface Question {
  id: string;
  topic: string;
  area: BlueprintArea;
  section: ManualSection;
  stem: string;
  options: QuestionOption[];
  /** Index into `options`. Exactly one correct answer per question. */
  correctIndex: number;
  /** The correct option's text, duplicated for readability in review. */
  correctOption: string;
  /** Plain-language teaching, not a restatement of the option. */
  explanation: string;
  citations: Citation[];
  /** Sign registry ids this question depends on; must exist in `signs.json`. */
  signs?: string[];
  /** `true` only for the 27 questions authored by the State of Tennessee. */
  official: boolean;
  /** Present when the manual's text is superseded; keyed to `corrections.json`. */
  correctionId?: string;
  /** For official questions: the printed page the manual's answer key points at. */
  manualAnswerPointer?: { printedPage: number; pdfPage: number };
  /**
   * Set on the one official question ("The sign at the right means:") whose
   * artwork is missing from the PDF text layer, explaining how the app supplies
   * its own rendered sign instead. See `signs` for the entry it pairs with.
   */
  artworkNote?: string;
  /** Set where the manual's own answer pointer is off by a page. */
  pointerNote?: string;
  /** Authoring file this question was built from, for provenance during review. */
  sourceFile: string;
}

export interface QuestionBank {
  schemaVersion: number;
  generatedAt: string;
  counts: {
    total: number;
    official: number;
    byArea: Record<BlueprintArea, number>;
    byTopic: Record<string, number>;
    byOptionCount: Record<string, number>;
  };
  questions: Question[];
}

export interface TopicDefinition {
  id: string;
  area: BlueprintArea;
  label: string;
  manualChapter: string;
  blurb: string;
}

export interface Taxonomy {
  note: string;
  blueprint: {
    source: { pdfPage: number; printedPage: number };
    quote: string;
    areas: { id: BlueprintArea; label: string; share: number }[];
  };
  topics: TopicDefinition[];
}

export type SignCategory =
  | 'regulatory'
  | 'warning'
  | 'school'
  | 'work-zone'
  | 'railroad'
  | 'guide'
  | 'service';

export type SignShape =
  | 'octagon'
  | 'triangle-down'
  | 'circle'
  | 'crossbuck'
  | 'diamond'
  | 'rectangle-horizontal'
  | 'rectangle-vertical'
  | 'square'
  | 'pennant'
  | 'pentagon'
  | 'shield'
  | 'trapezoid';

export interface SignEntry {
  id: string;
  /** MUTCD 2009 Edition sign designation, e.g. `R1-1`, `W10-1`. Required. */
  mutcd: string;
  name: string;
  category: SignCategory;
  shape: SignShape;
  /** Background color of the sign face, lowercase palette token. */
  faceColor: string;
  /** Color of the legend (text, symbol, border) carried on the face. */
  legendColor: string;
  /** Extra declared colors used in the face (e.g. a red circle-and-slash). */
  accentColors?: string[];
  /** What the sign means, in plain language. */
  meaning: string;
  citation: Citation;
  /**
   * Set when the manual gives only a picture caption and the meaning had to
   * come from the MUTCD. Never invented.
   */
  meaningSource?: { kind: 'mutcd'; reference: string; note: string };
}

export interface SignRegistry {
  schemaVersion: number;
  note: string;
  palette: string[];
  signs: SignEntry[];
}

export interface NeverGenerateEntry {
  id: string;
  reason: string;
  source: string;
  bannedRuleIds?: string[];
  bannedQuoteSubstrings?: string[];
  bannedPatterns?: { allOf: string[]; flags?: string }[];
}
