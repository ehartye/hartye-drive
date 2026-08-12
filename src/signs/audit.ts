/**
 * The sign-registry audit — `executable-floor.md` §3b, run by
 * `npm run audit:signs`.
 *
 * Phase 1 shipped a school sign in the wrong colour, a railroad advance warning
 * with a `+` instead of an `X`, and a YIELD with its colours inverted. Each was
 * caught only because a critic happened to look closely. **Review is not a
 * control for this**, so sign correctness gets a build gate.
 *
 * This module is the checker, and it is deliberately pure: it takes a registry,
 * the question bank, and *facts measured from a real rendering* — the colours
 * each face painted, and every `<text>` node's bounding box tested against the
 * face outline in a browser — and returns failures. Nothing here renders,
 * launches a browser or touches the filesystem, so every rule can be driven
 * from a fixture that proves it fails (`tests/fixtures/sign-audit/`).
 */
import { scoreCitationSupport } from '../../scripts/lib/citation-support.mjs';
import type { SignEntry, SignRegistry } from '~/content/types';
import { describeOutline, measureOutline, outlineMatchesShape } from './outline';
import { MUTCD_COLORS, colorLabel, shapeLabel } from './registry';

/** The floor `executable-floor.md` sets for the registry. */
export const MIN_DRAWN_SIGNS = 80;

/**
 * How much of its own declared face outline a sign must actually paint.
 *
 * Below this the outline is not the face — and since the shape check and the
 * legend-containment check are both measured *against* that outline, an
 * unpainted outline would make both of them vacuous. Not 100%: a rounded corner
 * legitimately leaves a sliver of the sharp-cornered outline unpainted.
 */
export const MIN_FACE_COVERAGE = 0.9;

/** MUTCD 2009 designations: R1-1, R1-3P, W13-1P, R5-1a, OM3-L, I-13, G20-2. */
const MUTCD_PATTERN = /^(?:OM|[A-Z]{1,2})-?\d+(?:-\d+)?[a-zA-Z]?(?:-[A-Z])?$/;

export interface TextBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface TextMeasurement {
  readonly text: string;
  /** Every corner of the measured box lies inside the declared face outline. */
  readonly contained: boolean;
  readonly box: TextBox;
  /** The `fill` the browser computed for this node, as `#rrggbb`. */
  readonly fill: string;
  /**
   * The paint directly beneath this legend, or `null` where nothing is. It is
   * what tells a legend painted in the face colour by mistake from one knocked
   * out of a legend-coloured shape on purpose — the black words inside the
   * white arrow of R6-1 ONE WAY are the sign, not a defect.
   */
  readonly under: string | null;
  /**
   * The rendered width this was measured at, e.g. `220px` or `36px`. Every
   * legend is measured twice — once on the contact sheet and once at the
   * smallest size the app ships (`.sign--sm`) — because SVG scales geometry
   * linearly but font hinting does not, so "fits at 200px" is not the same
   * claim as "fits".
   */
  readonly at: string;
}

/**
 * What a real browser found painted **inside a sign's declared face outline**,
 * sampled on a grid, topmost paint winning at each point.
 *
 * This is the measurement the colour check was missing. Set membership — every
 * declared colour appears somewhere, nothing undeclared appears — is satisfied
 * identically by a white sign with a red legend and a red sign with a white
 * legend, which is exactly the YIELD defect Phase 1 shipped. Area tells them
 * apart: the colour covering the face *is* the face colour.
 */
export interface FacePaint {
  /** Grid points that fell inside the declared face outline. */
  readonly samples: number;
  /** Of those, how many carry no paint at all. */
  readonly unpainted: number;
  /** `#rrggbb` → how many sample points that paint covers. */
  readonly fills: Readonly<Record<string, number>>;
}

/** What one sign actually rendered, as measured rather than as intended. */
export interface RenderedSign {
  readonly id: string;
  /** False when the geometry map has no face for this registry id. */
  readonly drawn: boolean;
  /** Every `fill`/`stroke` value the SVG carries, lower-cased, `none` dropped. */
  readonly paints: readonly string[];
  readonly texts: readonly TextMeasurement[];
  /** The face outline the geometry publishes, as SVG path data. */
  readonly faceOutline: string;
  readonly facePaint: FacePaint;
  /** `aria-label` as `SignSvg` renders it in labelled mode. */
  readonly name: string;
  /** `aria-label` as `SignSvg` renders it in drill mode. */
  readonly drillName: string;
}

export interface AuditQuestion {
  readonly id: string;
  readonly stem: string;
  readonly options: readonly { readonly text: string }[];
  readonly correctIndex: number;
  readonly signs?: readonly string[] | undefined;
}

