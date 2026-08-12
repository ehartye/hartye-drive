/**
 * When a waiting build may be offered to the learner (practices F4).
 *
 * The service worker registers with `registerType: 'prompt'`, so a new build
 * never activates on its own — it sits in `waiting` until something calls
 * `skipWaiting`. That is the whole guarantee: an update can only ever land
 * because a learner asked for it.
 *
 * Two things then decide *when* to ask. The offer is rendered from `AppShell`,
 * which the three focus modes (study session, exam run, sign drill) sit
 * outside — so a banner cannot structurally appear over a question. And an
 * exam attempt that is merely paused, not abandoned, still suppresses the
 * offer, because accepting one reloads the page: the attempt would survive
 * (it is persisted under `tn-drive:exams`), but a learner mid-exam should not
 * be asked to think about a software update at all.
 *
 * Pure and DOM-free, like everything else in `src/domain/`.
 */

export interface UpdateOfferInputs {
  /** A new build is installed and waiting in the service worker. */
  waiting: boolean;
  /** An exam attempt is on the device, finished or not. */
  examInProgress: boolean;
  /** The learner already said "not now" to this waiting build. */
  dismissed: boolean;
}

/**
 * `true` only when there is something to offer, nothing to interrupt, and the
 * learner has not already turned it down.
 */
export function shouldOfferUpdate(inputs: UpdateOfferInputs): boolean {
  return inputs.waiting && !inputs.examInProgress && !inputs.dismissed;
}

/**
 * Why the offer is being held back, for the one place that has to say so. An
 * update deferred behind an exam is not the same as no update at all, and a
 * learner who dismissed one should not be told there is nothing there.
 */
export type UpdateOfferState = 'none' | 'offered' | 'deferred' | 'dismissed';

export function updateOfferState(inputs: UpdateOfferInputs): UpdateOfferState {
  if (!inputs.waiting) return 'none';
  if (inputs.examInProgress) return 'deferred';
  if (inputs.dismissed) return 'dismissed';
  return 'offered';
}
