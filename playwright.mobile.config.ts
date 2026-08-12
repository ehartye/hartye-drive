import { defineConfig, devices } from '@playwright/test';

/**
 * MOBILE COMPATIBILITY SUITE.
 *
 * The design target is "an iPhone in a Driver Service Center parking lot"
 * (grounding §1, and the onboarding screen says so out loud). Every other suite
 * in this repo runs headless Chromium — `playwright.config.ts` even calls its
 * Pixel 7 project "mobile", but a Pixel 7 profile on the Chromium engine is a
 * resized desktop browser: it cannot show an iOS input zoom, a WebKit SVG
 * difference, or a safe-area inset. This config is the one that runs the real
 * engine.
 *
 * Two projects, and both are load-bearing:
 *
 *  - **iphone-webkit** — `devices['iPhone 14']`, which pins the WebKit engine.
 *    This is the product's stated target and the only place iOS-shaped defects
 *    are visible at all.
 *  - **pixel-chromium** — `devices['Pixel 7']`. Kept as the *control*: a
 *    finding that reproduces on both is a mobile bug, one that reproduces only
 *    on WebKit is an engine bug, and the specs below assert that distinction
 *    rather than guessing at it.
 *
 * Served from `dist/`, not from the dev server. Fonts, the service worker and
 * the split chunks are all part of what is under test here, and none of them
 * exist in a dev build. `npm run test:mobile` builds first, for the same reason
 * `test:e2e` does — a `vite build` running alongside a live server rewrites the
 * files that server is mid-flight on.
 *
 * Port 5403: 5173 belongs to an unrelated app on this machine, and 5301/5302
 * belong to `playwright.config.ts`. `--strictPort` makes a clash fail loudly
 * instead of running the mobile suite against somebody else's app.
 */
export default defineConfig({
  testDir: './tests/mobile',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  outputDir: './test-results/mobile',
  use: {
    baseURL: 'http://localhost:5403',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      /* `devices['iPhone 14']` carries `defaultBrowserType: 'webkit'`. */
      name: 'iphone-webkit',
      use: { ...devices['iPhone 14'] },
    },
    {
      name: 'pixel-chromium',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    command: 'npx vite preview --port 5403 --strictPort',
    url: 'http://localhost:5403',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
