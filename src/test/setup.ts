import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup, configure } from '@testing-library/react';

/**
 * Most routes in this app are code-split, so a `findBy*` on a route test is
 * waiting on a dynamic `import()` — not just a re-render. Testing Library's
 * default async budget is 1000 ms, which is ample on an idle machine and not
 * ample when the suite runs `fullyParallel` beside browser-driven suites. Two
 * independent audits hit the same intermittent failure in `Dashboard.test.tsx`
 * (~1 run in 5 under load, green every time in isolation).
 *
 * Raising the budget does not make a broken assertion pass — it only stops a
 * slow chunk being reported as a wrong one. Genuine failures still fail, just
 * five seconds later.
 */
configure({ asyncUtilTimeout: 5_000 });

afterEach(() => {
  cleanup();
});

// jsdom implements neither of these, and several §3 components are built on the
// native <dialog> element (practices A16). Polyfill just enough that the
// open/close contract is testable.
if (typeof HTMLDialogElement !== 'undefined') {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.open = true;
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      this.open = false;
      this.dispatchEvent(new Event('close'));
    };
  }
}

if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
