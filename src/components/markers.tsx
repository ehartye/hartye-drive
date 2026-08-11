import type { ReactNode } from 'react';

/* ------------------------------------------------------------- MileMarker */

export interface MileMarkerProps {
  /** 1-based position. Only use this where an ordered sequence genuinely exists. */
  index: number;
  total: number;
}

/**
 * Position in a session. Numbering (01/02/03) is permitted only in the exam
 * simulator and the study session, where order is real — never on the
 * dashboard (grounding §2).
 */
export function MileMarker({ index, total }: MileMarkerProps) {
  return (
    <span className="row gap-2">
      <span className="milemarker" aria-hidden="true">
        <span className="milemarker__lab">MILE</span>
        <span className="milemarker__val">{String(index).padStart(2, '0')}</span>
      </span>
      <span className="num dim text-[0.8125rem]">of {total}</span>
      <span className="sr-only">
        Question {index} of {total}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------ RouteShield */

export interface RouteShieldProps {
  /** The number on the shield. Mastery level — not decoration (grounding §2). */
  value: number | string;
  locked?: boolean;
  size?: 'md' | 'lg';
  /** What the number means. The shield is a graphic; it needs a name. */
  label: string;
}

export function RouteShield({ value, locked = false, size = 'md', label }: RouteShieldProps) {
  const classes = ['shield', locked ? 'shield--locked' : '', size === 'lg' ? 'shield--lg' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <span className={classes} role="img" aria-label={label}>
      <span aria-hidden="true">{value}</span>
    </span>
  );
}

/* ---------------------------------------------------------------- StatTile */

export interface StatTileProps {
  value: ReactNode;
  label: string;
}

export function StatTile({ value, label }: StatTileProps) {
  return (
    <div className="tile">
      <span className="tile__val">{value}</span>
      <span className="tile__lab">{label}</span>
    </div>
  );
}
