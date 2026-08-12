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

/*
 * A dev-only plugin used to live here, stripping `with { type: 'json' }` from
 * dynamic imports because Chromium requires such a module to arrive as
 * `application/json` while Vite's dev server serves `text/javascript` — which
 * broke the content pack, and most of tests/e2e, against `npm run dev`.
 *
 * It is gone because the cause is gone. `signs.json` was imported BOTH
 * statically (`src/signs/registry.ts`) and dynamically (`src/content/index.ts`),
 * and the attributes existed only to stop rollup splitting it across two
 * chunks. The dynamic import bought no laziness — `SignSvg` is in the app
 * shell, so those bytes were always in the entry chunk. `loadSignRegistry()`
 * now resolves the static import, the dual-import is gone, and the two
 * genuinely-lazy imports (questions, rules) carry no attribute and need none.
 *
 * If you reintroduce a dynamic JSON import of a file that is also imported
 * statically, this problem comes back. Import it once.
 */

/**
 * X23 — flatten the cold-start waterfall.
 *
 * Measured on Slow 4G (562 ms RTT) with a 4× CPU throttle, a cold load of
 * `/study/session` cost four sequential round trips: HTML → entry chunk →
 * route chunk → question bank. The last two carry 88 KB between them and spent
 * more than a second of that just waiting to be *discovered*, because a lazy
 * `import()` cannot be seen until the importer has run.
 *
 * Exactly one chunk is therefore announced in the HTML: **the question bank**.
 * It is the only one that is not speculative — the dashboard, the study
 * session, the exam simulator, progress and the rule reference all await it,
 * so every entry point in the app pays for its round trip. Announcing it moves
 * 84 KB from the end of the chain into the first parallel batch.
 *
 * Nothing else is listed, deliberately. `scripts/size.mjs` counts a
 * modulepreloaded chunk against the X8 initial-JS budget — correctly, because
 * that is what the learner downloads — so preloading the route chunks as well
 * would buy a round trip by spending the budget the same executable floor
 * sets. The bank is excluded from X8 as content, which is exactly what it is.
 *
 * `modulepreload` and not `prefetch`: it is needed on this navigation, not a
 * possible next one. `prefetch` is a *speculative*, lowest-priority hint for a
 * resource a **later** navigation might want; a browser is free to defer it
 * until idle, which is precisely the round trip X23 exists to remove. The link
 * shipped as `rel="prefetch"` while this comment argued for `modulepreload` —
 * the comment was right, and the code now matches it. `as="script"` is dropped
 * with it: `modulepreload` already means "a module", and `as` on it means
 * something else entirely.
 */
const criticalPreload = (): Plugin => ({
  name: 'tn-drive-critical-preload',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler(html, ctx) {
      if (!ctx.bundle) return html;

      const already = new Set(
        [...html.matchAll(/href="\/([^"]+\.js)"/g)].map((match) => match[1]),
      );
      const links = Object.values(ctx.bundle)
        .filter((output) => output.type === 'chunk')
        .filter((chunk) => /(^|\/)questions-[\w-]*\.js$/.test(chunk.fileName))
        .map((chunk) => chunk.fileName)
        .filter((fileName) => !already.has(fileName))
        .sort()
        .map((fileName) => `    <link rel="modulepreload" crossorigin href="/${fileName}" />`);

      return links.length === 0 ? html : html.replace('</head>', `${links.join('\n')}\n  </head>`);
    },
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
  plugins: [
    react(),
    tailwindcss(),
    criticalPreload(),
    contentSecurityPolicy(),
    pwa(),
  ],
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
    /**
     * Route tests await a dynamic `import()` of a code-split chunk, not just a
     * re-render. Vitest's default 5s test budget is the same as the async
     * budget Testing Library is configured with in `setup.ts`, so under
     * parallel load the test could die before the query it was waiting on ever
     * gave up — reporting a slow chunk as a wrong assertion. Two independent
     * audits hit this in `Dashboard.test.tsx` (~1 run in 5 under load, green in
     * isolation every time).
     *
     * The test budget must sit comfortably ABOVE the async budget for the
     * failure message to be the true one. A real failure still fails; it just
     * says what actually went wrong.
     */
    testTimeout: 20_000,
    hookTimeout: 20_000,
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
