import { describe, expect, it } from 'vitest';
import { correctionDate } from './corrections';
import { corrections } from '~/content';

describe('how a correction dates itself', () => {
  it('says "in force" for a correction a public chapter commenced', () => {
    expect(
      correctionDate({
        effectiveDate: '2023-07-01',
        authority: 'Public Chapter 354 (2023) — Jabari Bailey Highway Safety Act (HB0092)',
      }),
    ).toEqual({ prefix: 'In force', iso: '2023-07-01' });
  });

  it('says "verified" when the authority itself calls the date a verification', () => {
    expect(
      correctionDate({
        effectiveDate: '2026-08-11',
        authority:
          'Tennessee Department of Safety and Homeland Security current testing policy (verified 2026-08-11)',
      }),
    ).toEqual({ prefix: 'Verified', iso: '2026-08-11' });
  });

  it('does not demote a commencement date that merely mentions a later check', () => {
    expect(
      correctionDate({
        effectiveDate: '2023-01-01',
        authority: 'Tenn. Code Ann. § 55-12-102 (verified 2026-07-01)',
      }).prefix,
    ).toBe('In force');
  });

  it('leaves exactly one of the shipped corrections dated by verification', () => {
    // A guard on the claim the settings page makes about the whole set: if a
    // second undated policy is ever added, this fails rather than the page
    // quietly asserting a commencement nobody published.
    const verified = corrections.filter((c) => correctionDate(c).prefix === 'Verified');
    expect(verified.map((c) => c.id)).toEqual(['knowledge-test-early-termination']);
  });
});
