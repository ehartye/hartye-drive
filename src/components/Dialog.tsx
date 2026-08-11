import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';

export interface DialogProps {
  open: boolean;
  title: string;
  /** `stop` for destructive confirmations. */
  tone?: 'neutral' | 'stop';
  onClose: () => void;
  children: ReactNode;
  /** Buttons. Laid out in the shelf at the foot of the dialog. */
  actions?: ReactNode;
}

/**
 * A native `<dialog>` (practices A16): the browser gives us the modal focus
 * trap, the inert backdrop, Escape-to-close and focus restoration for free.
 * Hand-rolling those is where accessible dialogs usually go wrong.
 */
export function Dialog({ open, title, tone = 'neutral', onClose, children, actions }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      restoreTo.current = document.activeElement as HTMLElement | null;
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handleClose = () => {
      // Restore focus to whatever opened the dialog. Focus must never be lost
      // to <body> after a state change (WCAG 2.2 SC 2.4.3, practices A5).
      restoreTo.current?.focus?.();
      onClose();
    };
    el.addEventListener('close', handleClose);
    return () => {
      el.removeEventListener('close', handleClose);
    };
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      className={['dialog', tone === 'stop' ? 'dialog--stop' : ''].filter(Boolean).join(' ')}
      aria-labelledby={titleId}
    >
      <div className="dialog__in">
        <h2 id={titleId}>{title}</h2>
        <div className="mt-2.5">{children}</div>
        {actions && <div className="dialog__actions">{actions}</div>}
      </div>
    </dialog>
  );
}
