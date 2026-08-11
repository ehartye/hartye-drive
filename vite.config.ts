/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * A restrictive CSP on the shipped page (practices B5). Everything is
 * first-party — no CDN, no analytics, no third-party script — so the policy can
 * be tight. `connect-src 'self'` is what actually enforces the offline promise:
 * a beacon added later cannot phone home. Injected on build only, because Vite's
 * dev server serves an inline module preamble for React Fast Refresh.
 *
 * `style-src` keeps `'unsafe-inline'` for `style=` attributes (a progress rail's
 * width is data); `style-src-attr` alone is not supported widely enough to rely
 * on. There is no `unsafe-eval` anywhere.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "form-action 'none'",
  // `frame-ancestors` is ignored in a <meta> CSP and logs a console error, so
  // it belongs in a host response header alongside X-Frame-Options. Noted here
  // rather than dropped silently.
].join('; ');

const contentSecurityPolicy = (): Plugin => ({
  name: 'tn-drive-csp',
  apply: 'build',
  transformIndexHtml(html) {
    return html.replace(
      '<head>',
      `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
    );
  },
});

export default defineConfig({
  plugins: [react(), tailwindcss(), contentSecurityPolicy()],
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Ports per grounding §9. `strictPort` stays off so an already-occupied port
  // degrades to the next free one with the real URL printed, rather than
  // failing the one command that runs the app.
  server: { port: 5173 },
  preview: { port: 4173 },
  build: {
    // Static output, no server. Everything must be precacheable (grounding §1).
    target: 'es2022',
    sourcemap: false,
    assetsInlineLimit: 0,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx'],
      // The floor is set high and narrow on purpose (executable-floor.md X5):
      // src/domain/ is where a silent bug costs a learner a real test attempt.
      // UI coverage is a ratified exclusion.
      thresholds: {
        'src/domain/**': { lines: 90, branches: 90, functions: 90, statements: 90 },
      },
    },
  },
});
