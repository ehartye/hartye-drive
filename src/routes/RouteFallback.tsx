import { AppBar, LoadingSkeleton, SignPanel } from '~/components';

/**
 * Shown while a code-split route chunk resolves. Routes are split so the
 * initial bundle stays inside the offline weight budget (practices E7), and a
 * split route must never flash a blank page on the way in.
 */
export function RouteFallback() {
  return (
    <>
      <AppBar title="Loading" context="Fetching this screen from the device" />
      <main className="wrap pt-6">
        <h1 className="sr-only">Loading</h1>
        <SignPanel flat>
          <LoadingSkeleton lines={5} label="Loading this screen" />
        </SignPanel>
      </main>
    </>
  );
}
