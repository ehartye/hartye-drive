/** Type declarations for `citation-support.mjs` so TypeScript tests can import it. */
export interface CitationSupportProblem {
  code: 'numeric-contradiction' | 'no-keyed-support' | 'distractor-dominant';
  message: string;
}

export interface CitationSupportScore {
  id?: string;
  keyedOverlap: number;
  maxDistractorOverlap: number;
  keyedDistinctive: number;
  combination: boolean;
  negatedStem: boolean;
  problems: CitationSupportProblem[];
}

export declare function distinctiveTokens(text: string): Set<string>;
export declare function related(a: string, b: string): boolean;
export declare function numbersIn(text: string): Set<string>;
export declare function scoreCitationSupport(question: {
  stem: string;
  options: { text: string }[];
  correctIndex: number;
  citations: { quote: string }[];
}): CitationSupportScore;
