import type { ReactNode } from 'react';
import { MileMarker } from './markers';
import { ProgressRail } from './meters';
import { IconX } from './Icon';

export interface FocusChromeProps {
  /** e.g. "End session" / "End exam". Always explicit — never a silent escape. */
  exitLabel: string;
  onExit: () => void;
  progress?: { value: number; max: number; label: string };
  marker?: { index: number; total: number };
  /** Timer, strike counter — whatever the mode needs in the trailing slot. */
  instruments?: ReactNode;
  /** The sticky bottom action shelf that stands in for the hidden nav. */
  action?: ReactNode;
  children: ReactNode;
}

/**
 * Focus mode: the study session and the exam simulator are full-screen
 * (grounding §4). The nav is not rendered at all, and this component **owns the
 * nav offset** — so no page has to undo a body padding it did not set (§3).
 */
export function FocusChrome({
  exitLabel,
  onExit,
  progress,
  marker,
  instruments,
  action,
  children,
}: FocusChromeProps) {
  return (
    <div className="shell shell--focus">
      <header className="focusbar">
        <div className="focusbar__in">
          <div className="focusbar__row">
            <button type="button" className="exit" onClick={onExit}>
              <IconX size={16} />
              {exitLabel}
            </button>
            <div className="row gap-2">
              {marker && <MileMarker index={marker.index} total={marker.total} />}
              {instruments}
            </div>
          </div>
          {progress && (
            <ProgressRail
              value={progress.value}
              max={progress.max}
              label={progress.label}
              className="mt-3"
            />
          )}
        </div>
      </header>

      <main className="wrap pt-6">{children}</main>

      {action && (
        <div className="actionbar">
          <div className="actionbar__in">{action}</div>
        </div>
      )}
    </div>
  );
}
