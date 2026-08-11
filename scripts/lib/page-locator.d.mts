/** Type declarations for `page-locator.mjs` so TypeScript tests can import it. */
export declare function buildPageIndex(extractText: string): Map<number, string>;
export declare function locateQuote(
  pages: Map<number, string>,
  quote: string,
  pdfPage: number,
): { ok: boolean; how: 'exact' | 'straddle' | 'none' };
