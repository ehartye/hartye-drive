import { formatClock } from '~/domain/mastery';
import { SignSvg } from './SignSvg';
import { IconCheck, IconX } from './Icon';

/* -------------------------------------------------------------------- Timer */

export interface TimerProps {
  secondsRemaining: number;
  /** Below this the instrument warns. Five minutes by default. */
  lowThresholdSeconds?: number;
}

/**
 * The 60-minute limit is essential to the simulation and is disclosed before
 * the timer starts (WCAG 2.2 SC 2.2.1 exception, practices A15) — the
 * disclosure belongs to the exam flow; this is only the instrument.
 */
export function Timer({ secondsRemaining, lowThresholdSeconds = 300 }: TimerProps) {
  const low = secondsRemaining <= lowThresholdSeconds;
  const label = low ? 'Time left · under 5 min' : 'Time left';
  return (
    <span className={['timer', low ? 'timer--low' : ''].filter(Boolean).join(' ')}>
      <span className="timer__val">{formatClock(secondsRemaining)}</span>
      <span className="timer__lab">{label}</span>
    </span>
  );
}

/* ------------------------------------------------------------ StrikeCounter */

export interface StrikeCounterProps {
  used: number;
  /** Tennessee ends the attempt at seven wrong. */
  limit?: number;
}

/** Glanceable at all times, and readable as text, not only as pips. */
export function StrikeCounter({ used, limit = 7 }: StrikeCounterProps) {
  const clamped = Math.min(Math.max(used, 0), limit);
  return (
    <span className="strikes">
      <span className="strikes__pips" aria-hidden="true">
        {Array.from({ length: limit }, (_, i) => (
          <span
            key={`pip-${String(i)}`}
            className={['strikes__pip', i < clamped ? 'strikes__pip--used' : '']
              .filter(Boolean)
              .join(' ')}
          />
        ))}
      </span>
      <span className="strikes__txt">{`${clamped} / ${limit} wrong`}</span>
    </span>
  );
}

/* --------------------------------------------------------------- VerdictSign */

export type VerdictVariant = 'pass' | 'short' | 'halted';

export interface VerdictSignProps {
  variant: VerdictVariant;
  score: number;
  outOf: number;
}

const VERDICT_COPY: Record<VerdictVariant, { legend: string; word: string; sentence: string }> = {
  pass: {
    legend: 'Class D knowledge test · simulated',
    word: 'Passed',
    sentence: 'Passed the simulated Class D knowledge test',
  },
  short: {
    legend: '24 correct required to pass',
    word: 'Not yet',
    sentence: 'Fell short of the 24 correct needed to pass',
  },
  halted: {
    legend: 'Seven wrong ends the attempt',
    word: 'Ended early',
    sentence: 'Attempt ended early at seven wrong answers',
  },
};

/**
 * The signature moment of the exam flow, rendered as a sign face rather than a
 * heading: guide green for a pass ("you may proceed"), a white regulatory face
 * with a red legend for falling short ("this is the rule"), and the stop
 * octagon for an early termination.
 */
export function VerdictSign({ variant, score, outOf }: VerdictSignProps) {
  const copy = VERDICT_COPY[variant];
  const name = `${copy.sentence}: ${String(score)} of ${String(outOf)} correct`;

  return (
    <div className="grid justify-items-center gap-4">
      {variant === 'halted' && <SignSvg id="stop" size="xl" decorative />}
      <div className={`plaque plaque--${variant}`} role="img" aria-label={name}>
        <div className="plaque__face">
          <p className="plaque__legend" aria-hidden="true">
            {copy.legend}
          </p>
          <strong className="plaque__score" aria-hidden="true">
            {score}
          </strong>
          <p className="plaque__verdict" aria-hidden="true">
            {variant === 'pass' ? <IconCheck size={16} /> : <IconX size={16} />}
            {copy.word}
          </p>
        </div>
      </div>
      <p className="dim text-sm">{`${score} of ${outOf} correct · 24 needed to pass`}</p>
    </div>
  );
}