export interface AuditInput {
  readonly registry: SignRegistry;
  readonly rendered: readonly RenderedSign[];
  readonly questions: readonly AuditQuestion[];
  /**
   * How many drawn faces the registry must carry. Defaults to the floor the
   * bar sets; the regression fixtures lower it so that a two-sign input can
   * exercise one rule without every fixture also tripping the floor.
   */
  readonly minDrawn?: number | undefined;
}

export interface AuditFailure {
  readonly code: AuditCode;
  readonly subject: string;
  readonly message: string;
}

/**
 * Every assertion this gate makes. Enumerated at runtime on purpose: the test
 * suite requires a regression fixture for each one, so a rule cannot be added
 * without proof that it fails on something.
 */
export const AUDIT_CODES = [
  'mutcd-missing',
  'geometry-missing',
  'sign-floor',
  'color-declared-not-painted',
  'color-painted-not-declared',
  'face-color-mismatch',
  'legend-color-mismatch',
  'shape-mismatch',
  'palette-unknown-token',
  'palette-dead-token',
  'legend-overflow',
  'name-incomplete',
  'drill-name-leaks-meaning',
  'question-contradiction',
] as const;

export type AuditCode = (typeof AUDIT_CODES)[number];

/** Colours the audit tolerates as "not a colour": absence, and nothing else. */
const NON_COLORS = new Set(['none', 'transparent']);

const hex = (token: string): string | undefined =>
  (MUTCD_COLORS as Record<string, string | undefined>)[token]?.toLowerCase();

/** Every palette token an entry declares for its own face. */
function declaredTokens(sign: SignEntry): string[] {
  return [sign.faceColor, sign.legendColor, ...(sign.accentColors ?? [])];
}

/** The tokens a legend is allowed to be painted in: the legend, and accents. */
function legendTokens(sign: SignEntry): string[] {
  return [sign.legendColor, ...(sign.accentColors ?? [])];
}

/**
 * The paint covering the most of the face outline. That is the face colour as
 * drawn, whatever the entry says it is.
 */
function dominantFill(paint: FacePaint): { readonly value: string; readonly share: number } | undefined {
  let best: { value: string; share: number } | undefined;
  for (const [value, count] of Object.entries(paint.fills)) {
    const share = paint.samples === 0 ? 0 : count / paint.samples;
    if (best === undefined || share > best.share) best = { value: value.toLowerCase(), share };
  }
  return best;
}

const percent = (value: number): string => `${(value * 100).toFixed(0)}%`;

const words = (text: string): string[] => text.toLowerCase().match(/[a-z]{5,}/g) ?? [];

/**
 * Words carried by a sign's own legend. Shorter than `words` deliberately: a
 * drill name that says "STOP" or "ONE WAY" has handed over the answer, and
 * those are four and three letters.
 */
const legendWords = (text: string): string[] => text.toLowerCase().match(/[a-z]{3,}/g) ?? [];

/**
 * Words a name must contain to "state the meaning". Comparing the whole
 * sentence would pass on a name that merely appends it; comparing content words
 * catches a drill name that leaks the answer in paraphrase.
 *
 * Words the shape and colour labels already contain are excluded, because a
 * drill name is *required* to say them: "Diamond, orange" does not leak the
 * meaning of a sign whose meaning happens to mention orange.
 */
function meaningWords(sign: SignEntry): string[] {
  const said = new Set([
    ...words(shapeLabel(sign.shape)),
    ...words(colorLabel(sign.faceColor)),
    ...words(colorLabel(sign.legendColor)),
  ]);
  return [...new Set(words(sign.meaning))].filter((word) => !said.has(word));
}

