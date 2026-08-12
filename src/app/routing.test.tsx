import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from './routes';

const at = (path: string) =>
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);

describe('routing (grounding §4)', () => {
  it('sends the bare root to the study destination', async () => {
    at('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Study' })).toBeInTheDocument();
  });

  /**
   * The headings are the real pages', not P1's placeholders — `/progress` and
   * `/settings` were superseded by P8 the same way `/signs` was by P6. On a
   * clean profile the progress page is its empty state, and that state's
   * heading is an invitation rather than the word "Progress".
   */
  it.each([
    ['/study', 'Study'],
    ['/exam', 'Exam'],
    ['/signs', 'Sign library'],
    ['/progress', /set off yet/],
    ['/settings', /Settings/],
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
      ['/settings', 'Settings · TN Drive'],
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
