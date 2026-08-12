import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end. The app must be launchable with one command (grounding §1), so
 * the config starts its servers itself.
 *
 * Two servers, because two different things are being judged:
 *
 *  - **dev** (`tests/e2e`) — behaviour. Fast, no service worker, so every spec
 *    sees the network exactly as it is.
 *  - **preview of `dist/`** (`tests/pwa`) — the offline promise, the resilience
 *    scenarios and the startup budget (`executable-floor.md` X16–X23). None of
 *    those mean anything against a dev server: there is no service worker, no
 *    precache manifest and no minified bundle to measure.
 *
 * Explicit, uncommon ports on both: 5173 belongs to an unrelated app on this
 * machine, and `--strictPort` makes a clash fail loudly rather than silently
 * running the suite against something else.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: 'http://localhost:5301',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    {
      name: 'production',
      testDir: './tests/pwa',
      use: { ...devices['Pixel 7'], baseURL: 'http://localhost:5302' },
    },
  ],
  webServer: [
    {
      command: 'npx vite --port 5301 --strictPort',
      url: 'http://localhost:5301',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      /*
       * Serves `dist/`. The build happens in `npm run test:e2e` **before**
       * Playwright starts, deliberately not here: a `vite build` running
       * alongside the dev server rewrites hundreds of files inside the project
       * the dev server is serving, and the specs that happen to be mid-
       * `import()` fail with "Failed to fetch dynamically imported module".
       * That cost a whole red suite to diagnose. Build first, then serve.
       */
      command: 'npx vite preview --port 5302 --strictPort',
      url: 'http://localhost:5302',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
