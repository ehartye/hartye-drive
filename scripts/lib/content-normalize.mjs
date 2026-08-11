/**
 * Shared text normalization for content validation.
 *
 * The manual extract (`docs/research/tn-dl-manual-extract.txt`) preserves the
 * PDF's hard line breaks, so a quote that spans two printed lines will never be
 * found by a naive substring search. Both the quote and the source text are put
 * through `normalizeForMatch` before matching:
 *
 *   1. typographic quotes/apostrophes -> ASCII ' and "
 *   2. en/em/figure dashes and minus signs -> ASCII -
 *   3. ellipsis character -> three periods
 *   4. non-breaking / zero-width spaces -> ordinary space
 *   5. every run of whitespace (including newlines) -> a single space
 *   6. trim
 *
 * Case is deliberately preserved: the manual shouts some rules in all caps and
 * a case-insensitive match would let a paraphrase slip through.
 */

const CURLY_SINGLE = /[‘’‚‛′´`]/g;
const CURLY_DOUBLE = /[“”„‟″«»]/g;
const DASHES = /[‐‑‒–—―−⁃]/g;
const ELLIPSIS = /…/g;
const ODD_SPACE = /[  -​  　﻿]/g;
const WHITESPACE_RUN = /\s+/g;

/** @param {string} input */
export function normalizeForMatch(input) {
  return String(input)
    .replace(CURLY_SINGLE, "'")
    .replace(CURLY_DOUBLE, '"')
    .replace(DASHES, '-')
    .replace(ELLIPSIS, '...')
    .replace(ODD_SPACE, ' ')
    .replace(WHITESPACE_RUN, ' ')
    .trim();
}

/**
 * True when `quote` appears verbatim in `source` once both are normalized.
 * @param {string} quote
 * @param {string} source normalized source text (pass the output of normalizeForMatch)
 */
export function quoteAppearsIn(quote, normalizedSource) {
  const needle = normalizeForMatch(quote);
  if (needle.length === 0) return false;
  return normalizedSource.includes(needle);
}
