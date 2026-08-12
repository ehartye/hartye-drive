import type { RouteObject } from 'react-router';
import { AppShell } from './AppShell';
import { ExamRoute, StudyRoute } from '~/routes/destinations';
import { Progress } from '~/routes/Progress';
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
      // Eager, like `/signs`: one of the four nav destinations, and everything
      // it needs — the taxonomy, the two records and the hand-authored charts —
      // is small. It never loads the question bank.
      { path: 'progress', element: <Progress /> },
      // Code-split (practices E7): settings is not one of the four nav
      // destinations, and it carries the whole corrections disclosure.
      {
        path: 'settings',
        lazy: async () => ({ Component: (await import('~/routes/Settings')).Settings }),
      },
      // Code-split (practices E7): the rule reference is the only surface that
      // needs all three large content files at once — 533 rules, the whole
      // question bank and the sign registry — and a learner who never follows a
      // citation should not download any of them.
      {
        path: 'rules/:id',
        lazy: async () => ({
          Component: (await import('~/routes/RuleReference')).RuleReference,
        }),
      },
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
