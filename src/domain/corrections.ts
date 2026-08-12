/**
 * How a post-2022 correction dates itself.
 *
 * Every correction carries an `effectiveDate`, and for five of the six that is
 * a commencement date — the day a public chapter or a federal act took effect.
 * For the sixth it is not. The knowledge test's 7-miss early termination is
 * departmental testing policy; **no statute publishes a date for it**, so the
 * record stores the day the policy was checked and says so in its own
 * `authority` field ("… current testing policy (verified 2026-08-11)").
 *
 * Rendering that as "In force August 11, 2026" invents a commencement the State
 * of Tennessee never announced, on the one surface whose entire job is to be
 * straight about what the app knows and how it knows it. The correction data is
 * right; the label over it was not. The label is derived from the authority the
 * record already states rather than from a second field, so there is nothing to
 * keep in sync and no content file to change.
 *
 * Pure and DOM-free.
 */

export interface DatedCorrection {
  effectiveDate: string;
  authority: string;
}

export interface CorrectionDate {
  /** The word before the date. Never "In force" over a verification date. */
  prefix: 'In force' | 'Verified';
  iso: string;
}

/**
 * `true` when the authority itself records the same day as the date it was
 * *checked*. Matching on the authority's own text rather than a heuristic keeps
 * this honest: a correction only loses "In force" when its own source says the
 * date is a verification.
 */
function isVerificationDate({ effectiveDate, authority }: DatedCorrection): boolean {
  return new RegExp(`verified\\s+${effectiveDate}`, 'i').test(authority);
}

export function correctionDate(correction: DatedCorrection): CorrectionDate {
  return {
    prefix: isVerificationDate(correction) ? 'Verified' : 'In force',
    iso: correction.effectiveDate,
  };
}
