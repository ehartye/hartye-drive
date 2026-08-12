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
import { MUTCD_COLORS, colorLabel, shapeLabel } from './registry';

/** The floor `executable-floor.md` sets for the registry. */
export const MIN_DRAWN_SIGNS = 80;

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
}

/** What one sign actually rendered, as measured rather than as intended. */
export interface RenderedSign {
  readonly id: string;
  /** False when the geometry map has no face for this registry id. */
  readonly drawn: boolean;
  /** Every `fill`/`stroke` value the SVG carries, lower-cased, `none` dropped. */
  readonly paints: readonly string[];
  readonly texts: readonly TextMeasurement[];
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

const words = (text: string): string[] => text.toLowerCase().match(/[a-z]{5,}/g) ?? [];

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

    /* ------------------------------------------------- legend containment */
    for (const measured of rendered.texts) {
      if (!measured.contained) {
        const { x, y, width, height } = measured.box;
        fail(
          'legend-overflow',
          sign.id,
          `legend ${JSON.stringify(measured.text)} measures ${width.toFixed(1)}×${height.toFixed(1)} at (${x.toFixed(1)}, ${y.toFixed(1)}) and does not fit inside the face`,
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
    const leaks = distinctive.filter((word) => drill.includes(word));
    if (drill.trim() === '') {
      fail('drill-name-leaks-meaning', sign.id, 'drill name is empty — the sign would be nameless');
    } else if (leaks.length > 0) {
      fail(
        'drill-name-leaks-meaning',
        sign.id,
        `drill name gives the answer away: ${JSON.stringify(rendered.drillName)} carries ${leaks.join(', ')}`,
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
