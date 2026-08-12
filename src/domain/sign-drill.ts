/**
 * The sign drill — what the next thirty signs are, and what the three choices
 * under each of them say.
 *
 * **It schedules nothing itself.** Which signs come up, in what order, and when
 * a missed one returns is `./scheduler` and `./session`, unchanged: a sign is a
 * card whose id is its registry id and whose topic is its MUTCD category. One
 * spaced-repetition policy in the product, stated once, so the drill's promise
 * ("you'll see this one again in about ten minutes") is the same promise the
 * study session makes.
 *
 * What is new here is the **question**, and there are two of them:
 *
 *  - `meaning` — the sign, and three meanings. Distractors are drawn from the
 *    same MUTCD category first, because a yellow diamond offered against three
 *    green guide meanings tests nothing; the confusable signs are the ones that
 *    wear the same shape and colour.
 *  - `shape-color` — the sign, and three statements of what a shape and colour
 *    *tell* you. This is the lesson the library teaches, asked back: yellow
 *    diamond = warning, orange = work zone, red = prohibition. The choices are
 *    category lessons, so the drill never has to name the sign's own meaning —
 *    which is what lets the face keep an accessible name of shape and colour
 *    only (practices A8) without handing a screen-reader user the answer.
 *
 * The lesson text itself is passed in (`lessonFor`), not written here: this
 * module stays pure and prose-free, and the library and the drill quote one
 * source for what a category means.
 */
import { makeRandom, shuffled } from './random';
import { buildSession } from './session';
import type { TopicStat } from './session';
import type { CardState } from './scheduler';

/** What the drill asks you for. The toggle offers exactly these two. */
export type DrillMode = 'meaning' | 'shape-color';

export const DRILL_MODES: readonly DrillMode[] = ['meaning', 'shape-color'];

export function isDrillMode(value: unknown): value is DrillMode {
  return typeof value === 'string' && (DRILL_MODES as readonly string[]).includes(value);
}

/** Thirty: the drill screen says "of 30", and the registry holds 87. */
export const DEFAULT_DRILL_SIZE = 30;

/** Three, matching the question bank — the real knowledge test's format. */
export const DRILL_CHOICE_COUNT = 3;

export const CHOICE_LETTERS = ['A', 'B', 'C'] as const;

/** The structural minimum a registry entry needs to be drillable. */
export interface DrillSign {
  id: string;
  category: string;
  meaning: string;
}

export interface DrillOption {
  letter: string;
  text: string;
}

export interface DrillItem {
  signId: string;
  category: string;
  options: DrillOption[];
  correctIndex: number;
}

export interface DrillPlan {
  items: DrillItem[];
  /** Categories in this drill the learner is measurably worst at, weakest first. */
  weakestCategories: string[];
}

export interface BuildDrillInput {
  signs: readonly DrillSign[];
  /** The learner's sign ladder, keyed by registry id. */
  cards: Record<string, CardState>;
  /** Per-category accuracy, so the drill targets weakness like a session does. */
  categories: Record<string, TopicStat>;
  now: number;
  size: number;
  seed: number;
  mode: DrillMode;
  /** One sentence: what this category's shape and colour tell a driver. */
  lessonFor: (category: string) => string;
  /**
   * Every lesson the shape-and-colour question may offer as a wrong answer.
   *
   * It defaults to the lessons of the categories in `signs`, which is right for
   * a whole-registry drill and **wrong** for a filtered one: drilling only the
   * school signs would otherwise leave one category in play and hand the
   * learner a single choice. The caller passes the full set so a filtered drill
   * is still a question.
   */
  lessonPool?: readonly string[];
}

/**
 * A second stream, so re-seeding the line-up does not silently re-shuffle every
 * answer slot in lockstep with it. The constant is the golden-ratio mix used
 * throughout `random.ts`'s lineage; any fixed odd word would do.
 */
const CHOICE_SEED_MIX = 0x9e3779b9;

function optionsFor(
  sign: DrillSign,
  input: BuildDrillInput,
  random: () => number,
): { options: DrillOption[]; correctIndex: number } {
  const correct =
    input.mode === 'meaning' ? sign.meaning : input.lessonFor(sign.category);

  const candidates =
    input.mode === 'meaning'
      ? meaningDistractors(sign, input.signs, random)
      : lessonDistractors(sign, input, random);

  const texts = [correct];
  for (const text of candidates) {
    if (texts.length >= DRILL_CHOICE_COUNT) break;
    if (!texts.includes(text)) texts.push(text);
  }

  const drawn = shuffled(texts, random);
  return {
    options: drawn.map((text, index) => ({ letter: CHOICE_LETTERS[index] ?? '?', text })),
    correctIndex: drawn.indexOf(correct),
  };
}

/** Same category first — those are the signs actually confused with each other. */
function meaningDistractors(
  sign: DrillSign,
  signs: readonly DrillSign[],
  random: () => number,
): string[] {
  const pool = signs.filter((other) => other.id !== sign.id && other.meaning !== sign.meaning);
  const near = shuffled(
    pool.filter((other) => other.category === sign.category),
    random,
  );
  const far = shuffled(
    pool.filter((other) => other.category !== sign.category),
    random,
  );
  return [...near, ...far].map((other) => other.meaning);
}

/** The other categories' lessons — de-duplicated, because two may read alike. */
function lessonDistractors(
  sign: DrillSign,
  input: BuildDrillInput,
  random: () => number,
): string[] {
  const own = input.lessonFor(sign.category);
  const pool = input.lessonPool ?? input.signs.map((other) => input.lessonFor(other.category));
  const lessons = [...new Set(pool)].filter((lesson) => lesson !== own);
  return shuffled(lessons, random);
}

/**
 * The line-up, and the three choices under each sign.
 *
 * The line-up is `buildSession`'s, run over the registry: due signs first,
 * capped so a fortnight away does not become thirty of your own past failures,
 * then weight toward the categories going worst, then new ground.
 */
export function buildDrill(input: BuildDrillInput): DrillPlan {
  const plan = buildSession({
    candidates: input.signs.map((sign) => ({
      id: sign.id,
      topic: sign.category,
      area: sign.category,
    })),
    cards: input.cards,
    topics: input.categories,
    now: input.now,
    size: input.size,
    seed: input.seed,
  });

  const byId = new Map(input.signs.map((sign) => [sign.id, sign]));
  const random = makeRandom((input.seed ^ CHOICE_SEED_MIX) >>> 0);

  const items: DrillItem[] = [];
  for (const pick of plan.picks) {
    const sign = byId.get(pick.questionId);
    if (!sign) continue;
    const { options, correctIndex } = optionsFor(sign, input, random);
    items.push({ signId: sign.id, category: sign.category, options, correctIndex });
  }

  return { items, weakestCategories: plan.weakestTopics };
}
