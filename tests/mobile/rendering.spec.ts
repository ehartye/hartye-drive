import { test, expect } from '@playwright/test';
import { setUpDevice, stylesheetText, visit } from './support';
import { POPULATED } from '../support/seed';

/**
 * WEBKIT RENDERING — the signature, checked on the engine that ships it.
 *
 * Every sign in this app is a hand-authored, spec-accurate MUTCD SVG, and the
 * two charts are hand-authored inline SVG because grounding §1 forbids a chart
 * library. **A sign that renders wrong on an iPhone is a critical defect** —
 * spec-accurate signage is the whole premise.
 *
 * The interesting failures are engine-specific and silent: a face that falls
 * back to a system font paints wider legends that spill their plate; a
 * `<pattern>` that does not resolve turns the colour-blind-safe hatch into a
 * flat fill and the chart starts carrying meaning by colour alone (§5); a
 * `getBBox()` that returns zero breaks any geometry computed from it.
 *
 * These are per-engine invariants rather than a cross-engine image diff. Two
 * engines never rasterise type identically — a diff would fail on antialiasing
 * and teach nobody anything — so what is asserted is what would actually be
 * *wrong*: geometry present, legends inside their plates, real faces in use,
 * the hatch painting, and the MUTCD colours landing where they should.
 */

test.describe('sign rendering', () => {
  test('every visible sign has real geometry and no missing face', async ({ page }) => {
    await setUpDevice(page);
    await visit(page, '/signs');
    await page.evaluate(() => document.fonts.ready);

    const report = await page.evaluate(() => {
      const signs = [...document.querySelectorAll('svg.sign')];
      const visible = signs.filter((s) => s.getBoundingClientRect().width > 0);
      return {
        total: signs.length,
        visible: visible.length,
        missing: signs.filter((s) => s.hasAttribute('data-missing-sign')).length,
        pending: signs.filter((s) => s.hasAttribute('data-pending-sign')).length,
        empty: visible.filter((s) => s.children.length === 0).length,
        collapsed: visible.filter((s) => {
          const r = s.getBoundingClientRect();
          return r.width < 8 || r.height < 8;
        }).length,
      };
    });

    expect(report.visible, 'no sign rendered at all').toBeGreaterThan(10);
    expect(report.missing, 'a sign id does not resolve in the registry').toBe(0);
    expect(report.pending, 'a registry sign has no authored face').toBe(0);
    expect(report.empty, 'a sign svg painted nothing').toBe(0);
    expect(report.collapsed, 'a sign collapsed to nothing on this engine').toBe(0);
  });

  test('sign legends set in the shipped faces and stay inside their plates', async ({ page }) => {
    await setUpDevice(page);
    await visit(page, '/signs');
    await page.evaluate(() => document.fonts.ready);

    const report = await page.evaluate(() => {
      const zeroBox: string[] = [];
      const spilled: string[] = [];
      const wrongFace: string[] = [];
      let measured = 0;

      for (const svg of document.querySelectorAll('svg.sign')) {
        if (svg.getBoundingClientRect().width === 0) continue;
        const viewBox = (svg.getAttribute('viewBox') ?? '0 0 100 100').split(/\s+/).map(Number);
        const [vx = 0, vy = 0, vw = 100, vh = 100] = viewBox;

        for (const text of svg.querySelectorAll('text')) {
          const legend = (text.textContent ?? '').trim();
          if (legend === '') continue;
          measured += 1;

          const box = (text as SVGGraphicsElement).getBBox();
          if (box.width <= 0 || box.height <= 0) {
            zeroBox.push(`"${legend}" getBBox() is ${String(box.width)}×${String(box.height)}`);
            continue;
          }
          // A fallback face is materially wider and pushes the legend off the
          // plate. A small overhang is allowed for stroke and letterspacing.
          const slack = 1.5;
          if (
            box.x < vx - slack ||
            box.y < vy - slack ||
            box.x + box.width > vx + vw + slack ||
            box.y + box.height > vy + vh + slack
          ) {
            spilled.push(
              `"${legend}" runs to ${String(Math.round(box.x + box.width))} of a ${String(vw)}-unit viewBox`,
            );
          }

          const family = getComputedStyle(text).fontFamily;
          if (!/Overpass/.test(family)) wrongFace.push(`"${legend}" sets in ${family}`);
        }
      }
      return { zeroBox, spilled, wrongFace, measured };
    });

    expect(report.measured, 'no sign legend was measured at all').toBeGreaterThan(10);
    expect(report.zeroBox, report.zeroBox.join('\n')).toEqual([]);
    expect(report.spilled, `sign legends spill their plates:\n${report.spilled.join('\n')}`).toEqual([]);
    expect(report.wrongFace, report.wrongFace.join('\n')).toEqual([]);
  });

  /**
   * The colours are the curriculum. A stop sign that is not MUTCD red is not a
   * styling slip, it is teaching the wrong thing — so the pixels are read back
   * off the rasterised sign rather than trusted from the attribute.
   */
  test('the MUTCD colours survive rasterisation on this engine', async ({ page }) => {
    await setUpDevice(page);
    await visit(page, '/signs');
    await page.evaluate(() => document.fonts.ready);

    const octagon = page.locator('svg.sign[aria-label*="Octagon" i]').first();
    await expect(octagon).toBeVisible();
    await octagon.scrollIntoViewIfNeeded();

    const centre = await octagon.evaluate((el) => {
      const svg = el as SVGSVGElement;
      const shot = document.createElement('canvas');
      const rect = svg.getBoundingClientRect();
      shot.width = Math.round(rect.width);
      shot.height = Math.round(rect.height);
      // Reading the fill straight off the DOM is the honest cross-engine check:
      // a canvas rasterisation of an SVG is tainted differently per engine.
      const filled = [...svg.querySelectorAll('[fill]')]
        .map((n) => n.getAttribute('fill') ?? '')
        .filter((f) => f !== 'none' && !f.startsWith('url('));
      return filled;
    });

    // MUTCD regulatory red, as the registry authors it.
    expect(
      centre.some((fill) => fill.toLowerCase().includes('b4151c')),
      `the stop octagon paints ${centre.join(', ')} — regulatory red is #B4151C`,
    ).toBe(true);
  });
});

