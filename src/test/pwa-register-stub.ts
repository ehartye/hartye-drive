/**
 * Vitest's stand-in for `virtual:pwa-register`, which only exists while
 * `vite-plugin-pwa` is in the pipeline. Aliased from `vite.config.ts`'s `test`
 * block so a unit test never has to build a service worker to render the shell.
 *
 * It registers nothing and reports nothing waiting, which is the truth in a
 * test run. The decision this value feeds is tested directly in
 * `src/domain/update.test.ts` and `src/app/UpdatePrompt.test.tsx`.
 */
export function registerSW(): (reloadPage?: boolean) => Promise<void> {
  return () => Promise.resolve();
}
