import { useState } from 'react';
import {
  AppBar,
  Button,
  ProgressRail,
  SegmentedField,
  SignPanel,
  SignSvg,
  SwitchRow,
  Toast,
  ToastDock,
} from '~/components';
import { usePageTitle } from '~/app/usePageTitle';
import { corrections, topics as topicDefs } from '~/content';
import correctionsData from '~/content/corrections.json';
import { allSigns } from '~/signs/signs';
import {
  PREFERENCES_STORAGE_KEY,
  STORAGE_BUDGET_BYTES,
  buildExportBundle,
  exportFilename,
  formatBytes,
  motionLabel,
  storageBytes,
  textSizeLabel,
} from '~/domain/settings';
import type { MotionSetting, TextSize } from '~/domain/settings';
import { summariseProgress } from '~/domain/progress-report';
import { useProgressStore } from '~/store/progress';
import { useExamStore } from '~/store/exam';
import { useSettingsStore } from '~/store/settings';
import { recordNames, useUnreadableRecords } from '~/store/health';
import { RECORD_KEYS, readRecordSizes, resetAllRecords } from '~/store/reset';
import { CorrectionCard, ResetDialog, ResetFailed } from './settings/parts';
import { formatFullDate } from './progress/format';

const CURRENCY = correctionsData.manualCurrency;
const DO_NOT_TEACH = correctionsData.doNotTeach;

const TEXT_SIZE_OPTIONS = (['standard', 'large', 'larger'] as const).map((value) => ({
  value,
  label: textSizeLabel(value),
}));

type ResetState = 'idle' | 'confirming' | 'failed' | 'done';

/**
 * Settings & about — where the app says what it is made of, and where the
 * learner's own data is theirs to take or destroy.
 *
 * Settings is where the restraint rule earns its keep (§2): no sign used as
 * decoration. Colour appears in exactly two places, and both mean something —
 * construction orange on the post-2022 corrections, and regulatory red on the
 * one destructive action.
 *
 * Two disclosures on this page are obligations rather than features: the source
 * and its July 2022 currency date, and the app's non-affiliation with the State
 * of Tennessee (practices D7). Neither is in a collapsed section.
 */