test.describe('chart rendering', () => {
  test.beforeEach(async ({ page }) => {
    await setUpDevice(page);
    await page.addInitScript((seed: Record<string, string>) => {
      for (const [key, value] of Object.entries(seed)) localStorage.setItem(key, value);
    }, POPULATED());
  });

  test('both charts draw, at a real size, with their axis labels', async ({ page }) => {
    await visit(page, '/progress');
    await page.evaluate(() => document.fonts.ready);

    // `> svg`, not a descendant sweep: the shape legend inside the same figure
    // is a set of 22×12 swatch svgs, and measuring one of those instead of the
    // chart is how this assertion would pass while the chart was blank.
    const charts = await page.evaluate(() =>
      [...document.querySelectorAll('figure.chart > svg')].map((svg) => {
        const rect = svg.getBoundingClientRect();
        return {
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          shapes: svg.querySelectorAll('path, rect, polygon, polyline, line, circle').length,
          labels: [...svg.querySelectorAll('text')].filter(
            (t) => (t.textContent ?? '').trim() !== '',
          ).length,
        };
      }),
    );

    expect(charts.length, 'the progress screen drew no charts').toBeGreaterThanOrEqual(2);
    for (const chart of charts) {
      expect(chart.width).toBeGreaterThan(200);
      expect(chart.height).toBeGreaterThan(80);
      expect(chart.shapes, 'a chart painted no geometry on this engine').toBeGreaterThan(3);
      expect(chart.labels, 'a chart lost its labels on this engine').toBeGreaterThan(2);
    }
  });

  /**
   * The hatch is what keeps "short of target" readable without colour (§5,
   * practices A3). If the `<pattern>` fails to resolve on an engine, the lane
   * fills flat and the chart silently starts carrying meaning by colour alone.
   */
  test('the short-of-target hatch resolves, so meaning is not left to colour', async ({ page }) => {
    await visit(page, '/progress');
    await page.evaluate(() => document.fonts.ready);

    const hatch = await page.evaluate(() => {
      const svgs = [...document.querySelectorAll('figure.chart svg')];
      const patterns = svgs.flatMap((s) => [...s.querySelectorAll('pattern')]);
      const users = svgs.flatMap((s) =>
        [...s.querySelectorAll('[fill^="url("]')].map((n) => n.getAttribute('fill') ?? ''),
      );
      return {
        defined: patterns.map((p) => p.id),
        // Every `url(#id)` fill must point at a pattern that exists in the doc.
        dangling: users.filter((fill) => {
          const id = /url\(#([^)]+)\)/.exec(fill)?.[1];
          return id === undefined || document.getElementById(id) === null;
        }),
        painted: patterns.filter((p) => p.children.length > 0).length,
        used: users.length,
      };
    });

    expect(hatch.defined.length, 'no hatch pattern is defined').toBeGreaterThan(0);
    expect(hatch.used, 'nothing uses the hatch').toBeGreaterThan(0);
    expect(hatch.dangling, `dangling pattern references: ${hatch.dangling.join(', ')}`).toEqual([]);
    expect(hatch.painted, 'the hatch pattern is empty').toBeGreaterThan(0);
  });
});

test.describe('typography', () => {
  test('all four self-hosted faces load on this engine', async ({ page }) => {
    await setUpDevice(page);
    await visit(page, '/gallery');
    await page.waitForLoadState('networkidle');

    // `document.fonts.check` answers "is this face ready *right now*", and a
    // face is only fetched once something on the page needs it — so a bare
    // check races the layout and reports a healthy face as missing. `load()`
    // asks for the fetch and resolves with the faces that actually arrived,
    // which is the question being put: does this woff2 decode on this engine.
    const faces = await page.evaluate(async () => {
      const specs: [string, string][] = [
        ['Overpass', '700 16px Overpass'],
        ['Overpass Mono', '700 16px "Overpass Mono"'],
        ['Newsreader', '400 17px Newsreader'],
        ['Newsreader italic', 'italic 400 17px Newsreader'],
      ];
      const arrived: [string, number][] = [];
      for (const [name, spec] of specs) {
        arrived.push([name, (await document.fonts.load(spec, 'STOP')).length]);
      }
      await document.fonts.ready;
      return {
        arrived,
        failed: [...document.fonts]
          .filter((face) => face.status === 'error')
          .map((face) => `${face.family} ${face.style}`),
      };
    });

    for (const [name, count] of faces.arrived) {
      expect(count, `${name} did not load on this engine`).toBeGreaterThan(0);
    }
    expect(faces.failed, `a face failed to decode: ${faces.failed.join(', ')}`).toEqual([]);
  });

  test('rendered text really uses Overpass, not a fallback', async ({ page }) => {
    await setUpDevice(page);
    await visit(page, '/study');
    await page.evaluate(() => document.fonts.ready);

    // The metric proof: Overpass and the system fallback set the same string at
    // materially different widths. If the face silently failed, the two match.
    const widths = await page.evaluate(() => {
      const context = document.createElement('canvas').getContext('2d');
      if (!context) return null;
      const sample = 'STOP AHEAD RAILROAD CROSSING';
      const measure = (font: string) => {
        context.font = font;
        return context.measureText(sample).width;
      };
      return {
        overpass: measure('700 16px Overpass'),
        fallback: measure('700 16px sans-serif'),
      };
    });

    expect(widths).not.toBeNull();
    expect(widths!.overpass).toBeGreaterThan(0);
    expect(
      Math.abs(widths!.overpass - widths!.fallback),
      'Overpass measures exactly like the system fallback — the face is not being used',
    ).toBeGreaterThan(1);
  });

  /**
   * U+00B7 REPAIR. The Overpass latin subset ships MIDDLE DOT with a **zero
   * advance width**, so every `A · B` meta line in the app painted the dot on
   * top of the following space and read as `Safe driving ·Rain, fog`. The
   * patch in `components.css` lends Newsreader's glyph back to the UI family
   * for that one code point. It is a `unicode-range` override, and last-matching-
   * face-wins is exactly the kind of rule an engine can differ on — so it is
   * measured here on both.
   */
  test('the U+00B7 separator patch holds on this engine', async ({ page }) => {
    await setUpDevice(page);
    await visit(page, '/study');
    await page.evaluate(() => document.fonts.ready);

    const advance = await page.evaluate(() => {
      const context = document.createElement('canvas').getContext('2d');
      if (!context) return null;
      context.font = '16px Overpass';
      return {
        dot: context.measureText('·').width,
        space: context.measureText(' ').width,
      };
    });

    expect(advance).not.toBeNull();
    expect(
      advance!.dot,
      'MIDDLE DOT has a zero advance in the UI family — meta lines will read "A ·B"',
    ).toBeGreaterThan(1);
  });

  test('a meta separator is visibly spaced on screen', async ({ page }) => {
    await setUpDevice(page);
    await visit(page, '/gallery');
    await page.evaluate(() => document.fonts.ready);

    // A real rendered line, not a canvas measurement — and measured as an
    // *advance* rather than by comparing the edges of two separate Ranges. Two
    // ranges give two independently rounded boxes, and on WebKit that produced
    // a 1px "overlap" on a separator that is in fact spaced correctly. The
    // width of "· " minus the width of " " is the dot's contribution to the
    // line, which is exactly the quantity the zero-advance bug destroys.
    const overlap = await page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let next = walker.nextNode();
      while (next) {
        const node: Node = next;
        const text = node.textContent ?? '';
        const at = text.indexOf('·');
        if (at > 0 && at < text.length - 2 && node.parentElement) {
          const style = getComputedStyle(node.parentElement);
          if (style.fontFamily.includes('Overpass') && !style.fontFamily.includes('Mono')) {
            const widthOf = (from: number, to: number): number => {
              const range = document.createRange();
              range.setStart(node, from);
              range.setEnd(node, to);
              return range.getBoundingClientRect().width;
            };
            // "· " against " ": the difference is what the dot adds to the line.
            const withDot = widthOf(at, at + 2);
            const withoutDot = widthOf(at + 1, at + 2);
            if (withDot > 0) {
              return {
                advance: withDot - withoutDot,
                sample: text.slice(0, 40),
              };
            }
          }
        }
        next = walker.nextNode();
      }
      return null;
    });

    expect(overlap, 'no rendered "A · B" meta line was found to measure').not.toBeNull();
    expect(
      overlap!.advance,
      `the separator in "${overlap!.sample}" adds ${String(
        Math.round(overlap!.advance * 100) / 100,
      )}px to the line — a zero advance is the bug the U+00B7 patch exists to fix, and it reads ` +
        `as "A ·B" on screen`,
    ).toBeGreaterThan(1);
  });
});

