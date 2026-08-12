import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { AppErrorBoundary } from './app/AppErrorBoundary';
import { routes } from './app/routes';
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

createRoot(container).render(
  <StrictMode>
    <AppErrorBoundary>
      <RouterProvider router={createBrowserRouter(routes)} />
    </AppErrorBoundary>
  </StrictMode>,
);