export function auditSigns(input: AuditInput): AuditFailure[] {
  const failures: AuditFailure[] = [];
  const fail = (code: AuditCode, subject: string, message: string) => {
    failures.push({ code, subject, message });
  };

  const palette = new Set(input.registry.palette);
  const byId = new Map(input.rendered.map((sign) => [sign.id, sign]));
  const usedTokens = new Set<string>();

  for (const sign of input.registry.signs) {
    /* -------------------------------------------------- MUTCD designation */
    if (!sign.mutcd || !MUTCD_PATTERN.test(sign.mutcd)) {
      fail(
        'mutcd-missing',
        sign.id,
        `MUTCD designation ${JSON.stringify(sign.mutcd)} is missing or malformed — a sign with no designation fails the build`,
      );
    }

    /* --------------------------------------------------- declared palette */
    for (const token of declaredTokens(sign)) {
      usedTokens.add(token);
      if (!palette.has(token)) {
        fail('palette-unknown-token', sign.id, `color "${token}" is outside the declared palette`);
      }
      if (hex(token) === undefined) {
        fail('palette-unknown-token', sign.id, `color "${token}" has no MUTCD value to render`);
      }
    }

    const rendered = byId.get(sign.id);
    if (!rendered?.drawn) {
      fail('geometry-missing', sign.id, 'registry entry has no hand-authored geometry');
      continue;
    }

    /* ------------------------------------------------------- paint vs. spec */
    const declaredHex = new Set(
      declaredTokens(sign)
        .map(hex)
        .filter((value): value is string => value !== undefined),
    );
    const painted = new Set(
      rendered.paints.map((p) => p.toLowerCase()).filter((p) => !NON_COLORS.has(p)),
    );

    for (const token of new Set(declaredTokens(sign))) {
      const value = hex(token);
      if (value !== undefined && !painted.has(value)) {
        fail(
          'color-declared-not-painted',
          sign.id,
          `declares "${token}" (${value}) but the rendered SVG never paints it`,
        );
      }
    }
    for (const value of painted) {
      if (!declaredHex.has(value)) {
        fail(
          'color-painted-not-declared',
          sign.id,
          `paints ${value}, which the entry does not declare (declared: ${[...declaredHex].join(', ')})`,
        );
      }
    }

    /* -------------------------------------------------- shape, as drawn
     *
     * The declaration cannot vouch for itself. `shape` used to be read only to
     * build the accessible name — which is generated *from* `shape` — so
     * changing `r1-1-stop` to `circle` with the octagon still on screen passed
     * the gate and renamed the sign "Circle, red — STOP…". This measures the
     * outline the geometry draws and asks whether it can be the declared shape.
     */
    const outline = measureOutline(rendered.faceOutline);
    if (!outlineMatchesShape(sign.shape, outline)) {
      fail(
        'shape-mismatch',
        sign.id,
        `declares shape "${sign.shape}" but the face it draws is ${describeOutline(outline)}`,
      );
    }

    // …and the outline itself is not taken on trust: the shape check and the
    // legend-containment check are both measured against it, so an outline the
    // sign does not actually paint would make both vacuous.
    const { samples, unpainted } = rendered.facePaint;
    if (samples === 0) {
      fail(
        'shape-mismatch',
        sign.id,
        'the declared face outline encloses no measurable area, so nothing about the shape was checked',
      );
    } else if ((samples - unpainted) / samples < MIN_FACE_COVERAGE) {
      fail(
        'shape-mismatch',
        sign.id,
        `the declared face outline is not the face on screen: only ${percent((samples - unpainted) / samples)} of it carries any paint (floor ${percent(MIN_FACE_COVERAGE)})`,
      );
    }

    /* ------------------------------------------------- colour roles, as drawn
     *
     * Set membership above is symmetric: "white face, red legend" and "red
     * face, white legend" declare the same two colours and satisfy it
     * identically. That is the YIELD defect Phase 1 shipped. Roles are what
     * distinguishes them, and roles are measured by area and by node.
     */
    const dominant = dominantFill(rendered.facePaint);
    const faceValue = hex(sign.faceColor);
    if (dominant !== undefined && faceValue !== undefined && dominant.value !== faceValue) {
      fail(
        'face-color-mismatch',
        sign.id,
        `declares faceColor "${sign.faceColor}" (${faceValue}) but ${dominant.value} covers ${percent(dominant.share)} of the face — the face is painted the wrong colour, or the two colours are inverted`,
      );
    }

    const legendValues = new Set(
      legendTokens(sign)
        .map(hex)
        .filter((value): value is string => value !== undefined),
    );
    for (const measured of rendered.texts) {
      const painted = measured.fill.toLowerCase();
      if (legendValues.has(painted)) continue;
      // A legend in the face colour, sitting on a legend-coloured shape, is a
      // knockout — R6-1 ONE WAY is exactly that and is drawn correctly. On the
      // face itself it is a legend that has gone the colour of its background.
      const knockout =
        painted === faceValue &&
        measured.under !== null &&
        legendValues.has(measured.under.toLowerCase());
      if (knockout) continue;
      fail(
        'legend-color-mismatch',
        sign.id,
        `legend ${JSON.stringify(measured.text)} is painted ${measured.fill} on ${measured.under ?? 'nothing'} at ${measured.at}, which is neither the declared legendColor "${sign.legendColor}" nor an accent (allowed: ${[...legendValues].join(', ')})`,
      );
    }

    /* ------------------------------------------------- legend containment */
    for (const measured of rendered.texts) {
      if (!measured.contained) {
        const { x, y, width, height } = measured.box;
        fail(
          'legend-overflow',
          sign.id,
          `legend ${JSON.stringify(measured.text)} measures ${width.toFixed(1)}×${height.toFixed(1)} at (${x.toFixed(1)}, ${y.toFixed(1)}) rendered at ${measured.at} and does not fit inside the face`,
        );
      }
    }

    /* ------------------------------------------- accessible names (A8) */
    const name = rendered.name.toLowerCase();
    const missing: string[] = [];
    if (!name.includes(shapeLabel(sign.shape).toLowerCase().split(' —')[0] ?? ''))
      missing.push(`shape (${shapeLabel(sign.shape)})`);
    if (!name.includes(colorLabel(sign.faceColor).toLowerCase()))
      missing.push(`colour (${colorLabel(sign.faceColor)})`);
    const distinctive = meaningWords(sign);
    if (!distinctive.every((word) => name.includes(word))) missing.push('meaning');
    if (missing.length > 0) {
      fail(
        'name-incomplete',
        sign.id,
        `accessible name must state shape AND colour AND meaning; ${missing.join(' and ')} absent from ${JSON.stringify(rendered.name)}`,
      );
    }

    const drill = rendered.drillName.toLowerCase();
    // Two ways a drill name hands over the answer: it paraphrases the meaning,
    // or it repeats the sign's own legend. The second is the one a generated
    // name walks into — "Octagon, red" is safe, "STOP sign, octagon, red" is
    // the answer written out, and the legend is measured, not declared.
    const spoken = new Set(rendered.texts.flatMap((measured) => legendWords(measured.text)));
    const leaks = [
      ...distinctive.filter((word) => drill.includes(word)),
      ...[...spoken].filter((word) => drill.includes(word)),
    ];
    if (drill.trim() === '') {
      fail('drill-name-leaks-meaning', sign.id, 'drill name is empty — the sign would be nameless');
    } else if (leaks.length > 0) {
      fail(
        'drill-name-leaks-meaning',
        sign.id,
        `drill name gives the answer away: ${JSON.stringify(rendered.drillName)} carries ${[...new Set(leaks)].join(', ')}`,
      );
    }
  }

  /* ------------------------------------------------------- dead palette */
  for (const token of palette) {
    if (!usedTokens.has(token)) {
      fail(
        'palette-dead-token',
        'registry',
        `palette declares "${token}" but no entry uses it — either draw a sign in it or drop it`,
      );
    }
  }

  /* ------------------------------------------------------------- floor */
  const floor = input.minDrawn ?? MIN_DRAWN_SIGNS;
  const drawn = input.registry.signs.filter((sign) => byId.get(sign.id)?.drawn).length;
  if (drawn < floor) {
    fail('sign-floor', 'registry', `${drawn} signs have geometry — the floor is ${floor}`);
  }

  failures.push(...auditMeaningsAgainstQuestions(input));
  return failures;
}

