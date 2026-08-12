import { describe, it, expect } from 'vitest';
import {
  CHOICE_LETTERS,
  DEFAULT_DRILL_SIZE,
  DRILL_CHOICE_COUNT,
  buildDrill,
  isDrillMode,
} from './sign-drill';
import type { BuildDrillInput, DrillSign } from './sign-drill';
import { DAY_MS, newCard, reviewCard } from './scheduler';
import type { CardState } from './scheduler';
import { SIGN_REGISTRY } from '~/signs/registry';

const T0 = Date.UTC(2026, 7, 11, 9, 0, 0);

const CATEGORY_LESSON: Record<string, string> = {
  regulatory: 'The law: you must, or you must not.',
  warning: 'A warning: something ahead needs you to slow down and look.',
  'work-zone': 'A work zone: temporary conditions, and people on foot.',
  guide: 'Guidance: where you may go, which way, and how far.',
};

const lessonFor = (category: string) => CATEGORY_LESSON[category] ?? category;

function registry(counts: Record<string, number>): DrillSign[] {
  const out: DrillSign[] = [];
  for (const [category, count] of Object.entries(counts)) {
    for (let i = 0; i < count; i += 1) {
      const id = `${category}-${String(i).padStart(2, '0')}`;
      out.push({
        id,
        category,
        meaning: `The meaning of ${id}, spelled out in full.`,
        shape: SHAPE_FOR[category] ?? 'diamond',
        faceColor: COLOR_FOR[category] ?? 'yellow',
        legendColor: 'black',
      });
    }
  }
  return out;
}

const SHAPE_FOR: Record<string, string> = {
  regulatory: 'rectangle-vertical',
  warning: 'diamond',
  'work-zone': 'diamond',
  guide: 'rectangle-horizontal',
};

const COLOR_FOR: Record<string, string> = {
  regulatory: 'white',
  warning: 'yellow',
  'work-zone': 'orange',
  guide: 'green',
};

const SIGNS = registry({ regulatory: 8, warning: 10, 'work-zone': 4, guide: 3 });

function input(over: Partial<BuildDrillInput> = {}): BuildDrillInput {
  return {
    signs: SIGNS,
    cards: {},
    categories: {},
    now: T0,
    size: 6,
    seed: 7,
    mode: 'meaning',
    lessonFor,
    ...over,
  };
}

function cardsFrom(entries: CardState[]): Record<string, CardState> {
  return Object.fromEntries(entries.map((c) => [c.questionId, c]));
}

describe('isDrillMode', () => {
  it('accepts the two modes the toggle offers and nothing else', () => {
    expect(isDrillMode('meaning')).toBe(true);
    expect(isDrillMode('shape-color')).toBe(true);
    expect(isDrillMode('colour')).toBe(false);
    expect(isDrillMode(null)).toBe(false);
  });
});

describe('buildDrill', () => {
  it('lays out the requested number of signs, each one only once', () => {
    const plan = buildDrill(input({ size: 12 }));
    expect(plan.items).toHaveLength(12);
    expect(new Set(plan.items.map((i) => i.signId)).size).toBe(12);
  });

  it('is deterministic given a seed, and different given another', () => {
    const a = buildDrill(input({ seed: 11 })).items.map((i) => i.signId);
    const b = buildDrill(input({ seed: 11 })).items.map((i) => i.signId);
    const c = buildDrill(input({ seed: 12 })).items.map((i) => i.signId);
    expect(a).toEqual(b);
    expect(c).not.toEqual(a);
  });

  it('returns nothing when there is nothing to drill', () => {
    expect(buildDrill(input({ signs: [] })).items).toEqual([]);
    expect(buildDrill(input({ size: 0 })).items).toEqual([]);
  });

  it('never asks for more signs than the registry holds', () => {
    const plan = buildDrill(input({ signs: registry({ warning: 4 }), size: 30 }));
    expect(plan.items).toHaveLength(4);
  });

  it('puts the signs the scheduler says are owed at the front of the queue', () => {
    const overdue = reviewCard(newCard('warning-07', 'warning', T0 - 5 * DAY_MS), false, T0 - 5 * DAY_MS);
    const plan = buildDrill(input({ cards: cardsFrom([overdue]), size: 4 }));
    expect(plan.items[0]?.signId).toBe('warning-07');
  });

  it('names the categories the learner is worst at, weakest first', () => {
    const plan = buildDrill(
      input({
        categories: {
          warning: { seen: 10, correct: 2 },
          regulatory: { seen: 10, correct: 4 },
          guide: { seen: 10, correct: 10 },
        },
        size: 8,
      }),
    );
    expect(plan.weakestCategories).toEqual(['warning', 'regulatory']);
  });
});

