import { defineConfig, devices } from '@playwright/test';

/**
 * X23 — the startup budget, on its own, with the machine to itself.
 *
 *   npm run audit:startup
 *
 * It is deliberately **not** part of `npm run test:e2e`. X23 is a wall-clock
 * measurement, and `test:e2e` runs several browsers in parallel across two
 * servers: measured inside that suite the same cold load reads 2 856 ms, and
 * measured alone it reads 2 220 ms. The difference is this machine's CPU, not
 * the app, and a benchmark taken under contention is not a benchmark. One
 * worker, no parallelism, the production build, nothing else running.
 */
export default defineConfig({
  testDir: './tests/startup',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  use: {
    ...devices['Pixel 7'],
    baseURL: 'http://localhost:5312',
    trace: 'retain-on-failure',
  },
  webServer: {
    // The build runs in `npm run audit:startup`, before Playwright starts —
    // a `vite build` alongside a live server is what turns a measurement into
    // noise (see the note in `playwright.config.ts`).
    command: 'npx vite preview --port 5312 --strictPort',
    url: 'http://localhost:5312',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
