import { Link } from 'react-router';
import type { ReactNode } from 'react';
import { IconArrowLeft, IconCloud, IconCloudOff } from './Icon';

/* ------------------------------------------------------------ OfflineBadge */

export interface OfflineBadgeProps {
  /** `false` when the device itself has no connection. */
  online?: boolean;
}

/**
 * Everything works at zero bytes of network, so the default state is a promise
 * ("Offline ready"), not a warning. It only changes voice when the device is
 * genuinely offline — and even then it is not an error.
 */
export function OfflineBadge({ online = true }: OfflineBadgeProps) {
  return online ? (
    <span className="badge badge--offline" title="Everything works without a connection">
      <IconCloud size={13} />
      Offline ready
    </span>
  ) : (
    <span className="badge badge--offline">
      <IconCloudOff size={13} />
      Offline
    </span>
  );
}

/* ------------------------------------------------------------------ AppBar */

export interface AppBarProps {
  title: string;
  /** Hidden below 900px, where the title and badge need the whole bar. */
  context?: string;
  backTo?: string;
  /**
   * For a page with no single parent. The rule reference is reached from a
   * study explanation, an exam review, the sign library and another rule, so
   * its "up" is genuinely "where you came from" and a fixed `backTo` would send
   * three of those four learners somewhere they had not been.
   */
  onBack?: () => void;
  backLabel?: string;
  online?: boolean;
  /** Replaces the badge, for the rare bar that needs a different trailing slot. */
  trailing?: ReactNode;
}

/**
 * ONE pattern across the whole product (grounding §3):
 *   `[ optional back-link · page title · context line ]  ——  offline badge`
 * The brand is **never** here. `AppNav` renders it at the head of the side rail.
 */
export function AppBar({
  title,
  context,
  backTo,
  onBack,
  backLabel = 'Back',
  online = true,
  trailing,
}: AppBarProps) {
  return (
    <header className="appbar">
      <div className="row appbar__lead">
        {backTo ? (
          <Link className="back" to={backTo}>
            <IconArrowLeft size={16} />
            {backLabel}
          </Link>
        ) : (
          onBack && (
            <button type="button" className="back" onClick={onBack}>
              <IconArrowLeft size={16} />
              {backLabel}
            </button>
          )
        )}
        <strong className="appbar__title">{title}</strong>
        {context && <span className="dim appbar__sub">{context}</span>}
      </div>
      {trailing ?? <OfflineBadge online={online} />}
    </header>
  );
}