describe('buildDrill — meaning mode', () => {
  const plan = buildDrill(input({ mode: 'meaning', size: 10 }));

  it('offers three choices, lettered A B C, one of them right', () => {
    for (const item of plan.items) {
      expect(item.options).toHaveLength(DRILL_CHOICE_COUNT);
      expect(item.options.map((o) => o.letter)).toEqual([...CHOICE_LETTERS]);
      expect(item.correctIndex).toBeGreaterThanOrEqual(0);
      expect(item.correctIndex).toBeLessThan(DRILL_CHOICE_COUNT);
    }
  });

  it('keys the right answer to the sign’s own meaning', () => {
    const byId = new Map(SIGNS.map((s) => [s.id, s]));
    for (const item of plan.items) {
      expect(item.options[item.correctIndex]?.text).toBe(byId.get(item.signId)?.meaning);
    }
  });

  it('never repeats a choice inside one question', () => {
    for (const item of plan.items) {
      expect(new Set(item.options.map((o) => o.text)).size).toBe(item.options.length);
    }
  });

  it('does not always park the answer in the same slot', () => {
    expect(new Set(plan.items.map((i) => i.correctIndex)).size).toBeGreaterThan(1);
  });

  it('makes an unfiltered drill discriminate across the registry, not inside one colour', () => {
    // The old behaviour drew all three options from the sign's own category, so
    // every item was a 1-in-3 inside a single colour family and never asked the
    // learner to tell a yellow diamond from a green guide sign at all.
    const byId = new Map(SIGNS.map((s) => [s.id, s]));
    const meanings = new Map(SIGNS.map((s) => [s.meaning, s.category]));
    for (const item of plan.items) {
      const own = byId.get(item.signId)?.category;
      const elsewhere = item.options.filter((o) => {
        const from = meanings.get(o.text);
        return from !== undefined && from !== own;
      }).length;
      expect(elsewhere, `${item.signId} was answered entirely inside ${String(own)}`).toBeGreaterThanOrEqual(1);
    }
  });

  it('still keeps a confusable neighbour in the line-up', () => {
    // Cross-category alone would be its own failure: the confusable signs are
    // the ones wearing the same shape and colour, and one of them stays.
    const byId = new Map(SIGNS.map((s) => [s.id, s]));
    const meanings = new Map(SIGNS.map((s) => [s.meaning, s.category]));
    for (const item of plan.items) {
      const own = byId.get(item.signId)?.category;
      const near = item.options.filter((o) => meanings.get(o.text) === own).length;
      // The answer itself is one; a same-category distractor is the second.
      expect(near, `${item.signId} lost its confusable neighbour`).toBeGreaterThanOrEqual(2);
    }
  });

  it('falls back to other categories when a category cannot fill the choices', () => {
    const signs = [...registry({ guide: 1 }), ...registry({ warning: 6 })];
    const plan1 = buildDrill(input({ signs, size: 7, mode: 'meaning' }));
    const guide = plan1.items.find((i) => i.signId.startsWith('guide'));
    expect(guide?.options).toHaveLength(DRILL_CHOICE_COUNT);
  });

  it('offers what it can when the registry is smaller than the choice count', () => {
    const signs = registry({ warning: 2 });
    const plan1 = buildDrill(input({ signs, size: 2, mode: 'meaning' }));
    expect(plan1.items[0]?.options).toHaveLength(2);
    expect(plan1.items[0]?.options.map((o) => o.letter)).toEqual(['A', 'B']);
  });
});

