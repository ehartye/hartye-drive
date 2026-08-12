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
      out.push({ id, category, meaning: `The meaning of ${id}, spelled out in full.` });
    }
  }
  return out;
}

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

  it('draws its distractors from signs the learner could plausibly confuse', () => {
    // Same category first: a yellow diamond answered against three green guide
    // meanings is not a test of anything.
    const byId = new Map(SIGNS.map((s) => [s.id, s]));
    const meanings = new Map(SIGNS.map((s) => [s.meaning, s.category]));
    for (const item of plan.items) {
      const own = byId.get(item.signId)?.category;
      const sameCategory = item.options.filter((o) => meanings.get(o.text) === own).length;
      expect(sameCategory).toBe(DRILL_CHOICE_COUNT);
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

describe('DEFAULT_DRILL_SIZE', () => {
  it('is the thirty signs the drill screen promises', () => {
    expect(DEFAULT_DRILL_SIZE).toBe(30);
  });
});
