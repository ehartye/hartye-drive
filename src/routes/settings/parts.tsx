import { Button, ConfirmGate, Dialog, SignPanel, SignSvg } from '~/components';
import { IconAlert, IconCheck, IconX } from '~/components/Icon';
import type { Correction } from '~/content';
import { correctionDate } from '~/domain/corrections';
import { formatFullDate } from '../progress/format';

/* ------------------------------------------------------ the corrections */

/**
 * One post-2022 correction, disclosed rather than applied silently
 * (practices D6/D10).
 *
 * Three things are non-negotiable in this card: what the manual actually says
 * (or that it says nothing at all), what is true now, and the **real** effective
 * date with the **real** public chapter. "In force 2023" is not a disclosure;
 * "1 July 2023 · Public Chapter 354" is.
 */
export function CorrectionCard({ correction }: { correction: Correction }) {
  const dated = correctionDate(correction);
  return (
    <article className="corr" aria-labelledby={`corr-${correction.id}`}>
      <div className="corr__head">
        <span className="corr__tag">
          {correction.appliesToContent ? 'Corrected' : 'Disclosed'}
        </span>
        <span className="corr__when">{`${dated.prefix} ${formatFullDate(dated.iso)}`}</span>
      </div>
      <h3 id={`corr-${correction.id}`}>{correction.summary}</h3>
      <dl className="corr__d">
        <dt>Manual</dt>
        <dd>
          {correction.manualStates ?? (
            <em className="text-sign-faint">
              Says nothing on this at all — so there is no wrong sentence to correct, only a gap to
              fill.
            </em>
          )}
        </dd>
        <dt>We teach</dt>
        <dd>
          <b>{correction.currentlyTrue}</b>
        </dd>
        <dt>Authority</dt>
        <dd>{correction.authority}</dd>
      </dl>
      {correction.note && <p className="corr__why">{correction.note}</p>}
      <span className="corr__src">
        {correction.appliesToContent
          ? 'Questions touching this carry the same note under the rule.'
          : 'Outside the exam pool — recorded here so the app does not pretend the manual is current.'}
      </span>
    </article>
  );
}

/* -------------------------------------------------- offline & install */

export interface OfflineAndInstallProps {
  /** `null` until the content pack has been read — never guessed at. */
  bankSize: number | null;
  signCount: number;
  /** A newer build is installed and waiting for permission to take over. */
  updateWaiting: boolean;
  /** Which install affordance this platform can honestly offer. */
  offer: 'none' | 'prompt' | 'ios';
  /** `true` once the learner has waved the offer away, here or on the dashboard. */
  dismissed: boolean;
  onInstall: () => void;
  onRestore: () => void;
}

/**
 * Mockup 11's third section, between "Your data" and "About".
 *
 * It went missing in the build, and with it the only permanent statement of the
 * update policy — "ask me first … never applied in the middle of an exam" —
 * which is the headline behaviour of the service worker (`registerType:
 * 'prompt'`, `skipWaiting` off). A promise the product keeps in code and states
 * nowhere is a promise the learner cannot rely on. The content-pack status and
 * the install affordance lived only on the dashboard, where the first
 * disappears the moment a connection returns and the second disappears for good
 * once it is dismissed — so settings is the only place either can be *looked
 * up*, which is exactly what a settings page is for.
 *
 * Restraint rule (§2): no sign is used here. This is chrome, not curriculum.
 */
export function OfflineAndInstall({
  bankSize,
  signCount,
  updateWaiting,
  offer,
  dismissed,
  onInstall,
  onRestore,
}: OfflineAndInstallProps) {
  return (
    <section className="sect" aria-labelledby="offline-h">
      <h2 id="offline-h">Offline &amp; install</h2>
      <p className="sect__intro">
        Built for a Driver Services Center parking lot with one bar of signal.
      </p>

      <SignPanel flat>
        <div className="srow">
          <span className="srow__t">
            <span className="srow__n">Content pack</span>
            <span className="srow__s">
              {bankSize === null
                ? `On this device — every question, ${String(signCount)} signs and all three typefaces. Nothing is fetched while you study.`
                : `On this device — ${String(bankSize)} questions, ${String(signCount)} signs and all three typefaces. Nothing is fetched while you study.`}
            </span>
          </span>
          <span className="badge badge--live">Ready</span>
        </div>

        <div className="srow">
          <span className="srow__t">
            <span className="srow__n">Updates</span>
            <span className="srow__s">
              Ask me first. A new version downloads in the background and then waits — it only
              replaces the running app when you press the button in the prompt, and it is never
              applied in the middle of an exam or a study session.
            </span>
          </span>
          <span className={`badge${updateWaiting ? ' badge--offline' : ''}`}>
            {updateWaiting ? 'Waiting' : 'Up to date'}
          </span>
        </div>

        <div className="srow">
          <span className="srow__t">
            <span className="srow__n">Add to home screen</span>
            <span className="srow__s">
              Opens full-screen with no browser chrome, and starts faster. On iPhone and iPad, use
              Share then <b>Add to Home Screen</b> — Safari gives a web app no button to press for
              you.
            </span>
            {offer === 'prompt' && (
              <span className="block mt-3">
                <Button variant="guide" onClick={onInstall}>
                  Install TN Drive
                </Button>
              </span>
            )}
            {dismissed && (
              <span className="block mt-3">
                <Button variant="quiet" onClick={onRestore}>
                  Show the offer on the dashboard again
                </Button>
              </span>
            )}
          </span>
          {/* Not "Manual": in this product "the manual" is the Tennessee
              Comprehensive Driver License Manual, named on every question. */}
          <span className="badge">{offer === 'prompt' ? 'Offered' : 'Not offered'}</span>
        </div>
      </SignPanel>

      <p className="dim text-[0.8125rem] mt-3.5 leading-relaxed">
        {offer === 'prompt'
          ? 'The button is here because this browser offered us an install prompt. Nothing is downloaded when you press it — the whole app is already on the device.'
          : 'There is no install button here because this browser does not offer the app one. Where a browser does, it appears in this row.'}
      </p>
    </section>
  );
}

