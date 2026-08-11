/**
 * Does the citation actually support the *keyed* answer?
 *
 * The verbatim-quote check proves a citation is real. It does not prove it is
 * relevant. The manual is full of tables and bullet lists whose rows differ by
 * one word or one number, so a citation picker that grabs the neighbouring row
 * produces a quote that is genuinely on the cited page, genuinely verbatim, and
 * genuinely about the wrong rule — sometimes about a distractor.
 *
 * This module scores that. For a question it computes each option's
 * *distinctive* tokens (the words that separate that option from the others),
 * then measures how many of them the citation quote contains:
 *
 *   1. NUMERIC CONTRADICTION — the keyed option names a number the distractors
 *      do not, the quote does not contain that number, and the quote does
 *      contain a distractor's number. The quote is keying the wrong row.
 *   2. NO KEYED SUPPORT — the keyed option has distinctive words and the quote
 *      contains none of them. Nothing in the quote points at this answer.
 *   3. DISTRACTOR DOMINANCE — some distractor's distinctive words appear in the
 *      quote more than the keyed option's do. The quote argues for the wrong
 *      option.
 *
 * Two structural exemptions, both narrow and both about questions where option
 * wording carries no evidence by construction:
 *
 *   - COMBINATION options ("Both of the above", "A & B") have no content words
 *     of their own; the evidence lives in the options they refer to.
 *   - NEGATED STEMS ("Which is NOT required...", "...except") inverse the whole
 *     relation: the quote is supposed to talk about the distractors. Only the
 *     dominance rule is skipped; the keyed option must still be supported.
 *
 * Matching is deliberately loose about morphology ("multiply"/"multiplied"
 * share a 5-character prefix) and deliberately strict about numbers, because a
 * wrong number is the failure mode that reaches the learner as a wrong answer.
 */

/**
 * Words that carry no discriminating power in a multiple-choice option.
 * Quantifiers and negations (all, only, never, none) are deliberately NOT here:
 * in a test option they are frequently the entire answer.
 */
const STOPWORDS = new Set(
  `a an the and or but nor so yet of to in on at by for from with without into onto upon over under
   is are was were be been being am do does did done have has had having
   you your yours it its they them their there this that these those he she his her him we us our i me my
   as if when while then than because about after before during until unless whether which who whom whose what
   ever also just very too such own
   should must may might can could would will shall
   means meaning mean indicates indicate
   following follows`
    .split(/\s+/)
    .filter(Boolean),
);

const NUMBER_WORDS = {
  zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7',
  eight: '8', nine: '9', ten: '10', eleven: '11', twelve: '12', thirteen: '13', fourteen: '14',
  fifteen: '15', sixteen: '16', seventeen: '17', eighteen: '18', nineteen: '19', twenty: '20',
  thirty: '30', forty: '40', fifty: '50', sixty: '60', seventy: '70', eighty: '80', ninety: '90',
  hundred: '100', thousand: '1000',
};

/** "Both of the above", "All of these", "Both A and C", "A & B". */
const COMBINATION_OPTION =
  /\b(both|all|none|neither|either)\b[^.]{0,24}\b(above|below|of these|of the following)\b|\b(both|all|either|neither)\s+[a-d]\s*(?:and|&|,)\s*[a-d]\b|^\s*[a-d]\s*(?:&|and)\s*[a-d]\s*\.?$/i;

/**
 * "Which of these is NOT ...", "... except ...", "least likely" — stems that
 * invert the relation, so the quote is supposed to describe the distractors.
 * Deliberately narrow: only the shouted NOT the manual and the State's own
 * questions use for this, plus "except" and "least likely". A stem that merely
 * contains the word "not" ("a driver shall not follow another vehicle...")
 * is not inverted and gets no exemption.
 */
const NEGATED_STEM = /\bNOT\b|\bEXCEPT\b|\bexcept\b|\bleast likely\b/;

/**
 * Lower-cases, expands the contractions the manual writes as one word
 * ("CANNOT", "don't" -> "not", which is often the whole answer), and joins the
 * digits of a thousands-separated number so "$3,000" is one number and not
 * "3" plus "000".
 * @param {string} text
 */
