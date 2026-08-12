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
/**
 * Example values for the routes that take a parameter.
 *
 * A dynamic segment cannot be navigated without one, and silently skipping it
 * would recreate the exact coverage hole this module exists to close. So a
 * parameterised route must be registered here, by its full pattern, before the
 * sweeps will serve it — and `walk` throws if it is not. Adding
 * `/rules/:id` without adding a real rule id therefore fails the suite rather
 * than quietly shrinking it.
 *
 * One value per route, not several: `tests/e2e/foundation.spec.ts` asserts that
 * every servable path carries a unique document title, and two rules would
 * legitimately produce two different titles only because they are two different
 * rules. The other rule ids are exercised by `tests/e2e/rules.spec.ts`.
 */
const EXAMPLE_PARAMS: Record<string, readonly string[]> = {
  // R225 — the railroad stopping distance. Cited by real questions, carries
  // related signs, and is the rule mockup 10 is drawn around.
  '/rules/:id': ['R225'],
};

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
      const pattern = join(parent, segment);
      const examples = EXAMPLE_PARAMS[pattern];
      if (!examples || examples.length === 0) {
        throw new Error(
          `route-paths: "${pattern}" takes a parameter. Add an example value to EXAMPLE_PARAMS ` +
            `so the sweeps keep covering every route.`,
        );
      }
      for (const example of examples) {
        out.push(pattern.replace(/:[^/]+/, encodeURIComponent(example)));
      }
      continue;
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