/**
 * A sign's declared meaning must not contradict a question that shows it.
 *
 * Reuses the question bank's own citation-support scorer with the sign's
 * meaning standing in for the quote, and keeps only the rules that mean
 * *contradiction*:
 *
 *   - the meaning names a number the keyed answer denies — always a failure,
 *     because a wrong number is what reaches a learner as a wrong answer;
 *   - the meaning argues for a distractor **decisively** — at least two
 *     distinctive words more than it gives the key.
 *
 * Two deliberate relaxations against the question-bank version of this check. A
 * citation is chosen to support one answer; a sign's meaning is not, and the
 * same sign legitimately rides beside questions about something else. So the
 * scorer's "says nothing that supports the key" rule is dropped entirely, and
 * dominance needs a real margin rather than one incidental word — without that,
 * STOP's meaning tripped on the word "only" in a distractor of a question about
 * ALL WAY plates. A gate that cries wolf gets switched off.
 */
const DOMINANCE_MARGIN = 2;

function auditMeaningsAgainstQuestions(input: AuditInput): AuditFailure[] {
  const meanings = new Map(input.registry.signs.map((sign) => [sign.id, sign.meaning]));
  const out: AuditFailure[] = [];

  for (const question of input.questions) {
    for (const signId of question.signs ?? []) {
      const meaning = meanings.get(signId);
      if (meaning === undefined) continue;
      const score = scoreCitationSupport({
        stem: question.stem,
        options: question.options.map((option) => ({ text: option.text })),
        correctIndex: question.correctIndex,
        citations: [{ quote: meaning }],
      });
      const decisive =
        score.maxDistractorOverlap >= DOMINANCE_MARGIN &&
        score.maxDistractorOverlap - score.keyedOverlap >= DOMINANCE_MARGIN;
      for (const problem of score.problems) {
        if (problem.code === 'no-keyed-support') continue;
        if (problem.code === 'distractor-dominant' && !decisive) continue;
        out.push({
          code: 'question-contradiction',
          subject: signId,
          message: `its meaning contradicts question ${question.id}: ${problem.message}`,
        });
      }
    }
  }
  return out;
}