export function Settings() {
  usePageTitle('Settings');

  const progress = useProgressStore((s) => s.progress);
  const examRecord = useExamStore((s) => s.record);
  const prefs = useSettingsStore((s) => s.prefs);
  const setTextSize = useSettingsStore((s) => s.setTextSize);
  const setMotion = useSettingsStore((s) => s.setMotion);
  const prefsStorage = useSettingsStore((s) => s.storageMode);
  // Same owner the dashboard and the progress page ask, so the three screens
  // cannot tell a learner three different things about one saved file.
  const unreadable = useUnreadableRecords();

  const [reset, setReset] = useState<ResetState>('idle');
  const [acknowledged, setAcknowledged] = useState(false);
  const [exported, setExported] = useState<string | null>(null);

  const summary = summariseProgress(progress, examRecord.attempts, topicDefs);

  const exportProgress = () => {
    const entries = [...readRecordSizes(), { key: PREFERENCES_STORAGE_KEY, raw: read(PREFERENCES_STORAGE_KEY) }];
    const at = Date.now();
    const name = exportFilename(at);
    download(name, JSON.stringify(buildExportBundle(at, entries), null, 2));
    setExported(name);
  };

  const erase = () => {
    const outcome = resetAllRecords();
    setAcknowledged(false);
    setReset(outcome.ok ? 'done' : 'failed');
  };

  if (reset === 'failed') {
    return (
      <>
        <AppBar title="Settings" context="Reset failed · nothing was erased" backTo="/progress" />
        <ResetFailed
          answered={summary.answered}
          sittings={summary.sittings}
          exams={summary.examsTaken}
          readiness={summary.readiness}
          onRetry={erase}
          onExport={exportProgress}
        />
      </>
    );
  }

  const bytes = storageBytes(readRecordSizes());
  const usedPercent = Math.max(
    bytes > 0 ? 1 : 0,
    Math.round((bytes / STORAGE_BUDGET_BYTES) * 100),
  );

  return (
    <>
      <AppBar title="Settings" context="Sources, corrections and your data" backTo="/progress" />

      <main className="wrap pt-6">
        <p className="eyebrow">TN Drive</p>
        <h1>Settings &amp; about</h1>

        {/* ---------------------------------------------- reading & motion */}
        <section className="sect mt-7" aria-labelledby="read-h">
          <h2 id="read-h">Reading &amp; motion</h2>
          <p className="sect__intro">These apply everywhere in the app, including mid-exam.</p>

          <SignPanel flat>
            <SwitchRow
              name="Reduce motion"
              description={`${motionLabel(prefs.motion)}. Nothing in this app is carried by movement, so turning it on loses you nothing.`}
              checked={prefs.motion === 'reduced'}
              onChange={(checked) => {
                setMotion(checked ? 'reduced' : ('system' satisfies MotionSetting));
              }}
            />

            <div className="srow">
              <span className="srow__t">
                <SegmentedField
                  legend="Text size"
                  name="text-size"
                  value={prefs.textSize}
                  options={TEXT_SIZE_OPTIONS}
                  onChange={(value) => {
                    setTextSize(value as TextSize);
                  }}
                />
                <span className="srow__s mt-2">
                  Applies to rule text and manual quotations. Question stems keep their own size —
                  they are the sign, not the book. Your browser&rsquo;s own zoom still works on top
                  of this.
                </span>
                <span className="preview block">
                  <span className="eyebrow block mb-1.5">
                    {`Preview · ${textSizeLabel(prefs.textSize)}`}
                  </span>
                  {/* Verbatim from the manual, PDF p.65 / printed p.51. The preview
                      is set in the same treatment as a real quotation, so it must be
                      a real quotation — a manual-sounding sentence that is not in the
                      manual is the one thing this app must never show. */}
                  <span className="read block">
                    &ldquo;A turn lane in the middle of a four-lane highway is NOT considered a
                    barrier, but a fifth lane that is suitable for vehicular traffic. Drivers
                    meeting a stopped school bus on this type of road would be required to stop in
                    both directions.&rdquo;
                  </span>
                </span>
              </span>
            </div>
          </SignPanel>

          {prefsStorage === 'session-only' && (
            <p className="faint text-[0.75rem] mt-2 leading-normal">
              This device is not letting the app save anything, so these two choices will go back to
              their defaults when you close the tab.
            </p>
          )}
        </section>

        {/* ------------------------------------------- where this comes from */}
        <section className="sect" aria-labelledby="src-h">
          <h2 id="src-h">Where these questions come from</h2>
          <p className="sect__intro">One source, named on every question, with its page.</p>

          <SignPanel variant="route">
            <p className="eyebrow eyebrow--route mb-2.5">Primary source</p>
            <h3 className="mb-2">Tennessee Comprehensive Driver License Manual</h3>
            <p className="read text-base m-0 mb-3.5">
              {`Published by the Tennessee Department of Safety & Homeland Security. Its own front matter states the content is current as of `}
              <strong>{formatFullDate(CURRENCY.statedCurrentAsOf)}</strong>
              {`. The same PDF also carries a printing authorization dated March 2025 (${CURRENCY.printAuthorization}); the department does not reconcile the two, so we record both and treat July 2022 as the content date.`}
            </p>
            <p className="read text-base m-0 mb-3.5">
              Questions are drawn from Sections B and C only, in the proportions the manual
              publishes for the test itself: a quarter each on traffic signs and signals, safe
              driving principles, rules of the road, and drugs and alcohol. The manual states it is
              not copyrighted and may be reproduced.
            </p>

            <blockquote className="cite border-l-route-text">
              <p className="text-[0.9375rem] font-bold leading-normal m-0">
                TN Drive is an independent study aid. It is not affiliated with, endorsed by, or
                connected to the State of Tennessee or its Department of Safety &amp; Homeland
                Security.
              </p>
              <span className="cite__src">
                Nothing here is an official score, a permit, or a substitute for the manual.
              </span>
            </blockquote>
          </SignPanel>
        </section>

        {/* ---------------------------------------------------- corrections */}
        <section className="sect" aria-labelledby="corr-h">
          <h2 id="corr-h">What we&rsquo;ve corrected since 2022</h2>
          <p className="sect__intro">
            {`The manual disclaims its own currency. Where Tennessee law has moved since ${formatFullDate(CURRENCY.statedCurrentAsOf)} we teach the current rule — and we say so, here and on every question that touches it. ${String(corrections.length)} are on file. Each names its authority: a public chapter where the legislature made the change, the statute or federal act where no single chapter did, and the department's own published policy where nothing is legislated at all. The date beside each one says which of those it is.`}
          </p>

          <SignPanel flat>
            {corrections.map((correction) => (
              <CorrectionCard correction={correction} key={correction.id} />
            ))}
          </SignPanel>

          <p className="dim text-[0.8125rem] mt-3.5 leading-relaxed">
            We never change an answer quietly. If a question&rsquo;s answer differs from the printed
            manual, the difference is shown on the question, with the manual&rsquo;s wording next to
            ours.
          </p>
        </section>

        {/* ------------------------------------------------ what we won't teach */}
        <section className="sect" aria-labelledby="dnt-h">
          <h2 id="dnt-h">What we won&rsquo;t teach</h2>
          <p className="sect__intro">
            Changes we have seen reported but could not verify against a primary source. They are
            not in the question bank, and the manual&rsquo;s own figure is taught as the
            manual&rsquo;s statement rather than as today&rsquo;s law.
          </p>
          <SignPanel flat>
            <ul className="about">
              {DO_NOT_TEACH.map((entry) => (
                <li key={entry.topic}>
                  <b>{entry.topic}</b>
                  <span>{entry.confidence} confidence</span>
                </li>
              ))}
            </ul>
          </SignPanel>
        </section>

        {/* ------------------------------------------------------- your data */}
        <section className="sect" aria-labelledby="data-h">
          <h2 id="data-h">Your data</h2>
          <p className="sect__intro">
            All of it lives in this browser on this device. There is no account, no server and
            nothing to sync — which also means nothing is backed up for you.
          </p>

          <SignPanel flat>
            <div className="store">
              <strong className="text-[0.875rem]">Storage used</strong>
              <span>{`${formatBytes(bytes)} of about ${formatBytes(STORAGE_BUDGET_BYTES)}`}</span>
            </div>
            <ProgressRail
              value={usedPercent}
              max={100}
              label={`Storage used: about ${String(usedPercent)} percent of the space this browser gives the app`}
            />
            <p className="dim text-[0.8125rem] mt-2.5">
              {unreadable.length > 0
                ? `That space is a saved ${recordNames(unreadable)} this build cannot read, so none of it can be counted here. Nothing has been deleted.`
                : `${String(summary.sittings)} sittings · ${String(summary.answered)} answered questions · ${String(summary.topicsTouched)} topics. The most recent 200 answers are kept in full; older ones are folded into your totals so this never fills up.`}
            </p>
          </SignPanel>

          <div className="mt-3.5">
            <Button variant="quiet" block onClick={exportProgress}>
              Export your progress
            </Button>
          </div>
          <p className="dim text-[0.8125rem] text-center mt-2">
            Downloads one JSON file. Keep it somewhere safe — it is the only copy that exists.
          </p>

          <SignPanel variant="stop" className="mt-5">
            <div className="row items-start gap-3.5">
              <SignSvg
                id="r1-1-stop"
                size="sm"
                label="Red octagonal stop sign: a destructive action"
              />
              <div>
                <h3 className="mb-1.5">Reset all progress</h3>
                <p className="dim m-0 text-[0.875rem] leading-relaxed">
                  Erases every answer, every mock exam and your whole history. The questions and
                  signs stay. This cannot be undone and there is no copy on a server to restore
                  from.
                </p>
              </div>
            </div>
            {/* An unreadable record must not be erased from here. This page can
                only offer a confirmation built out of derived numbers, and while
                a quarantine is in force every one of them is zero — which is how
                "Erase all 0 of your answers?" came to be the last thing a
                learner saw before a 41 KB file was deleted. The recovery screen
                has the raw payload and can put a real ledger in front of them. */}
            {unreadable.length > 0 ? (
              <>
                <div className="mt-4">
                  <Button variant="quiet" block to="/">
                    Sort out the unreadable record first
                  </Button>
                </div>
                <p className="faint text-[0.75rem] text-center mt-2">
                  Erasing from here would delete a file this build cannot count. The Study screen
                  shows what is in it and offers you a copy before anything goes.
                </p>
              </>
            ) : (
              <>
                <div className="mt-4">
                  <Button
                    variant="danger"
                    block
                    disabled={!summary.hasHistory}
                    {...(summary.hasHistory ? {} : { describedBy: 'nothing-to-erase' })}
                    onClick={() => {
                      setReset('confirming');
                    }}
                  >
                    Reset all progress…
                  </Button>
                </div>
                {!summary.hasHistory && (
                  <p className="faint text-[0.75rem] text-center mt-2" id="nothing-to-erase">
                    There is nothing to erase yet.
                  </p>
                )}
              </>
            )}
          </SignPanel>
        </section>

        {/* ------------------------------------------------------------ about */}
        <section className="sect" aria-labelledby="about-h">
          <h2 id="about-h">About</h2>
          <SignPanel flat>
            <ul className="about">
              <li>
                <b>Sign registry</b>
                <span>{`${String(allSigns.length)} signs`}</span>
              </li>
              <li>
                <b>Topics</b>
                <span>{`${String(topicDefs.length)} across four exam areas`}</span>
              </li>
              <li>
                <b>Manual content date</b>
                <span>{formatFullDate(CURRENCY.statedCurrentAsOf)}</span>
              </li>
              <li>
                <b>Corrections on file</b>
                <span>{corrections.length}</span>
              </li>
              <li>
                <b>Accounts, analytics, trackers</b>
                <span>none</span>
              </li>
            </ul>
          </SignPanel>

          <p className="read text-[0.9375rem] mt-4">
            Every question in the app carries the manual page and the sentence it came from. If you
            find one that does not match the manual, the manual wins — except where it is listed
            above as corrected.
          </p>
        </section>

        <p className="faint text-[0.75rem] text-center mt-8 leading-relaxed">
          {`Source: Tennessee Comprehensive Driver License Manual, Tennessee Department of Safety & Homeland Security · content current as of ${formatFullDate(CURRENCY.statedCurrentAsOf)}.`}
          <br />
          <strong className="text-sign-dim">
            Not affiliated with, or endorsed by, the State of Tennessee.
          </strong>
        </p>
      </main>

      <ResetDialog
        open={reset === 'confirming'}
        answered={summary.answered}
        sittings={summary.sittings}
        exams={summary.examsTaken}
        topics={summary.topicsTouched}
        acknowledged={acknowledged}
        onAcknowledge={setAcknowledged}
        onExport={exportProgress}
        onCancel={() => {
          setAcknowledged(false);
          // Native `<dialog>` fires `close` whenever it shuts, including the
          // programmatic close that follows a successful erase. Only a genuine
          // dismissal goes back to idle; anything else would wipe out the
          // outcome the learner still has to be told about.
          setReset((current) => (current === 'confirming' ? 'idle' : current));
        }}
        onErase={erase}
      />

      {(reset === 'done' || exported !== null) && (
        <ToastDock>
          {reset === 'done' && (
            <Toast
              tone="guide"
              title="Everything was erased"
              onDismiss={() => {
                setReset('idle');
              }}
            >
              Your answers, sittings and mock exams are gone from this device. Your text size and
              motion settings were left alone.
            </Toast>
          )}
          {exported !== null && (
            <Toast
              tone="guide"
              title="Exported"
              onDismiss={() => {
                setExported(null);
              }}
            >
              {`Saved as ${exported}. It is the only copy that exists.`}
            </Toast>
          )}
        </ToastDock>
      )}
    </>
  );
}

/* ---------------------------------------------------------------- helpers */

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * The export is a Blob and an `<a download>`: no server, no clipboard, nothing
 * leaves the device except into the learner's own file system. Guarded because
 * the whole point of the failure path above is that browsers refuse things.
 */
function download(filename: string, contents: string): void {
  try {
    const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  } catch {
    // Nothing to recover here: the record is untouched and the learner can try
    // again. Reported by the absence of the confirmation, not by a thrown error.
  }
}

/** Named so the reset module's key list is visibly the thing being exported. */
export const EXPORTED_KEYS = RECORD_KEYS;