describe('buildDrill — shape and colour mode', () => {
  const plan = buildDrill(input({ mode: 'shape-color', size: 10 }));

  it('asks what the shape and colour tell you, keyed to the category’s lesson', () => {
    const byId = new Map(SIGNS.map((s) => [s.id, s]));
    for (const item of plan.items) {
      const category = byId.get(item.signId)?.category ?? '';
      expect(item.options[item.correctIndex]?.text).toBe(lessonFor(category));
    }
  });

  it('draws its distractors from other categories, never repeating the answer', () => {
    for (const item of plan.items) {
      expect(item.options).toHaveLength(DRILL_CHOICE_COUNT);
      expect(new Set(item.options.map((o) => o.text)).size).toBe(DRILL_CHOICE_COUNT);
    }
  });

  it('degrades to a single choice when the registry teaches only one category', () => {
    const plan1 = buildDrill(input({ signs: registry({ warning: 3 }), mode: 'shape-color', size: 3 }));
    expect(plan1.items[0]?.options).toHaveLength(1);
    expect(plan1.items[0]?.correctIndex).toBe(0);
  });

  it('still asks a real question when the drill is filtered to one category', () => {
    // Drilling only the school signs must not leave one category in play and
    // hand the learner the answer by elimination.
    const plan1 = buildDrill(
      input({
        signs: registry({ warning: 3 }),
        mode: 'shape-color',
        size: 3,
        lessonPool: Object.values(CATEGORY_LESSON),
      }),
    );
    expect(plan1.items[0]?.options).toHaveLength(3);
    expect(plan1.items[0]?.options[plan1.items[0].correctIndex]?.text).toBe(
      CATEGORY_LESSON['warning'],
    );
  });
});

/* -------------------------------------------- the colour-and-shape leak */

const REAL_SIGNS: DrillSign[] = [...SIGN_REGISTRY.values()].map((sign) => ({
  id: sign.id,
  category: sign.category,
  meaning: sign.meaning,
  shape: sign.shape,
  faceColor: sign.faceColor,
  legendColor: sign.legendColor,
}));

const REAL_LESSON: Record<string, string> = {
  regulatory: 'The law — you must, or you must not.',
  warning: 'A warning — something ahead needs you to slow down and look.',
  guide: 'Guidance — where you may go, which way, and how far.',
  service: 'Services for drivers — hospital, fuel, food, rest.',
  'work-zone': 'A work zone — temporary conditions, and people on foot.',
  school: 'A school zone — children, and a lower limit when it is in force.',
  railroad: 'A railroad crossing — slow, look, and be ready to stop.',
};

const says = (text: string, word: string) => new RegExp(`\\b${word}\\b`, 'i').test(text);

/**
 * Recomputed here from the registry entry rather than imported, so this test
 * would still catch a `visibleWords` that quietly stopped looking at the
 * legend colour. Bare orientation words are dropped: `down` comes from
 * `triangle-down` and is ordinary road English ("slow down"), not a shape name.
 */
const ORIENTATION = new Set(['up', 'down', 'left', 'right']);

const seenOn = (sign: DrillSign): string[] => [
  ...new Set(
    `${sign.faceColor} ${sign.legendColor} ${sign.shape}`
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((word) => word.length > 0 && !ORIENTATION.has(word)),
  ),
];

/**
 * The leak, stated exactly: a word naming something the learner can *see* on
 * the sign that, on its own, tells them which option is the answer. Either the
 * answer is the only option that says it ("only one option mentions a
 * **yellow** EXIT ONLY panel"), or the answer is the only option that does not
 * while the rest do — with three choices, both are decisive.
 */
function separator(sign: DrillSign, texts: string[], correctIndex: number): string | null {
  for (const word of seenOn(sign)) {
    const saying = texts.map((text, index) => (says(text, word) ? index : -1)).filter((i) => i >= 0);
    if (saying.length === 0) continue;
    if (saying.length === 1 && saying[0] === correctIndex) return word;
    const silent = texts.map((_, index) => index).filter((index) => !saying.includes(index));
    if (silent.length === 1 && silent[0] === correctIndex) return word;
  }
  return null;
}

