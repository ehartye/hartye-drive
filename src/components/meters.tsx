import { bandLabel, masteryBand, masteryPercent } from '~/domain/mastery';
import type { MasteryBand } from '~/domain/mastery';

/* ------------------------------------------------------------ ProgressRail */

export type RailTone = 'guide' | 'warn' | 'stop';

export interface ProgressRailProps {
  value: number;
  max: number;
  /** Required: a bare rail is meaningless to anyone who cannot see it. */
  label: string;
  tone?: RailTone;
  className?: string;
}

const TONE_CLASS: Record<RailTone, string> = {
  guide: '',
  warn: 'rail--warn',
  stop: 'rail--stop',
};

/** Lane striping — progress rails and dividers (grounding §2). */
export function ProgressRail({ value, max, label, tone = 'guide', className }: ProgressRailProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const classes = ['rail', TONE_CLASS[tone], className ?? ''].filter(Boolean).join(' ');

  return (
    <div
      className={classes}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label}
    >
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

/* -------------------------------------------------------------- TopicMeter */

export interface TopicMeterProps {
  name: string;
  correct: number;
  total: number;
  /** Optional trailing note, e.g. "last seen today". */
  note?: string;
}

const BAND_TONE: Record<MasteryBand, RailTone> = {
  guide: 'guide',
  warn: 'warn',
  stop: 'stop',
};

/**
 * Head + rail. The head states the numbers **in text**, so the rail is
 * `aria-hidden` — the bar is never the only carrier of the reading (§3, §5).
 * Thresholds: ≥80% guide · 50–79% warn · <50% stop.
 */
export function TopicMeter({ name, correct, total, note }: TopicMeterProps) {
  const percent = masteryPercent(correct, total);
  const band = masteryBand(percent);
  const tone = BAND_TONE[band];

  return (
    <div className="meter">
      <div className="meter__head">
        <span className="meter__name">{name}</span>
        {/* The band is stated visibly under the rail, in text. A second,
            visually-hidden copy here made a screen reader read it twice. */}
        <span className="meter__val">{`${correct} / ${total} · ${percent}%`}</span>
      </div>
      <div
        className={['rail', 'meter__bar', TONE_CLASS[tone]].filter(Boolean).join(' ')}
        aria-hidden="true"
      >
        <i style={{ width: `${percent}%` }} />
      </div>
      <p className="text-[0.75rem] mt-1.5 dim">
        <span
          className={
            band === 'guide' ? 'ok' : band === 'warn' ? 'text-warning' : 'text-stop-text'
          }
        >
          {bandLabel(band)}
        </span>
        {note ? ` · ${note}` : ''}
      </p>
    </div>
  );
}
