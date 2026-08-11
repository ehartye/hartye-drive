/**
 * The design system as an executable contract.
 *
 * P1's whole job is that every downstream piece inherits one visual truth, so
 * the tokens, the font policy and the focus policy are asserted against the
 * stylesheet source rather than a rendered DOM — jsdom does not resolve
 * Tailwind's @theme, but the bar's claim ("tokens match §2 exactly") is a claim
 * about the source, and this is where a drift would actually be caught.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ROOT = path.resolve(__dirname, '..', '..');
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8');

const theme = read('src/styles/theme.css');
const fonts = read('src/styles/fonts.css');
const base = read('src/styles/base.css');
const components = read('src/styles/components.css');

/** grounding §2 — every token, with its exact value. */
const TOKENS: ReadonlyArray<readonly [string, string]> = [
  ['--color-asphalt', '#14161a'],
  ['--color-asphalt-raised', '#1c1f25'],
  ['--color-asphalt-sunk', '#101216'],
  ['--color-shoulder', '#2a2f38'],
  ['--color-shoulder-lit', '#3a414d'],
  ['--color-guide', '#04684e'],
  ['--color-guide-lit', '#0a8f6c'],
  ['--color-guide-deep', '#033f30'],
  ['--color-sign-white', '#f2f4f1'],
  ['--color-sign-dim', '#9ba3ae'],
  ['--color-sign-faint', '#808894'],
  ['--color-warning', '#ffcc00'],
  ['--color-stop', '#b4151c'],
  ['--color-stop-lit', '#d8232a'],
  ['--color-work', '#e35205'],
  ['--color-route', '#003f87'],
  ['--color-route-lit', '#2c6fc4'],
  ['--color-school', '#c7ea00'],
  ['--color-incident', '#ee5fa7'],
  // The accessible text tokens — the other half of the two-job rule.
  ['--color-guide-text', '#2fbf95'],
  ['--color-stop-text', '#ff6b70'],
  ['--color-work-text', '#ff8a4c'],
  ['--color-route-text', '#6ba6f5'],
  // Type roles.
  ['--font-ui', "'Overpass', system-ui, sans-serif"],
  ['--font-mono', "'Overpass Mono', ui-monospace, monospace"],
  ['--font-read', "'Newsreader', Georgia, serif"],
];

describe('token layer (grounding §2)', () => {
  it.each(TOKENS)('declares %s: %s', (token, value) => {
    expect(theme).toContain(`${token}: ${value};`);
  });

  it('declares the tokens inside a Tailwind v4 @theme layer', () => {
    expect(theme).toMatch(/@theme\s*\{/);
  });

  it('keeps school (fluorescent yellow-green) distinct from incident (pink)', () => {
    // Conflating these is a factual error in the curriculum, not a style choice.
    expect(theme).toContain('--color-school: #c7ea00;');
    expect(theme).toContain('--color-incident: #ee5fa7;');
    expect(theme).not.toContain('--color-school: #ee5fa7');
  });

  it('never sets body text in the MUTCD greens/reds (the two-job rule)', () => {
    // §2: "Never set body text in --color-guide-lit or --color-stop-lit" —
    // measured 4.45:1 and 3.64:1 on asphalt, both under the 4.5:1 the project
    // commits to. Rules whose subject is an `svg` are exempt: a graphic's bar
    // is 3:1 (SC 1.4.11), and the MUTCD hue is the point on the nav icon.
    const offenders: string[] = [];
    for (const [, selector, body] of components.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const target = (selector ?? '').trim();
      if (target.startsWith('@') || /\bsvg\b/.test(target)) continue;
      for (const [, token] of (body ?? '').matchAll(/(?<!-)\bcolor:\s*var\((--color-[\w-]+)\)/g)) {
        if (token === '--color-guide-lit' || token === '--color-stop-lit') {
          offenders.push(`${target} { color: var(${token}) }`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('typography (grounding §2)', () => {
  it('sets reading copy at >=17px with >=1.6 line-height', () => {
    const block = components.match(/\.read\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(block).toContain('font-size: 1.0625rem'); // 17px
    expect(block).toContain('line-height: 1.65');
    expect(block).toContain('var(--font-read)');
  });

  it('sets question stems in the gothic face, not the serif', () => {
    const block = components.match(/\.stem\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(block).toContain('var(--font-ui)');
  });

  it('gives numerals tabular figures', () => {
    expect(components).toMatch(/\.num\s*\{[^}]*font-variant-numeric:\s*tabular-nums/);
  });
});

describe('self-hosted fonts (grounding §2, practices F5)', () => {
  const FILES = [
    'overpass-latin.woff2',
    'overpass-mono-latin.woff2',
    'newsreader-latin.woff2',
    'newsreader-italic-latin.woff2',
  ];

  it.each(FILES)('ships public/fonts/%s', (file) => {
    const p = path.join(ROOT, 'public', 'fonts', file);
    expect(existsSync(p), `${file} is missing — run npm run fonts:fetch`).toBe(true);
    expect(statSync(p).size).toBeGreaterThan(4096);
  });

  it('declares every face with font-display: swap and a local /fonts/ url', () => {
    const faces = [...fonts.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1] ?? '');
    expect(faces).toHaveLength(4);
    for (const face of faces) {
      expect(face).toContain('font-display: swap');
      expect(face).toMatch(/url\('\/fonts\/[\w-]+\.woff2'\)\s*format\('woff2'\)/);
    }
  });

  it('makes zero references to a font CDN anywhere in src/ or index.html', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (/\.(ts|tsx|css|html)$/.test(entry.name)) {
          const body = readFileSync(full, 'utf8');
          if (/fonts\.googleapis\.com|fonts\.gstatic\.com|use\.typekit|cdn\.jsdelivr/.test(body)) {
            offenders.push(path.relative(ROOT, full));
          }
        }
      }
    };
    walk(path.join(ROOT, 'src'));
    const html = read('index.html');
    if (/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(html)) offenders.push('index.html');
    expect(offenders).toEqual([]);
  });
});

describe('focus + motion policy (grounding §5, practices A6/A13)', () => {
  it('never removes an outline anywhere in the stylesheets', () => {
    for (const [name, css] of [
      ['base.css', base],
      ['components.css', components],
      ['theme.css', theme],
    ] as const) {
      expect(/outline:\s*(none|0)\b/.test(css), `${name} removes an outline`).toBe(false);
    }
  });

  it('gives every interactive element a visible focus ring', () => {
    expect(base).toMatch(/:focus-visible\s*\{[^}]*outline:\s*3px solid var\(--color-warning\)/);
  });

  it('honours prefers-reduced-motion globally', () => {
    expect(base).toContain('@media (prefers-reduced-motion: reduce)');
    expect(base).toMatch(/animation-duration:\s*0\.001ms\s*!important/);
    expect(base).toMatch(/transition-duration:\s*0\.001ms\s*!important/);
  });
});

describe('the ChoiceRow specificity trap (grounding §3)', () => {
  it('excludes the judged states from the achromatic picked styling', () => {
    // [aria-pressed] outranks .choice--correct. Without the :not()s a CORRECT
    // answer renders white on the one screen where the learner got it right.
    expect(components).toContain(
      ".choice[aria-pressed='true']:not(.choice--correct):not(.choice--wrong) {",
    );
    const naked = /\.choice\[aria-pressed='true'\]\s*\{/.test(components);
    expect(naked, 'an unguarded .choice[aria-pressed] rule would override the verdict').toBe(false);
  });
});
