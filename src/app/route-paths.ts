import type { RouteObject } from 'react-router';
import { routes } from './routes';

/**
 * Every concrete path the router actually serves, derived from the route table
 * itself.
 *
 * A hand-maintained list of routes in a test is a defect waiting to happen: the
 * one route that is forgotten is exactly the one that regresses, and the suite
 * stays green by omitting it. Anything a test wants to sweep across "all
 * destinations" reads this instead, so adding a route to `routes.tsx`
 * automatically widens the sweep.
 *
 * The catch-all (`*`) is excluded — it has no single path, and the not-found
 * screen is asserted directly by its own test.
 *
 * NOTE: `tests/e2e/foundation.spec.ts` imports this, and Playwright runs it in
 * plain Node — so everything `routes.tsx` reaches must be loadable there. A
 * `.css` import anywhere under `AppShell` would break the e2e suite; that is
 * why `src/main.tsx`, not the shell, owns the stylesheet. JSON imports carry
 * `with { type: 'json' }` for the same reason.
 */
function join(parent: string, segment: string): string {
  if (segment.startsWith('/')) return segment;
  const base = parent === '/' ? '' : parent;
  return `${base}/${segment}`;
}

function walk(table: readonly RouteObject[], parent: string, out: string[]): void {
  for (const route of table) {
    if (route.index === true) {
      out.push(parent);
      continue;
    }
    const segment = route.path;
    if (segment === undefined) {
      // Pathless layout route: it contributes nothing of its own.
      if (route.children) walk(route.children, parent, out);
      continue;
    }
    if (segment === '*' || segment.endsWith('/*')) continue;
    if (segment.includes(':')) {
      // Deliberate: a dynamic segment cannot be navigated without an example
      // value, and silently skipping it would recreate the coverage hole this
      // module exists to close.
      throw new Error(
        `route-paths: "${segment}" takes a parameter. Extend this helper with an example value ` +
          `so the sweeps keep covering every route.`,
      );
    }
    const path = join(parent, segment);
    if (route.children && route.children.length > 0) {
      walk(route.children, path, out);
      continue;
    }
    out.push(path);
  }
}

/** Sorted, de-duplicated. `/` is included: it is a real, servable path. */
export function servablePaths(table: readonly RouteObject[] = routes): string[] {
  const out: string[] = [];
  walk(table, '/', out);
  return [...new Set(out)].sort();
}
