import { useRouteError } from 'react-router';
import { AppBar, Button, EmptyState, ErrorState } from '~/components';
import { usePageTitle } from '~/app/usePageTitle';

/** A deep link that does not resolve. Offline-first means deep links matter. */
export function NotFound() {
  usePageTitle('Wrong turn');
  return (
    <>
      <AppBar title="Wrong turn" context="That page does not exist" />
      <main className="wrap pt-6">
        <EmptyState
          headingLevel={1}
          title="Wrong turn"
          body="There is nothing at that address. Everything you need is still here on the device."
          signId="d1-1-destination"
          action={
            <Button variant="guide" to="/study">
              Back to studying
            </Button>
          }
        />
      </main>
    </>
  );
}

/**
 * The router's own error boundary. A thrown render or a failed lazy chunk lands
 * here rather than on a blank page (practices C3/C6). P9 owns the full storage
 * corruption story; this is the floor under it.
 */
export function RouteError() {
  const error = useRouteError();
  const detail = error instanceof Error ? error.message : String(error);
  usePageTitle('Something went wrong');

  return (
    <>
      <AppBar title="Something went wrong" context="The app kept your progress" />
      <main className="wrap pt-6">
        <ErrorState
          headingLevel={1}
          title="This screen could not be drawn"
          body="Nothing was lost — your progress lives on this device, not on a server. Reloading usually clears it."
          detail={detail}
          onRetry={() => {
            window.location.reload();
          }}
          retryLabel="Reload"
        />
      </main>
    </>
  );
}