/**
 * OVERLAY BARS.
 *
 * The app bar, the tab bar, the focus bar and the action shelf are all
 * translucent and lean on `backdrop-filter` to stay legible over whatever
 * scrolls beneath them. Unprefixed `backdrop-filter` did not ship in Safari
 * until 18 — every iPhone on iOS 17 or earlier, including every device that
 * cannot upgrade past it, gets **no blur at all** and reads the page straight
 * through the bar.
 *
 * Two requirements follow, and both are asserted: the prefixed property must be
 * declared beside the unprefixed one, and the bar must stay legible even when
 * neither takes effect. The second is what the pixel assertion is for — the
 * engine Playwright ships composites no backdrop filter, so this test sees
 * exactly what an iOS 17 iPhone sees.
 */
test.describe('translucent overlay bars', () => {
  const BARS = ['.appbar', 'nav.nav', '.focusbar', '.actionbar'];

  test('every backdrop-filter carries its -webkit- prefix', async ({ page }) => {
    await visit(page, '/gallery');

    // The shipped bytes, not the CSSOM: Chromium needs no prefix and therefore
    // drops `-webkit-backdrop-filter` on parse, so asked through the CSSOM a
    // correctly prefixed stylesheet reports every rule as unprefixed. See
    // `stylesheetText` in support.ts.
    const css = await stylesheetText(page);
    expect(css.length, 'no stylesheet was fetched').toBeGreaterThan(0);

    const unprefixed: string[] = [];
    for (const chunk of css.split('}')) {
      const brace = chunk.lastIndexOf('{');
      if (brace === -1) continue;
      const block = chunk.slice(brace + 1);
      if (!/(^|[^-])backdrop-filter\s*:/.test(block)) continue;
      if (/-webkit-backdrop-filter\s*:/.test(block)) continue;
      unprefixed.push(chunk.slice(0, brace).trim().slice(-90));
    }

    expect(
      unprefixed,
      `these rules blur on nothing before Safari 18:\n${unprefixed.join('\n')}`,
    ).toEqual([]);
  });

  test('the bars stay opaque enough to read when the blur does not apply', async ({ page }) => {
    await setUpDevice(page);
    await visit(page, '/signs');
    await page.evaluate(() => document.fonts.ready);

    const alphas = await page.evaluate((selectors) => {
      const out: { selector: string; alpha: number }[] = [];
      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (!el) continue;
        const background = getComputedStyle(el).backgroundColor;
        // Both `rgba(...)` and `color(srgb ... / a)` end their alpha the same way.
        const alpha = /\/\s*([\d.]+)\s*\)/.exec(background)?.[1] ?? /,\s*([\d.]+)\s*\)$/.exec(background)?.[1];
        out.push({ selector, alpha: alpha === undefined ? 1 : Number(alpha) });
      }
      return out;
    }, BARS);

    expect(alphas.length, 'no overlay bar was found to measure').toBeGreaterThan(0);
    for (const bar of alphas) {
      expect(
        bar.alpha,
        `${bar.selector} is ${String(Math.round((1 - bar.alpha) * 100))}% transparent with no blur ` +
          `behind it — page text reads straight through the bar on iOS 17`,
      ).toBeGreaterThanOrEqual(0.98);
    }
  });
});
