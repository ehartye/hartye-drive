/**
 * The one channel between the service worker and the interface, and nothing
 * else. No import of `virtual:pwa-register` here, deliberately.
 *
 * `src/app/routes.tsx` has to stay loadable in plain Node — the e2e sweeps
 * derive their route list from it (`src/app/route-paths.ts`), and Node's ESM
 * loader refuses a `virtual:` specifier outright. `AppShell` renders the update
 * offer, so anything the offer imports is reachable from the route table. The
 * registration therefore lives in `service-worker.ts`, which only `main.tsx`
 * imports; this module holds the state both sides talk through.
 */

type Listener = () => void;

const listeners = new Set<Listener>();
let waiting = false;
let apply: (reloadPage?: boolean) => Promise<void> = () => Promise.resolve();

/** Called by the registration when a new build has installed and is waiting. */
export function markUpdateWaiting(): void {
  waiting = true;
  for (const listener of listeners) listener();
}

/** Called once by the registration, with the function that lets it through. */
export function setUpdateApplier(applier: (reloadPage?: boolean) => Promise<void>): void {
  apply = applier;
}

export function subscribeToUpdates(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** `true` once a new build is installed and waiting for permission to take over. */
export function isUpdateWaiting(): boolean {
  return waiting;
}

/**
 * Lets the waiting build through and reloads. The only caller is the button in
 * `UpdatePrompt` — nothing runs this on a timer or a route change (F4).
 */
export function applyUpdate(): void {
  void apply(true);
}
