import type { ReactNode, MouseEvent } from 'react';
import { Link } from 'react-router';

export type ButtonVariant = 'guide' | 'quiet' | 'danger';

interface CommonProps {
  variant?: ButtonVariant;
  /** Full-width, for the primary action at the foot of a screen. */
  block?: boolean;
  children: ReactNode;
  className?: string;
}

interface ActionProps extends CommonProps {
  type?: 'button' | 'submit';
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  /**
   * Rendered as `aria-disabled`, not the `disabled` attribute, so the control
   * stays in the tab order and a screen-reader user can reach the hint that
   * explains why it is unavailable (WCAG 2.2 SC 3.3.1).
   */
  disabled?: boolean;
  describedBy?: string;
}

interface LinkProps extends CommonProps {
  to: string;
}

export type ButtonProps = ActionProps | LinkProps;

export function Button(props: ButtonProps) {
  const { variant = 'guide', block = false, children, className } = props;
  const classes = ['btn', `btn--${variant}`, block ? 'btn--block' : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  if ('to' in props) {
    return (
      <Link to={props.to} className={classes}>
        {children}
      </Link>
    );
  }

  const { type = 'button', onClick, disabled = false, describedBy } = props;

  return (
    <button
      type={type}
      className={classes}
      aria-disabled={disabled || undefined}
      {...(describedBy ? { 'aria-describedby': describedBy } : {})}
      onClick={(event) => {
        if (disabled) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    >
      {children}
    </button>
  );
}
