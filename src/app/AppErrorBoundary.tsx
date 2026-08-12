/**
 * The last line of defence against a white screen (practices C6).
 *
 * `routes.tsx` already gives every route an `errorElement`, but that only
 * catches throws *inside* a route element. A throw in the router itself, in a
 * store's first synchronous read, or in anything mounted beside the router,
 * unmounts the whole tree and leaves the learner staring at `#root` — the one
 * outcome grounding §6 forbids. This boundary sits above all of it.
 *
 * It offers two ways out, in order of how much they cost: reload (almost always
 * enough, because the app is stateless between loads), then clear the app's own
 * saved keys — never `localStorage.clear()`, which would take another site's
 * data with it.
 */
import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Button, ErrorState } from '~/components';
import { STORAGE_KEY } from '~/domain/persistence';
import { EXAM_STORAGE_KEY } from '~/domain/exam-history';
import { SETUP_STORAGE_KEY } from '~/domain/setup';
import { SIGN_STORAGE_KEY } from '~/domain/sign-progress';
import { PREFERENCES_STORAGE_KEY } from '~/domain/settings';

/** Every key the app owns. Nothing outside this list is ever touched. */
const OWNED_KEYS = [
  STORAGE_KEY,
  EXAM_STORAGE_KEY,
  SIGN_STORAGE_KEY,
  SETUP_STORAGE_KEY,
  PREFERENCES_STORAGE_KEY,
] as const;

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Never throws: it runs precisely when storage is the thing misbehaving. */
function forgetOwnedKeys(): void {
  for (const key of OWNED_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Private mode or a blocked origin. There is nothing to clear, and
      // nothing useful to say about it here.
    }
  }
}

export class AppErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // No telemetry — nothing leaves the device (practices B2/B4). The console
    // is the only recipient, and it is where a learner reporting a fault is
    // asked to look.
    console.error('TN Drive could not render:', error, info.componentStack);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <main className="wrap pt-6">
        <ErrorState
          headingLevel={1}
          title="This screen could not be drawn"
          body="Nothing was lost — your progress lives on this device, not on a server. Reloading usually clears it."
          detail={error.message}
          onRetry={() => {
            window.location.reload();
          }}
          retryLabel="Reload"
          secondaryAction={
            <Button
              variant="quiet"
              onClick={() => {
                forgetOwnedKeys();
                window.location.reload();
              }}
            >
              Clear saved progress and start over
            </Button>
          }
        />
      </main>
    );
  }
}
