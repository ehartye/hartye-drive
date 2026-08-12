import type { SignCategory } from '~/content/types';

/**
 * What each MUTCD category *teaches*, stated once and quoted everywhere.
 *
 * The library's category headings, the colour key, the empty-state recovery
 * links and the drill's shape-and-colour answers all read from this table. That
 * is the point: a learner meets the same sentence in the library and then has
 * to pick it out of three in the drill, which is what turns "yellow diamond" into
 * something they know rather than something they once read.
 *
 * `lesson` is deliberately short enough to be one of three answers on a 320px
 * screen. `rule` is the longer teaching paragraph that heads the category.
 */
export interface CategoryMeta {
  id: SignCategory;
  label: string;
  /** The one-sentence lesson. Also the drill's shape-and-colour answer. */
  lesson: string;
  /** The paragraph under the heading — the rule, stated as teaching. */
  rule: string;
  /** Short line for the chip's sibling links and the recovery list. */
  blurb: string;
  /** The swatch on the filter chip and the stripe on the heading. */
  swatch: string;
  /** A representative face from this category, used as its icon. */
  exemplar: string;
}

/**
 * Display order. Regulatory and warning first because they are most of the
 * test; the registry's seven categories are all shown, none folded into
 * another — the taxonomy the app teaches is the taxonomy the content carries.
 */
export const SIGN_CATEGORIES: readonly CategoryMeta[] = [
  {
    id: 'regulatory',
    label: 'Regulatory',
    lesson: 'The law — you must, or you must not.',
    rule:
      'Red, or white with black letters. These are the law. Ignoring one is a violation, not a bad idea — and the octagon and the downward triangle are used for nothing else on the road.',
    blurb: 'Red, or white with black letters — the law',
    swatch: 'var(--color-stop-lit)',
    exemplar: 'r1-1-stop',
  },
  {
    id: 'warning',
    label: 'Warning',
    lesson: 'A warning — something ahead needs you to slow down and look.',
    rule:
      'Yellow diamond. A warning tells you what is coming so you can change speed or position before you reach it. Pedestrian, bicycle and school warnings may be posted in fluorescent yellow-green — same shape, same meaning.',
    blurb: 'Yellow diamond — something ahead needs you',
    swatch: 'var(--color-warning)',
    exemplar: 'w1-2-curve',
  },
  {
    id: 'guide',
    label: 'Guide',
    lesson: 'Guidance — where you may go, which way, and how far.',
    rule:
      'Green tells you where. Guide signs never command you — they inform. Losing one costs you a turn, not a ticket, and the route markers name the road you are actually on.',
    blurb: 'Green for direction, plus the route markers',
    swatch: 'var(--color-guide-lit)',
    exemplar: 'd1-1-destination',
  },
  {
    id: 'service',
    label: 'Services',
    lesson: 'Services for drivers — hospital, fuel, food, rest.',
    rule:
      'Blue tells you what is available. A blue sign is never an instruction: it points at something you may want — a hospital, a pump, a meal — and nothing on it carries a penalty.',
    blurb: 'Blue — hospital, fuel, food, rest',
    swatch: 'var(--color-route-lit)',
    exemplar: 'd9-2-hospital',
  },
  {
    id: 'work-zone',
    label: 'Work zone',
    lesson: 'A work zone — temporary conditions, and people on foot.',
    rule:
      'Orange, and only orange. Orange means the road ahead is temporary — the lane you expect may be shifted, narrowed, or gone, and there are people working beside it. Drop to the posted work-zone speed and keep it until the zone ends.',
    blurb: 'Orange — temporary conditions, people working',
    swatch: 'var(--color-work)',
    exemplar: 'w20-1-road-work-ahead',
  },
  {
    id: 'school',
    label: 'School',
    lesson: 'A school zone — children, and a lower limit when it is in force.',
    rule:
      'Five sides — and nothing else on the road has five sides. That shape is how you identify it at a distance, in the dark, or half covered by a branch. School, pedestrian and bicycle warnings are posted in fluorescent yellow-green, which is a different colour from warning yellow and means the same urgency.',
    blurb: 'Five sides — the only five-sided sign on the road',
    swatch: 'var(--color-school)',
    exemplar: 's1-1-school',
  },
  {
    id: 'railroad',
    label: 'Railroad',
    lesson: 'A railroad crossing — slow, look, and be ready to stop.',
    rule:
      'Two signs, two jobs. The round yellow sign warns you a crossing is coming. The white crossbuck marks the crossing itself and carries the force of a yield sign. When lights flash or gates lower, stop between 15 and 50 feet from the nearest rail.',
    blurb: 'Advance warning, then the crossbuck at the rails',
    swatch: 'var(--color-sign-white)',
    exemplar: 'r15-1-crossbuck',
  },
];

const BY_ID = new Map(SIGN_CATEGORIES.map((meta) => [meta.id as string, meta]));

export function categoryMeta(id: string): CategoryMeta | undefined {
  return BY_ID.get(id);
}

export function categoryLabel(id: string): string {
  return BY_ID.get(id)?.label ?? id;
}

/** The drill's shape-and-colour answers. Falls back to the id, never to blank. */
export function categoryLesson(id: string): string {
  return BY_ID.get(id)?.lesson ?? id;
}

/**
 * The colour key — the teaching move the library opens with.
 *
 * It is keyed on **colour**, not category, because that is the order a driver
 * actually reads a sign in: the colour arrives from two hundred feet away, the
 * shape at a hundred, the words last. Two entries have no category of their own
 * (white regulatory, and the five-sided school shape), which is exactly why the
 * key is a separate list rather than a re-run of the categories above.
 */
export interface ColorKeyEntry {
  signId: string;
  term: string;
  text: string;
}

export const COLOR_KEY: readonly ColorKeyEntry[] = [
  {
    signId: 'r1-1-stop',
    term: 'Red',
    text: 'you must, or you must not. Stop, yield, do not enter.',
  },
  {
    signId: 'r2-1-speed-limit',
    term: 'White with black letters',
    text: 'a law you have to obey: limits, turns, lane rules.',
  },
  {
    signId: 'w1-2-curve',
    term: 'Yellow diamond',
    text: 'a warning. Something ahead needs you to slow down and look.',
  },
  {
    signId: 'w20-1-road-work-ahead',
    term: 'Orange',
    text: 'a work zone. Conditions are temporary and people are on foot.',
  },
  {
    signId: 'd1-1-destination',
    term: 'Green',
    text: 'guidance. Where you may go, which way, and how far.',
  },
  {
    signId: 'd9-2-hospital',
    term: 'Blue',
    text: 'services for drivers: hospital, fuel, food, rest.',
  },
  {
    signId: 's1-1-school',
    term: 'Five sides',
    text: 'school. No other sign on the road has five sides.',
  },
];
