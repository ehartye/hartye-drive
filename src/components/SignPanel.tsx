import type { ElementType, ReactNode } from 'react';

/**
 * `work` — construction orange, for content that *moved*: the post-2022
 * corrections the app must disclose rather than apply silently. Added by P4
 * from mockup `03b`; recorded in `deviations.md` because §3 enumerates the
 * panel variants.
 */
export type PanelVariant = 'plain' | 'guide' | 'stop' | 'warn' | 'route' | 'work';

export interface SignPanelProps {
  variant?: PanelVariant;
  /** Drops the retroreflective sheen — for quiet surfaces that are not sign faces. */
  flat?: boolean;
  as?: ElementType;
  className?: string;
  children: ReactNode;
  /** Passed through so a panel can be an accessible region. */
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

/**
 * The surface. A sign face under headlights: a soft off-axis sheen plus fine
 * glass-bead grain, both pure CSS (grounding §2 texture). Applied to sign
 * artifacts only — never to whole pages.
 */
export function SignPanel({
  variant = 'plain',
  flat = false,
  as: Tag = 'div',
  className,
  children,
  ...rest
}: SignPanelProps) {
  const classes = [
    'panel',
    variant === 'plain' ? '' : `panel--${variant}`,
    flat ? 'panel--flat' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Tag className={classes} {...rest}>
      {children}
    </Tag>
  );
}
