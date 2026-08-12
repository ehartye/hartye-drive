/**
 * The gate has to be provably strict, or it is decoration.
 *
 * `tests/fixtures/sign-audit/` holds one whole audit input per assertion, each
 * built to break exactly one rule, plus a clean control. This suite drives
 * every fixture through the checker and requires:
 *
 *   - the clean control to produce no failures at all;
 *   - each broken fixture to produce the failure it was built for;
 *   - **every** code in `AUDIT_CODES` to have a fixture, so a rule cannot be
 *     added without evidence that it fires.
 *
 * `npm run audit:signs` runs the same fixtures on every invocation and fails if
 * any assertion has gone quiet, so this contract is enforced from both sides.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { AUDIT_CODES, auditSigns } from './audit';
import type { AuditCode, AuditInput } from './audit';

const FIXTURES = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../tests/fixtures/sign-audit',
);

interface Fixture {
  note: string;
  expect: AuditCode | null;
  input: AuditInput;
}

const files = readdirSync(FIXTURES)
  .filter((name) => name.endsWith('.json'))
  .sort();

const load = (name: string): Fixture =>
  JSON.parse(readFileSync(path.join(FIXTURES, name), 'utf8')) as Fixture;

describe('sign registry audit (executable-floor.md 3b)', () => {
  it('has a fixture for every assertion it makes', () => {
    const covered = new Set(
      files.map((name) => load(name).expect).filter((code): code is AuditCode => code !== null),
    );
    expect([...AUDIT_CODES].filter((code) => !covered.has(code))).toEqual([]);
  });

  it('finds the fixtures at all', () => {
    // One per code plus the clean control is the floor, not the ceiling: a rule
    // with more than one way to break it gets more than one fixture, named
    // `<code>--<variant>.json`.
    expect(files.length).toBeGreaterThanOrEqual(AUDIT_CODES.length + 1);
  });

  it.each(files.map((name) => [name] as const))('%s fails exactly as designed', (name) => {
    const fixture = load(name);
    const failures = auditSigns(fixture.input);
    if (fixture.expect === null) {
      expect(failures, fixture.note).toEqual([]);
      return;
    }
    expect(failures.map((failure) => failure.code), fixture.note).toContain(fixture.expect);
    // Every failure carries a subject and a message a human can act on.
    for (const failure of failures) {
      expect(failure.subject).not.toBe('');
      expect(failure.message.length).toBeGreaterThan(10);
    }
  });

  it('is not a rubber stamp: mutating the control breaks it', () => {
    const control = load('clean.json').input;
    expect(auditSigns(control)).toEqual([]);
    const mutated: AuditInput = {
      ...control,
      rendered: control.rendered.map((sign, i) =>
        i === 0 ? { ...sign, paints: [...sign.paints, '#ee5fa7'] } : sign,
      ),
    };
    expect(auditSigns(mutated).map((f) => f.code)).toContain('color-painted-not-declared');
  });
});