/* --------------------------------------------------------- the hard stop */

export interface ResetDialogProps {
  open: boolean;
  answered: number;
  sittings: number;
  exams: number;
  topics: number;
  acknowledged: boolean;
  onAcknowledge: (checked: boolean) => void;
  onExport: () => void;
  onCancel: () => void;
  onErase: () => void;
}

/**
 * §2 licenses the octagon for exactly two things: exam failure and destructive
 * confirmation. This is the second, and the only place in settings it appears.
 *
 * Erasing is two steps — acknowledge, then erase — and the safest button gets
 * the most ink. The ledger is the point: a learner about to destroy weeks of
 * work is owed an itemised account of what goes and what stays, not the word
 * "everything".
 */
export function ResetDialog({
  open,
  answered,
  sittings,
  exams,
  topics,
  acknowledged,
  onAcknowledge,
  onExport,
  onCancel,
  onErase,
}: ResetDialogProps) {
  return (
    <Dialog
      open={open}
      tone="stop"
      // Counted from the durable rollups, so the number is every answer ever
      // given rather than the tail the attempt log happens to still hold.
      title={`Erase all ${String(answered)} of your answers?`}
      onClose={onCancel}
      actions={
        <>
          <Button variant="guide" block onClick={onExport}>
            Export a copy first
          </Button>
          <Button variant="quiet" block onClick={onCancel}>
            Keep my progress
          </Button>
          <Button variant="danger" block disabled={!acknowledged} onClick={onErase}>
            Erase everything
          </Button>
        </>
      }
    >
      <div className="row items-start gap-3.5 mb-3.5">
        <SignSvg
          id="r1-1-stop"
          size="sm"
          label="Red octagonal stop sign: this action cannot be undone"
        />
        <p className="eyebrow eyebrow--stop m-0">Cannot be undone</p>
      </div>

      <p className="read m-0 mb-4">
        There is no server copy and no undo. Once this runs, the only way back is a file you
        exported yourself.
      </p>

      <section className="ledger ledger--lose" aria-labelledby="lose-h">
        <p className="ledger__head" id="lose-h">
          <IconX size={13} />
          Gone for good
        </p>
        <ul>
          <li>
            <IconX size={14} />
            <span>
              <b>{answered}</b> answered questions, and which ones you got wrong
            </span>
          </li>
          {exams > 0 && (
            <li>
              <IconX size={14} />
              <span>
                <b>{exams}</b> mock exams, with their score reports and every answer in them
              </span>
            </li>
          )}
          {sittings > 0 && (
            <li>
              <IconX size={14} />
              <span>
                <b>{sittings}</b> study sittings still held in full in your history
              </span>
            </li>
          )}
          <li>
            <IconX size={14} />
            <span>
              All <b>{topics}</b> topic scores and your readiness — the progress page goes back to
              empty
            </span>
          </li>
          <li>
            <IconX size={14} />
            <span>The review queue: every question that was due to come back to you</span>
          </li>
        </ul>
      </section>

      <section className="ledger ledger--keep" aria-labelledby="keep-h">
        <p className="ledger__head" id="keep-h">
          <IconCheck size={13} />
          Stays exactly as it is
        </p>
        <ul>
          <li>
            <IconCheck size={14} />
            <span>
              The app itself, every question and every sign — nothing re-downloads, and it still
              works offline
            </span>
          </li>
          <li>
            <IconCheck size={14} />
            <span>Your text size and reduced-motion settings</span>
          </li>
          <li>
            <IconCheck size={14} />
            <span>Any file you have already exported</span>
          </li>
        </ul>
      </section>

      <div className="mt-4">
        <ConfirmGate checked={acknowledged} onChange={onAcknowledge}>
          {`I understand this erases all ${String(answered)} of my answers and everything built on them, and that nobody can get them back.`}
        </ConfirmGate>
      </div>

      <p className="faint text-[0.75rem] leading-normal text-center mt-2">
        If your browser blocks the erase — private mode, or storage locked — nothing is deleted and
        we will tell you exactly what survived.
      </p>
    </Dialog>
  );
}

