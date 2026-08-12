import type { RouteObject } from 'react-router';
import { AppShell } from './AppShell';
import {
  ExamRoute,
  ProgressRoute,
  SettingsRoute,
  SignsRoute,
  StudyRoute,
} from '~/routes/destinations';
import { NotFound, RouteError } from '~/routes/NotFound';
import { RouteFallback } from '~/routes/RouteFallback';

/**
 * Declarative route table (grounding §1). Deep links must work offline, so the
 * host needs an SPA fallback — P9 owns that alongside the service worker.
 *
 * Study session and exam simulator are full-screen focus modes and therefore
 * sit *outside* `AppShell`, which is what removes the nav (§4).
 */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteError />,
    HydrateFallback: RouteFallback,
    children: [
      { index: true, element: <StudyRoute /> },
      { path: 'study', element: <StudyRoute /> },
      { path: 'exam', element: <ExamRoute /> },
      { path: 'signs', element: <SignsRoute /> },
      { path: 'progress', element: <ProgressRoute /> },
      { path: 'settings', element: <SettingsRoute /> },
      // Code-split (practices E7): the gallery is a development surface and
      // must not sit in the initial bundle a learner downloads.
      {
        path: 'gallery',
        lazy: async () => ({ Component: (await import('~/routes/Gallery')).Gallery }),
      },
      { path: '*', element: <NotFound /> },
    ],
  },
  // Focus modes: no nav, no shell.
  {
    path: '/study/session',
    lazy: async () => ({ Component: (await import('~/routes/StudySession')).StudySession }),
    errorElement: <RouteError />,
    HydrateFallback: RouteFallback,
  },
  {
    path: '/gallery/focus',
    lazy: async () => ({ Component: (await import('~/routes/GalleryFocus')).GalleryFocus }),
    errorElement: <RouteError />,
    HydrateFallback: RouteFallback,
  },
];
