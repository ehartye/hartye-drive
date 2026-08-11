import type { ElementType, ReactNode } from 'react';

export interface VisuallyHiddenProps {
  children: ReactNode;
  as?: ElementType;
}

/** In the accessibility tree, out of the layout. */
export function VisuallyHidden({ children, as: Tag = 'span' }: VisuallyHiddenProps) {
  return <Tag className="sr-only">{children}</Tag>;
}