/* ------------------------------------------------- the erase that failed */

export interface ResetFailedProps {
  answered: number;
  sittings: number;
  exams: number;
  readiness: number;
  onRetry: () => void;
  onExport: () => void;
}

/**
 * The cell a build omits, because "delete" is assumed to always succeed.
 *
 * Design rules applied here, and each is deliberate:
 *
 *  - **No octagon.** The octagon means "this stopped." Nothing was destroyed
 *    and nothing is broken; the erase simply did not happen. That is a warning,
 *    not a hard stop.
 *  - **Relief first.** The learner's live question is "did I lose it?", so the
 *    first thing on the page — and the first thing a screen reader announces —
 *    is that nothing was erased.
 *  - **Every recovery is a real action**, and the one that always works
 *    (clearing it from the browser itself) is spelled out, because it does not
 *    ask the page for permission.
 */
export function ResetFailed({
  answered,
  sittings,
  exams,
  readiness,
  onRetry,
  onExport,
}: ResetFailedProps) {
  return (
    <main className="wrap stack pt-5" role="alert">
      <SignPanel as="section" variant="warn">
        <div className="row items-start gap-3.5">
          <SignSvg id="w1-2-curve" decorative />
          <div>
            <p className="eyebrow eyebrow--warning mb-1">Nothing was erased</p>
            <h1 className="text-[1.5rem]">This browser won&rsquo;t let the app write</h1>
          </div>
        </div>
        <p className="read mt-4">
          {`The reset asked your browser to clear this site's storage and the browser refused. Your progress is untouched — all ${String(answered)} answers, all ${String(sittings)} sittings and your ${String(readiness)}% readiness are exactly as they were a moment ago.`}
        </p>
      </SignPanel>

      <SignPanel as="section" flat aria-labelledby="still-h">
        <p className="eyebrow eyebrow--guide mb-2.5" id="still-h">
          Still here
        </p>
        <dl className="m-0">
          <div className="factrow">
            <dt>Questions answered</dt>
            <dd>{answered}</dd>
          </div>
          <div className="factrow">
            <dt>Sittings</dt>
            <dd>{sittings}</dd>
          </div>
          <div className="factrow">
            <dt>Mock exams</dt>
            <dd>{exams}</dd>
          </div>
          <div className="factrow">
            <dt>Readiness</dt>
            <dd>{`${String(readiness)}%`}</dd>
          </div>
        </dl>
        <p className="safe mt-3.5">
          <IconCheck size={17} />
          <span className="dim">
            You can keep studying right now. Nothing about this stops the app working.
          </span>
        </p>
      </SignPanel>

      <hr className="centreline" />

      <section aria-labelledby="why-h">
        <h2 className="mb-3" id="why-h">
          Why this happens
        </h2>
        <ul className="why read text-base">
          <li>
            <IconAlert size={18} />
            <span>
              You are in a private or incognito window, which discards storage instead of managing
              it.
            </span>
          </li>
          <li>
            <IconAlert size={18} />
            <span>Your browser is set to block site data for this site.</span>
          </li>
          <li>
            <IconAlert size={18} />
            <span>
              The profile or disk is read-only — common on a managed school or work device.
            </span>
          </li>
        </ul>
      </section>

      <SignPanel as="section" aria-labelledby="do-h">
        <p className="eyebrow mb-2" id="do-h">
          What you can do
        </p>

        <Button variant="guide" block onClick={onRetry}>
          Try the reset again
        </Button>

        <details className="disclose mt-4">
          <summary>
            Clear it from the browser instead
            <svg
              className="chev"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              aria-hidden="true"
            >
              <path d="M9 6l6 6-6 6" />
            </svg>
          </summary>
          <p className="dim text-[0.875rem] mt-2">
            This always works, because it does not ask the page for permission.
          </p>
          <ol className="steps dim">
            <li>Open your browser&rsquo;s site settings for this page.</li>
            <li>
              Choose <strong>Clear site data</strong> (or <strong>Cookies and site data</strong>).
            </li>
            <li>Reopen the app. It will start with nothing answered.</li>
          </ol>
        </details>

        <div className="mt-4">
          <Button variant="quiet" block onClick={onExport}>
            Export a copy of my progress first
          </Button>
        </div>
        <p className="faint text-[0.75rem] text-center mt-2">
          Downloads a JSON file. Exporting works even when writing does not.
        </p>
      </SignPanel>

      <p className="faint text-[0.75rem] text-center leading-normal">
        Questions cite the Tennessee Comprehensive Driver License Manual.
        <br />
        Not affiliated with the State of Tennessee.
      </p>
    </main>
  );
}
