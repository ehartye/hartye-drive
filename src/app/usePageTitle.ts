import { useEffect } from 'react';

/**
 * Each route gets a unique, descriptive title (WCAG 2.2 SC 2.4.2, practices
 * A14). A genuine side effect on a system outside React, so an effect is the
 * right tool here.
 */
export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} · TN Drive`;
  }, [title]);
}
