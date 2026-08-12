/**
 * practices C6 — an error boundary wraps the app and renders the recoverable
 * error state.
 *
 * The router has its own `errorElement` (`RouteError`), but it only catches
 * what happens *inside* a route. A throw in `RouterProvider` itself, in a
 * store's initial read, or in anything mounted beside the router, escapes it
 * and leaves a white screen — which is the one outcome grounding §6 forbids.
 * This boundary is the floor under all of that.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppErrorBoundary } from './AppErrorBoundary';

function Boom({ throws }: { throws: boolean }): React.ReactElement {
  if (throws) throw new Error('the sky fell');
  return <p>the app</p>;
}

describe('AppErrorBoundary', () => {
  beforeEach(() => {
    // React logs the caught error itself; the test asserts on the rendered
    // screen, not on the console, so the expected noise is silenced.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders its children when nothing throws', () => {
    render(
      <AppErrorBoundary>
        <Boom throws={false} />
      </AppErrorBoundary>,
    );
    expect(screen.getByText('the app')).toBeInTheDocument();
  });

  it('renders the recoverable error state instead of a white screen', () => {
    render(
      <AppErrorBoundary>
        <Boom throws />
      </AppErrorBoundary>,
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'This screen could not be drawn',
    );
    // The learner is told their work survived, and is given a way out.
    expect(screen.getByText(/lives on this device/)).toBeInTheDocument();
    expect(screen.getByText('the sky fell')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('offers a reset that clears only the keys the app owns', async () => {
    localStorage.setItem('tn-drive:progress', '{"garbage":true}');
    localStorage.setItem('someone-elses-key', 'keep me');

    render(
      <AppErrorBoundary>
        <Boom throws />
      </AppErrorBoundary>,
    );
    await userEvent.click(screen.getByRole('button', { name: /Clear saved progress/ }));

    expect(localStorage.getItem('tn-drive:progress')).toBeNull();
    expect(localStorage.getItem('someone-elses-key')).toBe('keep me');
  });

  it('survives a reset when storage itself is the thing that is broken', async () => {
    const setItem = vi
      .spyOn(Storage.prototype, 'removeItem')
      .mockImplementation(() => {
        throw new Error('storage is disabled');
      });

    render(
      <AppErrorBoundary>
        <Boom throws />
      </AppErrorBoundary>,
    );
    await userEvent.click(screen.getByRole('button', { name: /Clear saved progress/ }));

    // No unhandled throw; the screen is still there.
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    setItem.mockRestore();
  });
});
