import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end. The app must be launchable with one command (grounding §1), so
 * the config starts the dev server itself and reuses one that is already up.
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
  ],
  webServer: {
    command: 'npx vite --port 5301 --strictPort',
    url: 'http://localhost:5301',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
