/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

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

const DESCRIPTION =
  'Offline-first study app for the Tennessee Class D knowledge test. Every answer cites the ' +
  'official manual. Not affiliated with the State of Tennessee.';

/**
 * The service worker and the manifest (grounding §1, practices F1–F4).
 *
 * `registerType: 'prompt'` with `skipWaiting`/`clientsClaim` both off is the
 * whole of F4: a new build installs, waits, and never activates until a learner
 * presses a button in `src/app/UpdatePrompt.tsx`. There is no path here that
 * reloads a page on its own, and nothing mid-exam can be interrupted.
 *
 * `globPatterns` names every extension the app ships, not just the JS: the
 * promise is a **cold start at zero bytes**, so the fonts, the icons, the
 * question bank chunk, the sign registry and the rules must all be in the
 * precache. `navigateFallback` is what makes a deep link work offline — there
 * is no server to fall back to (grounding §1).
 *
 * `injectRegister: null` because registration is done by hand in
 * `ServiceWorkerUpdate`; letting the plugin inject a second registration would
 * mean two registrations racing for the same waiting worker.
 */
const pwa = () =>
  VitePWA({
    strategies: 'generateSW',
    registerType: 'prompt',
    injectRegister: null,
    // The dev server has no service worker at all. Every e2e spec that drives
    // the dev build therefore sees the network exactly as it is; only the
    // production build under `npm run preview` is offline-capable, which is
    // also the only build a learner ever runs.
    devOptions: { enabled: false },
    // No `includeAssets`: `globPatterns` below already sweeps everything Vite
    // emits into `dist/`, and naming the same file twice puts two entries in
    // the precache manifest for one byte range.
    manifest: {
      id: '/',
      name: 'TN Drive — Tennessee Class D knowledge test',
      short_name: 'TN Drive',
      description: DESCRIPTION,
      start_url: '/',
      scope: '/',
      display: 'standalone',
      orientation: 'portrait-primary',
      lang: 'en-US',
      dir: 'ltr',
      categories: ['education'],
      // §2: asphalt is the base background, so the splash screen and the OS
      // chrome are the same night road the app is.
      theme_color: '#14161A',
      background_color: '#14161A',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        {
          src: '/icons/icon-maskable-192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'maskable',
        },
        {
          src: '/icons/icon-maskable-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
      // The bank chunk is ~430 KB raw and is the reason the app is worth
      // installing; the default 2 MB ceiling would silently drop anything
      // larger, so it is stated rather than assumed.
      maximumFileSizeToCacheInBytes: 1024 * 1024,
      navigateFallback: '/index.html',
      cleanupOutdatedCaches: true,
      // Belt and braces on top of `registerType: 'prompt'` — an update takes
      // effect only when the learner asks for it.
      skipWaiting: false,
      clientsClaim: false,
      // One self-contained sw.js rather than sw.js + workbox-*.js, so the
      // worker has nothing to fetch before it can run.
      inlineWorkboxRuntime: true,
      // Nothing is fetched at runtime — `connect-src 'self'` in the CSP above
      // is the enforcement, this is the absence of a loophole (practices B2).
      runtimeCaching: [],
    },
  });

export default defineConfig({
  plugins: [react(), tailwindcss(), contentSecurityPolicy(), pwa()],
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
    // `virtual:pwa-register/react` only exists while the PWA plugin is
    // generating a service worker. A unit test should not have to build one.
    alias: {
      'virtual:pwa-register': fileURLToPath(
        new URL('./src/test/pwa-register-stub.ts', import.meta.url),
      ),
    },
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
