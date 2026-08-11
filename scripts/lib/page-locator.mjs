/**
 * Page-exact quote lookup against the manual extract.
 *
 * A citation names one PDF page. The quote has to be on *that* page. The
 * earlier implementation accepted the cited page or the one after it, which
 * silently blessed every off-by-one citation in the bank — a learner who turns
 * to the page a citation names and does not find the sentence has been sent to
 * the wrong rule, and the validator said nothing.
 *
 * The one legitimate exception is a sentence the PDF breaks across a page
 * boundary. That is admitted only when the match genuinely *straddles*: it must
 * begin on the cited page and end on the next one. A quote that lives wholly on
 * the next page is not a straddle, it is a wrong page number, and it fails.
 */
import { normalizeForMatch } from './content-normalize.mjs';

/**
 * @param {string} extractText raw contents of docs/research/tn-dl-manual-extract.txt
 * @returns {Map<number, string>} page number -> normalized page text
 */
export function buildPageIndex(extractText) {
  /** @type {Map<number, string>} */
  const pages = new Map();
  const parts = String(extractText).split(/===== PAGE (\d+) =====/);
  for (let i = 1; i < parts.length; i += 2) {
    pages.set(Number(parts[i]), normalizeForMatch(parts[i + 1] ?? ''));
  }
  return pages;
}

/**
 * @param {Map<number, string>} pages
 * @param {string} quote
 * @param {number} pdfPage
 * @returns {{ ok: boolean, how: 'exact' | 'straddle' | 'none' }}
 */
export function locateQuote(pages, quote, pdfPage) {
  const needle = normalizeForMatch(quote);
  if (needle.length === 0) return { ok: false, how: 'none' };

  const page = pages.get(pdfPage);
  if (page && page.includes(needle)) return { ok: true, how: 'exact' };

  const next = pages.get(pdfPage + 1);
  if (page && next) {
    const joined = `${page} ${next}`;
    const at = joined.indexOf(needle);
    // Begins on the cited page (at < page.length) and runs past the join
    // (at + length > page.length + 1, the +1 being the space we inserted).
    if (at !== -1 && at < page.length && at + needle.length > page.length + 1) {
      return { ok: true, how: 'straddle' };
    }
  }
  return { ok: false, how: 'none' };
}
