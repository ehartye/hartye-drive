import type { RouteObject } from 'react-router';
import { AppShell } from './AppShell';
import { ExamRoute, ProgressRoute, SettingsRoute, StudyRoute } from '~/routes/destinations';
import { NotFound, RouteError } from '~/routes/NotFound';
import { SignsLibrary } from '~/routes/SignsLibrary';
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
      // Code-split (practices E7): the score report and the full review carry
      // the whole question bank's prose, and a learner who never sits an exam
      // should not download them.
      {
        path: 'exam/report',
        lazy: async () => ({ Component: (await import('~/routes/ExamReport')).ExamReport }),
      },
      {
        path: 'exam/review',
        lazy: async () => ({ Component: (await import('~/routes/ExamReview')).ExamReview }),
      },
      // Eager, unlike the drill below: `/signs` is one of the four nav
      // destinations, and everything heavy about it — the 87-entry registry and
      // its geometry — is already in the shell because `SignSvg` is.
      { path: 'signs', element: <SignsLibrary /> },
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
    path: '/exam/run',
    lazy: async () => ({ Component: (await import('~/routes/ExamRun')).ExamRun }),
    errorElement: <RouteError />,
    HydrateFallback: RouteFallback,
  },
  {
    path: '/signs/drill',
    lazy: async () => ({ Component: (await import('~/routes/SignsDrill')).SignsDrill }),
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
