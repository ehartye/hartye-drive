import type { ReactNode } from 'react';
import { SignSvg } from './SignSvg';
import { Button } from './Button';

/* -------------------------------------------------------------- EmptyState */

export interface EmptyStateProps {
  title: string;
  body: string;
  /** A sign from the registry, used as the illustration. Decorative. */
  signId?: string;
  action?: ReactNode;
  /** `1` where this state IS the page, so headings never skip a level (A10). */
  headingLevel?: 1 | 2;
}

/** An empty surface should read as an invitation, not a failure. */
export function EmptyState({
  title,
  body,
  signId = 'guide-destination',
  action,
  headingLevel = 2,
}: EmptyStateProps) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  return (
    <div className="state">
      <SignSvg id={signId} size="lg" decorative />
      <Heading className="mt-4">{title}</Heading>
      <p className="dim">{body}</p>
      {action && <div className="state__actions">{action}</div>}
    </div>
  );
}

/* -------------------------------------------------------------- ErrorState */

export interface ErrorStateProps {
  title: string;
  body: string;
  /** Detail a learner can act on or quote — never a raw stack. */
  detail?: string;
  onRetry?: () => void;
  retryLabel?: string;
  secondaryAction?: ReactNode;
  /** `1` where this state IS the page, so headings never skip a level (A10). */
  headingLevel?: 1 | 2;
}

/**
 * Recoverable, never a white screen (practices C3). A warning diamond rather
 * than the octagon: recoverable is not a hard stop — that distinction is
 * exactly what §2 intends by the two shapes.
 */
export function ErrorState({
  title,
  body,
  detail,
  onRetry,
  retryLabel = 'Try again',
  secondaryAction,
  headingLevel = 2,
}: ErrorStateProps) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  return (
    <div className="state" role="alert">
      <SignSvg id="curve-right" size="lg" decorative />
      <Heading className="mt-4">{title}</Heading>
      <p className="dim">{body}</p>
      {detail && <p className="faint text-[0.75rem] font-mono mb-5">{detail}</p>}
      <div className="state__actions">
        {onRetry && (
          <Button variant="guide" onClick={onRetry}>
            {retryLabel}
          </Button>
        )}
        {secondaryAction}
      </div>
    </div>
  );
}

/* --------------------------------------------------------- LoadingSkeleton */

export interface LoadingSkeletonProps {
  lines?: number;
  /** Skeletons on a coloured sign face need the white-translucent shimmer. */
  onSign?: boolean;
  label?: string;
}

export function LoadingSkeleton({
  lines = 3,
  onSign = false,
  label = 'Loading',
}: LoadingSkeletonProps) {
  const widths = ['100%', '82%', '64%', '91%', '73%'];
  return (
    <div role="status" aria-live="polite" aria-label={label} className="grid gap-2.5">
      {Array.from({ length: lines }, (_, i) => (
        <span
          key={`skel-${String(i)}`}
          className={['skel', onSign ? 'skel--onsign' : ''].filter(Boolean).join(' ')}
          style={{ height: '0.85rem', width: widths[i % widths.length] }}
        />
      ))}
    </div>
  );
}
