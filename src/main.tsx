import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { AppErrorBoundary } from './app/AppErrorBoundary';
import { routes } from './app/routes';
import { startServiceWorker } from './app/service-worker';
import { applyAppearance, useSettingsStore } from './store/settings';
import './styles/index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root element is missing from index.html');

/**
 * The learner's text-size and reduced-motion choices are stamped on `<html>`
 * before the first paint, and here rather than in a route.
 *
 * Settings is code-split, and the focus modes sit outside `AppShell`, so any
 * other home for this would leave the preference applied on the page where it
 * was chosen and nowhere else — which is precisely the bug a preference that
 * claims to apply "everywhere in the app, including mid-exam" must not have.
 */
applyAppearance(useSettingsStore.getState().prefs, document.documentElement);

/**
 * The offline promise, started here rather than inside a route: `/study/session`,
 * `/exam/run` and `/signs/drill` are routed outside `AppShell`, so a deep link
 * into any of them would otherwise never install the app (grounding §1).
 * It never activates a new build on its own — see `app/service-worker.ts`.
 */
startServiceWorker();

createRoot(container).render(
  <StrictMode>
    <AppErrorBoundary>
      {/*
        GitHub Pages serves a project site from `/<repo>/`, not `/`. Vite
        rewrites asset URLs for that automatically once `base` is set; the
        router does not, so a deep link would 404 against the wrong prefix.
        `BASE_URL` is `/` in dev and under `npm run preview`, so nothing about
        local behaviour changes. Trailing slash trimmed: React Router wants
        `/hartye-drive`, Vite gives `/hartye-drive/`.
      */}
      <RouterProvider
        router={createBrowserRouter(routes, {
          basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/',
        })}
      />
    </AppErrorBoundary>
  </StrictMode>,
);
