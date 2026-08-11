import { defineConfig, devices } from '@playwright/test';

/**
 * X15 — axe-core across every route. Lighthouse's accessibility score samples;
 * this is the real gate, and it must land zero violations at wcag2a, wcag2aa,
 * wcag21aa and wcag22aa.
 */
export default defineConfig({
  testDir: './tests/a11y',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5302',
  },
  projects: [
    { name: 'mobile-390', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } },
    { name: 'desktop-1440', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: 'npx vite --port 5302 --strictPort',
    url: 'http://localhost:5302',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
