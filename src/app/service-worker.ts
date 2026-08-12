/// <reference types="vite-plugin-pwa/client" />
/**
 * Service-worker registration, and the one channel between it and the UI.
 *
 * Registration happens from `main.tsx`, at the root, **not** from a component.
 * The first version of this registered from `AppShell` and looked fine — until
 * the startup spec deep-linked straight into `/study/session`, which is routed
 * outside the shell, and found no worker at all. A learner who bookmarks the
 * study session, or opens the exam from a link, would never have installed the
 * app. Registration cannot be a child of one branch of the route table.
 *
 * The offer is still rendered from the shell (`ServiceWorkerUpdate`), which is
 * what keeps a banner off a question. The two concerns are simply split: the
 * worker registers everywhere, the prompt appears somewhere.
 *
 * Registration waits for `window.onload` (the `registerSW` default) rather than
 * running immediately, so `workbox-window` and the worker's install never
 * compete with the code that draws the first question (X23). Nothing about the
 * offline promise needs the worker a few hundred milliseconds sooner — the
 * visit it has to serve is the *next* one.
 */
import { registerSW } from 'virtual:pwa-register';

type Listener = () => void;

const listeners = new Set<Listener>();
let waiting = false;
let apply: (reloadPage?: boolean) => Promise<void> = () => Promise.resolve();

function announce(): void {
  for (const listener of listeners) listener();
}

/** Called once, from `main.tsx`. Safe to call in a browser with no SW support. */
export function startServiceWorker(): void {
  apply = registerSW({
    onNeedRefresh() {
      waiting = true;
      announce();
    },
  });
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
 * `UpdatePrompt` — nothing here runs on a timer or a route change (F4).
 */
export function applyUpdate(): void {
  void apply(true);
}