function prepare(text) {
  let out = String(text).toLowerCase().replace(/[‘’]/g, "'");
  out = out.replace(/\bcannot\b/g, 'can not').replace(/\bcan't\b/g, 'can not');
  out = out.replace(/([a-z])n't\b/g, '$1 not');
  out = out.replace(/'/g, '');
  while (/\d,\d{3}/.test(out)) out = out.replace(/(\d),(\d{3})/g, '$1$2');
  return out;
}

/** @param {string} text */
export function distinctiveTokens(text) {
  const raw = prepare(text).split(/[^a-z0-9.]+/);
  /** @type {Set<string>} */
  const out = new Set();
  for (let token of raw) {
    token = token.replace(/^\.+|\.+$/g, '');
    if (!token) continue;
    if (NUMBER_WORDS[token]) token = NUMBER_WORDS[token];
    if (token.length < 2 && !/^\d$/.test(token)) continue;
    if (STOPWORDS.has(token)) continue;
    out.add(token);
  }
  return out;
}

/**
 * True when two tokens are the same word up to inflection. Exact match, or a
 * shared prefix of at least five characters ("visibility"/"visible",
 * "multiply"/"multiplied"). Five is the shortest prefix that does not conflate
 * "sign"/"signal" or "driving"/"drivers".
 */
export function related(a, b) {
  if (a === b) return true;
  // Plurals first, so short words like "hour"/"hours" pair up too.
  if (`${a}s` === b || `${b}s` === a) return true;
  if (`${a}es` === b || `${b}es` === a) return true;
  // "stopping"/"stop", "risking"/"risk", "considered"/"consider".
  const ai = verbStem(a);
  const bi = verbStem(b);
  if (ai === b || bi === a || (ai !== a && ai === bi)) return true;
  if (a.length < 5 || b.length < 5) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  return i >= 5;
}

/** Strips -ing/-ed and undoubles the consonant ("stopping" -> "stop"). */
function verbStem(word) {
  let base = word;
  if (word.length >= 6 && word.endsWith('ing')) base = word.slice(0, -3);
  else if (word.length >= 5 && word.endsWith('ed')) base = word.slice(0, -2);
  else return word;
  if (base.length >= 3 && base.at(-1) === base.at(-2) && !'aeiou'.includes(base.at(-1))) {
    base = base.slice(0, -1);
  }
  return base;
}

const containsToken = (token, set) => {
  for (const candidate of set) if (related(token, candidate)) return true;
  return false;
};

/** Every number in `text`, as canonical decimal strings. */
export function numbersIn(text) {
  /** @type {Set<string>} */
  const out = new Set();
  const lower = prepare(text);
  for (const match of lower.matchAll(/\d+(?:\.\d+)?/g)) out.add(String(Number(match[0])));
  for (const [word, digits] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(lower)) out.add(String(Number(digits)));
  }
  return out;
}

/**
 * @param {{ stem: string, options: {text: string}[], correctIndex: number, citations: {quote: string}[] }} question
 * @returns {{ id?: string, keyedOverlap: number, maxDistractorOverlap: number,
 *             keyedDistinctive: number, combination: boolean, negatedStem: boolean,
 *             problems: {code: string, message: string}[] }}
 */
export function scoreCitationSupport(question) {
  const quote = (question.citations ?? []).map((c) => c.quote ?? '').join(' ');
  const quoteTokens = distinctiveTokens(quote);
  const quoteNumbers = numbersIn(quote);

  const options = question.options ?? [];
  const keyed = question.correctIndex;
  const optionTokens = options.map((o) => distinctiveTokens(o.text ?? ''));
  const distinctive = optionTokens.map(
    (own, i) => new Set([...own].filter((t) => !optionTokens.some((other, j) => j !== i && containsToken(t, other)))),
  );
  const overlap = distinctive.map((set) => [...set].filter((t) => containsToken(t, quoteTokens)).length);

  const combination = COMBINATION_OPTION.test(options[keyed]?.text ?? '');
  const negatedStem = NEGATED_STEM.test(question.stem ?? '');
  const maxDistractorOverlap = Math.max(0, ...overlap.filter((_, i) => i !== keyed));

  /** @type {{code: string, message: string}[]} */
  const problems = [];

  // 1. Numeric contradiction — the hardest signal there is.
  const optionNumbers = options.map((o) => numbersIn(o.text ?? ''));
  const keyedNumbers = [...(optionNumbers[keyed] ?? [])].filter(
    (n) => !optionNumbers.some((set, j) => j !== keyed && set.has(n)),
  );
  const distractorNumbers = optionNumbers
    .flatMap((set, j) => (j === keyed ? [] : [...set]))
    .filter((n) => !(optionNumbers[keyed] ?? new Set()).has(n));
  if (
    keyedNumbers.length > 0 &&
    !keyedNumbers.some((n) => quoteNumbers.has(n)) &&
    distractorNumbers.some((n) => quoteNumbers.has(n))
  ) {
    const wrong = distractorNumbers.filter((n) => quoteNumbers.has(n));
    problems.push({
      code: 'numeric-contradiction',
      message: `the keyed answer says ${keyedNumbers.join('/')} but the quote contains ${wrong.join('/')} — a distractor's number — and not the keyed one`,
    });
  }

  // 2. The quote says nothing that points at the keyed answer.
  if (!combination && distinctive[keyed]?.size > 0 && overlap[keyed] === 0) {
    problems.push({
      code: 'no-keyed-support',
      message: `the quote contains none of the keyed answer's distinctive words (${[...distinctive[keyed]].sort().join(', ')})`,
    });
  }

  // 3. The quote argues harder for a distractor than for the key.
  if (!combination && !negatedStem && maxDistractorOverlap > overlap[keyed]) {
    const worst = overlap.findIndex((n, i) => i !== keyed && n === maxDistractorOverlap);
    problems.push({
      code: 'distractor-dominant',
      message: `the quote matches ${maxDistractorOverlap} distinctive word(s) of distractor "${options[worst]?.text}" but only ${overlap[keyed]} of the keyed answer`,
    });
  }

  return {
    id: /** @type {any} */ (question).id,
    keyedOverlap: overlap[keyed] ?? 0,
    maxDistractorOverlap,
    keyedDistinctive: distinctive[keyed]?.size ?? 0,
    combination,
    negatedStem,
    problems,
  };
}