describe('buildDrill — a colour or a shape word must never be the answer', () => {
  const realInput = (over: Partial<BuildDrillInput> = {}): BuildDrillInput => ({
    signs: REAL_SIGNS,
    cards: {},
    categories: {},
    now: T0,
    size: DEFAULT_DRILL_SIZE,
    seed: 1,
    mode: 'meaning',
    lessonFor: (category) => REAL_LESSON[category] ?? category,
    lessonPool: Object.values(REAL_LESSON),
    ...over,
  });

  const SEEDS = Array.from({ length: 60 }, (_, i) => i * 977 + 3);

  const REAL_BY_ID = new Map(REAL_SIGNS.map((sign) => [sign.id, sign]));

  it('holds across sixty seeded draws of the real registry, in both modes', () => {
    const leaks: string[] = [];
    let asked = 0;
    for (const seed of SEEDS) {
      for (const mode of ['meaning', 'shape-color'] as const) {
        for (const item of buildDrill(realInput({ seed, mode })).items) {
          asked += 1;
          const sign = REAL_BY_ID.get(item.signId);
          if (!sign) throw new Error(`unknown sign ${item.signId}`);
          const texts = item.options.map((option) => option.text);
          const word = separator(sign, texts, item.correctIndex);
          if (word !== null) leaks.push(`${item.signId} [${mode}, seed ${String(seed)}] — “${word}”`);
        }
      }
    }
    expect(asked).toBeGreaterThan(3000);
    expect([...new Set(leaks)].slice(0, 12)).toEqual([]);
  });

  it('holds when the drill is filtered to one category, where every option is that colour', () => {
    const leaks: string[] = [];
    for (const category of Object.keys(REAL_LESSON)) {
      const pool = REAL_SIGNS.filter((sign) => sign.category === category);
      for (const seed of SEEDS.slice(0, 20)) {
        for (const item of buildDrill(realInput({ seed, signs: pool })).items) {
          const sign = REAL_BY_ID.get(item.signId);
          if (!sign) throw new Error(`unknown sign ${item.signId}`);
          const word = separator(
            sign,
            item.options.map((option) => option.text),
            item.correctIndex,
          );
          if (word !== null) leaks.push(`${item.signId} [${category}] — “${word}”`);
        }
      }
    }
    expect([...new Set(leaks)].slice(0, 12)).toEqual([]);
  });

  it('reaches outside the sign’s own category when the drill is not filtered', () => {
    const byId = new Map(REAL_SIGNS.map((sign) => [sign.id, sign]));
    const category = new Map(REAL_SIGNS.map((sign) => [sign.meaning, sign.category]));
    const inbred: string[] = [];
    for (const seed of SEEDS.slice(0, 20)) {
      for (const item of buildDrill(realInput({ seed })).items) {
        const own = byId.get(item.signId)?.category;
        const elsewhere = item.options.filter((option) => {
          const from = category.get(option.text);
          return from !== undefined && from !== own;
        });
        if (elsewhere.length === 0) inbred.push(`${item.signId} (seed ${String(seed)})`);
      }
    }
    expect([...new Set(inbred)].slice(0, 12)).toEqual([]);
  });

  it('still answers the sign with its own meaning, verbatim or clause-trimmed', () => {
    const byId = new Map(REAL_SIGNS.map((sign) => [sign.id, sign]));
    for (const item of buildDrill(realInput({ seed: 5 })).items) {
      const meaning = byId.get(item.signId)?.meaning ?? '';
      const answer = item.options[item.correctIndex]?.text ?? '';
      expect(answer.length).toBeGreaterThan(20);
      // Either the meaning as authored, or the same sentence with the clause
      // that describes the sign's own colour or shape lifted out of it.
      const kept = answer.replace(/^./, (c) => c.toLowerCase()).replace(/\.$/, '');
      expect(
        meaning.toLowerCase().includes(kept.toLowerCase()),
        `${item.signId}: “${answer}” is not this sign's meaning`,
      ).toBe(true);
    }
  });
});

describe('DEFAULT_DRILL_SIZE', () => {
  it('is the thirty signs the drill screen promises', () => {
    expect(DEFAULT_DRILL_SIZE).toBe(30);
  });
});
