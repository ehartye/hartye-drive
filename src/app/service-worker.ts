/// <reference types="vite-plugin-pwa/client" />
/**
 * Service-worker registration. Imported by `main.tsx` and by nothing else.
 *
 * Registration happens at the root, **not** from a component. The first version
 * of this registered from `AppShell` and looked fine — until the startup spec
 * deep-linked straight into `/study/session`, which is routed outside the
 * shell, and found no worker at all. A learner who bookmarks the study session,
 * or opens the exam from a link, would never have installed the app.
 * Registration cannot be a child of one branch of the route table.
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
import { markUpdateWaiting, setUpdateApplier } from './update-store';

/** Called once, from `main.tsx`. Safe in a browser with no service worker. */
export function startServiceWorker(): void {
  setUpdateApplier(
    registerSW({
      onNeedRefresh: markUpdateWaiting,
    }),
  );
}
