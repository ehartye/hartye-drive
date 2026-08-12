import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from './routes';

const at = (path: string) =>
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);

/**
 * These render on a clean profile, so the Study destination is P7's onboarding
 * — matrix note 1: "onboarding **is** the empty state of the app". Its heading
 * is the marquee, not the word "Study"; the destination's *title* is still
 * `Study · TN Drive`, which is what the A14 assertion below checks.
 * `src/routes/Dashboard.test.tsx` covers the same route once setup is answered.
 */
describe('routing (grounding §4)', () => {
  it('sends the bare root to the study destination', async () => {
    at('/');
    expect(
      await screen.findByRole('heading', { level: 1, name: /Pass the.*knowledge test/s }),
    ).toBeInTheDocument();
  });

  /**
   * The headings are the real pages', not P1's placeholders — `/progress` was
   * superseded by P8 the same way `/signs` was by P6. On a clean profile the
   * progress page is its empty state, and that state's heading is an invitation
   * rather than the word "Progress".
   *
   * `/settings` and `/rules/:id` are absent because both are code-split, and
   * react-router's lazy loading cannot be driven under jsdom (see the note
   * further down). Their route entries are asserted below and their rendered
   * pages in the real browser by `tests/e2e/settings.spec.ts`,
   * `tests/e2e/rules.spec.ts` and `tests/a11y/axe.spec.ts`, all of which derive
   * their route lists from the table itself.
   */
  it.each([
    ['/study', /Pass the.*knowledge test/s],
    ['/exam', 'Mock exam'],
    ['/signs', 'Sign library'],
    ['/progress', /set off yet/],
  ])('renders %s', async (path, heading) => {
    at(path);
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
  });

  it('gives every route a unique, descriptive document title (practices A14)', async () => {
    for (const [path, expected] of [
      ['/study', 'Study · TN Drive'],
      ['/exam', 'Mock exam · TN Drive'],
      ['/signs', 'Sign library · TN Drive'],
      ['/progress', 'Progress · TN Drive'],
    ] as const) {
      const view = at(path);
      await screen.findByRole('heading', { level: 1 });
      expect(document.title).toBe(expected);
      view.unmount();
    }
  });

  it('shows the nav shell on every destination', async () => {
    at('/signs');
    await screen.findByRole('heading', { level: 1 });
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getAllByRole('link')).toHaveLength(4);
  });

  it('lands an unknown deep link on a recoverable screen, never a white one', async () => {
    at('/nowhere-at-all');
    expect(await screen.findByRole('heading', { level: 1, name: /Wrong turn/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to studying/ })).toBeInTheDocument();
  });

  /**
   * The gallery and the focus demo are code-split (practices E7), and
   * react-router's lazy loading cannot be driven under jsdom — its data router
   * builds a `Request` whose `AbortSignal` undici rejects as foreign. So the
   * route *table* is asserted here and the rendered page is asserted in the
   * real browser by `tests/a11y/axe.spec.ts` and `tests/e2e/foundation.spec.ts`,
   * which both navigate to `/gallery` and `/gallery/focus`.
   */
  it('exposes the gallery, code-split, so the whole system can be screenshotted at once', () => {
    const shell = routes[0];
    const gallery = shell?.children?.find((r) => r.path === 'gallery');
    expect(gallery?.lazy).toBeTypeOf('function');
    expect(shell?.HydrateFallback).toBeTypeOf('function');
    expect(routes.find((r) => r.path === '/gallery/focus')?.lazy).toBeTypeOf('function');
  });

  /** Focus modes are code-split for the same reason, and asserted the same way. */
  it('code-splits every focus mode, including the sign drill', () => {
    for (const path of ['/study/session', '/exam/run', '/signs/drill']) {
      expect(routes.find((r) => r.path === path)?.lazy, path).toBeTypeOf('function');
    }
  });

  /**
   * P8's two: settings is not a nav destination, and the rule reference is the
   * only surface that needs all three large content files at once. Neither
   * belongs in the bundle a learner downloads to answer their first question.
   */
  it('code-splits settings and the rule reference', () => {
    const children = routes[0]?.children ?? [];
    for (const path of ['settings', 'rules/:id']) {
      expect(children.find((r) => r.path === path)?.lazy, path).toBeTypeOf('function');
    }
  });

  /**
   * The rule reference takes a parameter, so `servablePaths()` cannot navigate
   * it without an example value — and throws rather than skipping it, which is
   * what stops a parameterised route from silently leaving every sweep.
   */
  it('serves the rule reference through a registered example rule id', async () => {
    const { servablePaths } = await import('./route-paths');
    expect(servablePaths()).toContain('/rules/R225');
    expect(() =>
      servablePaths([{ path: '/unregistered/:thing' }]),
    ).toThrow(/EXAMPLE_PARAMS/);
  });
});

describe('the gallery page itself', () => {
  it('renders the design system under a single h1', async () => {
    const { Gallery } = await import('~/routes/Gallery');
    render(
      <RouterProvider
        router={createMemoryRouter([{ path: '/', element: <Gallery /> }], {
          initialEntries: ['/'],
        })}
      />,
    );
    const h1s = await screen.findAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveAccessibleName('Design system');
  });
});
