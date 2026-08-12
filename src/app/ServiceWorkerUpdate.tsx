/**
 * Where the update offer is allowed to appear.
 *
 * Registration is not here — it is `startServiceWorker()` in `main.tsx`, so a
 * deep link into a focus mode installs the app like any other entry point.
 * This component only *renders* the offer, and it is mounted from `AppShell`,
 * which the study session, the exam and the sign drill sit outside. That is
 * what puts a banner structurally out of reach of a question (practices F4).
 */
import { useSyncExternalStore } from 'react';
import { useExamStore } from '~/store/exam';
import { applyUpdate, isUpdateWaiting, subscribeToUpdates } from './service-worker';
import { UpdatePrompt } from './UpdatePrompt';

export function ServiceWorkerUpdate() {
  const waiting = useSyncExternalStore(subscribeToUpdates, isUpdateWaiting, () => false);

  // An attempt on the device — paused, or simply not yet scored. Accepting an
  // update reloads, and the attempt would survive that (it is persisted under
  // `tn-drive:exams`), but the offer is withheld anyway: a learner sitting an
  // exam is not the audience for a software update.
  const examInProgress = useExamStore((state) => state.record.active !== null);

  return <UpdatePrompt waiting={waiting} examInProgress={examInProgress} onUpdate={applyUpdate} />;
}
