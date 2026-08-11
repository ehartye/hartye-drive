/**
 * Mastery banding — the one rule the design system enforces numerically.
 *
 * `TopicMeter`'s thresholds (grounding §3) are a product contract, not a
 * styling detail: ≥80% guide, 50–79% warn, <50% stop. Every surface that shows
 * a topic — dashboard, progress, study, sign library — has to band identically
 * or the learner gets contradictory readings of the same number. It lives in
 * src/domain/ so it is testable without a DOM and gated at ≥90% coverage.
 */

export type MasteryBand = 'guide' | 'warn' | 'stop';

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Whole-percent accuracy for a topic. An untouched topic is 0, never NaN. */
export function masteryPercent(correct: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round(clamp(correct / total, 0, 1) * 100);
}

/** ≥80 guide · 50–79 warn · <50 stop. */
export function masteryBand(percent: number): MasteryBand {
  if (percent >= 80) return 'guide';
  if (percent >= 50) return 'warn';
  return 'stop';
}

/**
 * The word that travels with the colour. Colour is never the sole carrier of
 * meaning (§5), and a red/green-colourblind learner is squarely in the audience.
 */
export function bandLabel(band: MasteryBand): string {
  switch (band) {
    case 'guide':
      return 'Solid';
    case 'warn':
      return 'Review';
    case 'stop':
      return 'Weak';
  }
}

/** mm:ss for the exam timer. Tabular figures do the aligning; this does the maths. */
export function formatClock(totalSeconds: number): string {
  const s = Math.floor(clamp(totalSeconds, 0, Number.MAX_SAFE_INTEGER));
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
