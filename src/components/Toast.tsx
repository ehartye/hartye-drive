import type { ReactNode } from 'react';
import { IconX } from './Icon';

export type ToastTone = 'neutral' | 'guide' | 'warn' | 'stop';

export interface ToastProps {
  title: string;
  children?: ReactNode;
  tone?: ToastTone;
  onDismiss?: () => void;
}

/**
 * A transient notice. Polite, never assertive: nothing this component says is
 * urgent enough to interrupt a learner mid-question.
 */
export function Toast({ title, children, tone = 'neutral', onDismiss }: ToastProps) {
  return (
    <div
      className={['toast', tone === 'neutral' ? '' : `toast--${tone}`].filter(Boolean).join(' ')}
      role="status"
      aria-live="polite"
    >
      <div className="toast__body">
        <strong className="toast__title">{title}</strong>
        {children && <span className="dim">{children}</span>}
      </div>
      {onDismiss && (
        <button type="button" className="toast__dismiss" onClick={onDismiss}>
          <IconX size={14} />
          <span className="sr-only">Dismiss</span>
        </button>
      )}
    </div>
  );
}

/** Fixed dock, offset clear of the bottom nav on mobile and the rail on desktop. */
export function ToastDock({ children }: { children: ReactNode }) {
  return <div className="toastdock">{children}</div>;
}
