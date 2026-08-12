import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AppBar, Button, ConfirmGate, SignPanel, SignSvg, VisuallyHidden } from '~/components';
import { IconDownload, IconRefresh } from '~/components/Icon';
import { usePageTitle } from '~/app/usePageTitle';
import type { BlueprintArea } from '~/content';
import {
  dashboardHeadline,
  estimatedMinutes,
  examRecommendation,
  judgedTopicCount,
  readiness,
  routeToTest,
  starterTopics,
  studyStreak,
  topicDrillIds,
  weakTopics,
} from '~/domain/dashboard';
import { DEFAULT_SESSION_SIZE } from '~/domain/session';
import { masteryPercent } from '~/domain/mastery';
import type { StudyProgress } from '~/domain/progress';
import { CURRENT_SCHEMA_VERSION, STORAGE_KEY } from '~/domain/persistence';
import { EXAM_RECORD_VERSION, EXAM_STORAGE_KEY } from '~/domain/exam-history';
import { SETUP_STORAGE_KEY } from '~/domain/setup';
import {
  buildDiagnostic,
  diagnosticFileName,
  formatBytes,
  inspectPayload,
} from '~/domain/diagnostics';
import { useExamStore } from '~/store/exam';
import { useProgressStore } from '~/store/progress';
import { useSignStore } from '~/store/signs';
import { useUnreadableRecords } from '~/store/health';
import type { RecordReport } from '~/store/health';
import { SIGN_RECORD_VERSION, SIGN_STORAGE_KEY, summariseSignMastery } from '~/domain/sign-progress';
import { isReady, useSetupStore } from '~/store/setup';
import { Onboarding } from './Onboarding';
import {
  ContentPack,
  ExamPanel,
  GuideSign,
  InstallPanel,
  KeepsList,
  OfflineStrip,
  PrimaryCta,
  ReadinessPlate,
  SourceFooter,
  StarterRow,
  StreakPanel,
  WeakRow,
} from './dashboard/parts';
import { OWNED_KEYS, contextLine, formatStamp, readRaw, useContent, useInstallOffer, useOnline } from './dashboard/support';
import type { ContentSummary } from './dashboard/support';

/**
 * The dashboard — the Study destination, and the app's front door.
 *
 * Six states, all of them real (state-matrix cells 2, 2b–2f): populated, empty,
 * loading, an unreadable saved record, offline, and the ≥1024px deck. On first
 * run it is onboarding instead, because "onboarding **is** the empty state of
 * the app" (matrix note 1) — there is nothing to show until the two questions
 * on that screen are answered.
 *
 * Every figure on it comes from `src/domain/dashboard.ts`, which composes the
 * same `progress`, `mastery`, `session` and `exam-history` modules the study
 * session and the exam simulator schedule and score against. The dashboard has
 * no numbers of its own.
 */
export function Dashboard() {
  usePageTitle('Study');

  const ready = useSetupStore(isReady);
  const setupStorage = useSetupStore((s) => s.storageMode);
  const setup = useSetupStore((s) => s.setup);
  const progress = useProgressStore((s) => s.progress);
  const progressMode = useProgressStore((s) => s.storageMode);
  const examRecord = useExamStore((s) => s.record);

  const content = useContent();
  const online = useOnline();

  // One owner for "can the saved record be read" — `/progress` and `/settings`
  // ask the same module, so the three screens cannot disagree about it.
  const unreadable = useUnreadableRecords();
  const counts =
    content.status === 'ready'
      ? { bankSize: content.content.bankSize, signCount: content.content.signCount }
      : null;

  if (!ready) return <Onboarding />;

  if (unreadable.length > 0) {
    return (
      <UnreadableSave
        online={online}
        goalLabel={goalLabel(setup.goal)}
        testDate={setup.testDate}
        counts={counts}
        keys={unreadable}
      />
    );
  }

  if (content.status === 'loading') {
    return <DashboardSkeleton goalLabel={goalLabel(setup.goal)} online={online} />;
  }

  if (content.status === 'error') {
    return <ContentError detail={content.detail} online={online} goalLabel={goalLabel(setup.goal)} />;
  }

  return (
    <LoadedDashboard
      content={content.content}
      online={online}
      sessionOnly={progressMode === 'session-only' || setupStorage === 'session-only'}
      progress={progress}
      examsPassed={examRecord.attempts.filter((attempt) => attempt.verdict === 'pass').length}
      goal={setup.goal}
      testDate={setup.testDate}
    />
  );
}

const goalLabel = (goal: 'class-d' | 'signs') =>
  goal === 'signs' ? 'Signs refresher' : 'Class D knowledge test';

/** What the record holds on one topic, or nothing if it has never been asked. */
const statFor = (progress: StudyProgress, topic: string) => {
  const stat = progress.topics[topic];
  if (!stat || stat.seen === 0) return undefined;
  return { seen: stat.seen, correct: stat.correct, percent: masteryPercent(stat.correct, stat.seen) };
};

/* --------------------------------------------------------------- populated */

interface LoadedProps {
  content: ContentSummary;
  online: boolean;
  sessionOnly: boolean;
  progress: StudyProgress;
  examsPassed: number;
  goal: 'class-d' | 'signs';
  testDate: string | null;
}

function LoadedDashboard({
  content,
  online,
  sessionOnly,
  progress,
  examsPassed,
  goal,
  testDate,
}: LoadedProps) {
  const [now] = useState(() => Date.now());
  const install = useInstallOffer();

  const reading = readiness(progress);
  const weak = weakTopics(progress, content.topicCounts, 4);
  const judged = judgedTopicCount(progress);
  const headline = dashboardHeadline(reading, weak.length, judged);
  // Sign mastery is the sign trainer's own record (P6's `sign-progress.ts`),
  // not an inference from the questions that happen to mention a sign — one
  // source of truth per thing the learner has learned.
  const signCards = useSignStore((s) => s.record.cards);
  const signs = useMemo(
    () => summariseSignMastery(signCards, content.signIds),
    [signCards, content.signIds],
  );
  const rows = routeToTest({
    progress,
    bankSize: content.bankSize,
    signs: { solid: signs.solid, total: signs.total },
    examsPassed,
  });
  const streak = studyStreak(progress.attempts, now);
  const exam = examRecommendation(reading.percent, examsPassed);
  const starters = starterTopics(content.topics, content.topicCounts);
  const labelFor = (topicId: string) =>
    content.topics.find((topic) => topic.id === topicId)?.label ?? topicId;
  const areaFor = (topicId: string): BlueprintArea =>
    content.topics.find((topic) => topic.id === topicId)?.area ?? 'signs';
  const empty = reading.answered === 0;

  const drillTo = (topic: string) =>
    `/study/session?q=${topicDrillIds(content.questions, progress.cards, topic, DEFAULT_SESSION_SIZE).join(',')}`;

  const signsGoal = goal === 'signs';

  const hero = (
    <section className="readout">
      <ReadinessPlate percent={reading.percent} measured={!empty} />
      <div className="readout__copy">
        <p className="eyebrow">{goalLabel(goal)}</p>
        <h1>{headline.heading}</h1>
        <p className="dim mt-1.5 text-[0.9375rem]">{headline.sub}</p>
      </div>
    </section>
  );

  const readingLine = empty ? (
    <VisuallyHidden>Readiness is not measured yet. No questions have been answered.</VisuallyHidden>
  ) : (
    <VisuallyHidden>
      {`Readiness ${String(reading.percent)} percent — your overall accuracy across the ${String(reading.answered)} questions you have answered, ${String(reading.correct)} of them correctly.`}
    </VisuallyHidden>
  );

  const guide = (
    <GuideSign
      rows={rows}
      note={
        signs.review > 0
          ? `A sign is learned once you have had it right three times running — ${String(signs.review)} more are part-way there.`
          : undefined
      }
    />
  );

  const primary = signsGoal ? (
    <PrimaryCta to="/signs" under={`All ${String(content.signCount)} signs · shape, color and meaning`}>
      Drill the road signs
    </PrimaryCta>
  ) : empty ? null : (
    <PrimaryCta
      to="/study/session"
      under={`${String(DEFAULT_SESSION_SIZE)} questions queued · about ${String(estimatedMinutes(DEFAULT_SESSION_SIZE))} minutes`}
    >
      Continue studying
    </PrimaryCta>
  );

  const invitation = (
    <>
      <SignPanel as="section" className="invite" aria-labelledby="invite-head">
        <p className="eyebrow eyebrow--guide mb-1.5">Start here</p>
        <h2 className="mb-1.5" id="invite-head">
          {`Your first ${String(DEFAULT_SESSION_SIZE)} questions`}
        </h2>
        <p className="read text-[1rem]">
          They sample every topic on the test, so by the end this screen knows what to work on.
          Every answer comes with the manual passage it came from.
        </p>
        <ul className="invite__steps">
          <li>{`${String(DEFAULT_SESSION_SIZE)} questions`}</li>
          <li>{`${String(estimatedMinutes(DEFAULT_SESSION_SIZE))} minutes`}</li>
          <li>No score kept</li>
        </ul>
        <div className="mt-4">
          <Button variant="guide" block to="/study/session" className="text-[1.0625rem]">
            Answer your first question
          </Button>
        </div>
      </SignPanel>
      <p className="dim text-center text-[0.8125rem]">
        Or{' '}
        <Link to="/signs" className="citelink">{`browse the ${String(content.signCount)} road signs`}</Link>{' '}
        first — no answering required.
      </p>
    </>
  );

  const topicsSection = (
    <section aria-labelledby="weak-head">
      <div className="spread mb-3.5">
        <h2 id="weak-head">Slow down here</h2>
        <SignSvg id="w1-2-curve" size="sm" decorative />
      </div>
      {weak.length === 0 && (
        <p className="dim text-[0.875rem] mb-3.5">
          {empty
            ? 'Nothing measured yet. After your first session the topics holding you back land here — until then, one from each of the four areas the test samples equally.'
            : judged === 0
              ? 'No topic has been asked enough times yet to single one out. Until then, one from each of the four areas the test samples equally.'
              : 'No topic is weak enough to single out right now. Keep the queue moving and this list will tell you the moment that changes.'}
        </p>
      )}
      <div className="weak">
        {weak.length > 0
          ? weak.map((row) => (
              <WeakRow
                key={row.topic}
                row={row}
                now={now}
                label={labelFor(row.topic)}
                area={areaFor(row.topic)}
                to={drillTo(row.topic)}
              />
            ))
          : starters.map((row) => (
              <StarterRow
                key={row.topic}
                topic={row.topic}
                label={labelFor(row.topic)}
                area={areaFor(row.topic)}
                questionCount={row.questionCount}
                to={drillTo(row.topic)}
                stat={statFor(progress, row.topic)}
              />
            ))}
      </div>
    </section>
  );

  return (
    <>
      <AppBar
        title="Study"
        context={contextLine(goalLabel(goal), testDate, empty ? 'nothing answered yet' : undefined)}
        online={online}
      />
      <main className="deck">
        <div className="col-main stack pt-6 lg:pt-1">
          {!online && <OfflineStrip />}
          {sessionOnly && <SessionOnlyNotice />}
          {hero}
          {readingLine}
          {guide}
          {primary}
          {empty && invitation}
          {install.offer !== 'none' && (
            <InstallPanel offer={install.offer} onInstall={install.install} onDismiss={install.dismiss} />
          )}
          <hr className="centreline" />
          {topicsSection}
        </div>

        <aside className="col-side" aria-label="Exam and streak">
          {!signsGoal && (
            <ExamPanel
              eyebrow={exam.eyebrow}
              body={exam.body}
              recommended={exam.recommended}
              threshold={exam.threshold}
            />
          )}
          <StreakPanel streak={streak} />
          {!online && (
            <ContentPack
              bankSize={content.bankSize}
              signCount={content.signCount}
              officialCount={content.officialCount}
            />
          )}
        </aside>

        <SourceFooter className="deckfoot" />
      </main>
    </>
  );
}

function SessionOnlyNotice() {
  return (
    <SignPanel as="section" variant="warn" flat>
      <p className="eyebrow eyebrow--warning mb-1.5" role="status">Session-only mode</p>
      <p className="dim text-[0.875rem]">
        This browser is not letting the app save, so this session will not be remembered. Everything
        else works: all the questions, all the signs, and every citation.
      </p>
    </SignPanel>
  );
}

/* ----------------------------------------------------------------- loading */

interface SkeletonProps {
  goalLabel: string;
  online: boolean;
}

/**
 * The populated dashboard with its words removed. Every box is the size of the
 * thing that replaces it, so nothing moves when the data lands (mockup 02c).
 */
function DashboardSkeleton({ goalLabel: label, online }: SkeletonProps) {
  const line = (width: string, height: string, mt = '0') => (
    <span className="skel block" style={{ width, height, marginTop: mt, borderRadius: '999px' }} />
  );
  return (
    <>
      <AppBar title="Study" context={`${label} · loading your progress`} online={online} />
      <main className="wrap stack pt-6" aria-busy="true">
        <VisuallyHidden>
          <h1>Study — loading your progress</h1>
        </VisuallyHidden>
        <p className="sr-only" role="status">
          Loading your progress.
        </p>

        <section className="readout" aria-hidden="true">
          <span className="skel" style={{ width: '76px', height: '96px', flex: 'none', borderRadius: '4px' }} />
          <div className="flex-1 min-w-0">
            {line('52%', '11px')}
            {line('88%', '30px', '0.6rem')}
            {line('70%', '14px', '0.55rem')}
          </div>
        </section>

        <div className="guidesign" aria-hidden="true">
          <div className="guidesign__face">
            <span className="skel skel--onsign block" style={{ width: '44%', height: '10px', borderRadius: '999px' }} />
            {['a', 'b', 'c'].map((row) => (
              <div className="guidesign__dest" key={row}>
                <span className="skel skel--onsign block" style={{ width: '48%', height: '16px', borderRadius: '999px' }} />
                <span className="skel skel--onsign block" style={{ width: '64px', height: '16px', borderRadius: '999px' }} />
              </div>
            ))}
          </div>
        </div>

        <span className="skel block" style={{ height: '48px', borderRadius: '8px' }} aria-hidden="true" />

        <hr className="centreline" />

        <div className="weak" aria-hidden="true">
          {['a', 'b', 'c', 'd'].map((row) => (
            <div className="weakrow weakrow--unmeasured" key={row} style={{ minHeight: '66px' }}>
              <span className="skel" style={{ width: '36px', height: '36px', flex: 'none', borderRadius: '4px' }} />
              <span className="weakrow__t">
                {line('58%', '13px')}
                {line('76%', '10px', '0.4rem')}
              </span>
              <span className="skel" style={{ width: '34px', height: '13px', borderRadius: '999px' }} />
            </div>
          ))}
        </div>
      </main>
    </>
  );
}

/* ------------------------------------------------- content pack unreadable */

function ContentError({
  detail,
  online,
  goalLabel: label,
}: {
  detail: string;
  online: boolean;
  goalLabel: string;
}) {
  return (
    <>
      <AppBar title="Study" context={`${label} · content pack unreadable`} online={online} />
      <main className="wrap stack pt-6">
        <section className="caution" role="alert">
          <SignSvg id="w1-2-curve" size="lg" decorative />
          <div>
            <p className="eyebrow eyebrow--warning">Content pack</p>
            <h1>The question bank did not load</h1>
          </div>
        </section>
        <p className="read">
          The questions and signs ship inside the app, so this is almost always a half-finished
          update rather than anything you did. Reloading fetches the pack again. Nothing you have
          answered is affected — your progress is stored separately and was not touched.
        </p>
        <p className="faint text-[0.75rem] font-mono">{detail}</p>
        <div>
          <Button
            variant="guide"
            block
            onClick={() => {
              window.location.reload();
            }}
          >
            <IconRefresh size={18} />
            Reload the app
          </Button>
          <div className="mt-3">
            <Button variant="quiet" block to="/signs">
              Browse the signs meanwhile
            </Button>
          </div>
        </div>
        <SourceFooter className="mt-6" />
      </main>
    </>
  );
}

/* ------------------------------------------- the saved record cannot be read */

interface UnreadableProps {
  online: boolean;
  goalLabel: string;
  testDate: string | null;
  counts: { bankSize: number; signCount: number } | null;
  keys: RecordReport[];
}

/**
 * Matrix cell 2-error, and the screen X19/X20 land on.
 *
 * Two promises are kept here in code, not just in copy: the record on the
 * device is **not** overwritten (the store is quarantined the moment the load
 * fails — see `store/progress.ts`), and the numbers on this screen are read
 * back off the payload itself rather than guessed at. The reset is the only
 * destructive path and it is gated behind an acknowledgement.
 */
function UnreadableSave({ online, goalLabel: label, counts, keys }: UnreadableProps) {
  const [gate, setGate] = useState(false);
  const [openedAt] = useState(() => Date.now());
  const resetProgress = useProgressStore((s) => s.resetProgress);
  const resetExams = useExamStore((s) => s.resetRecord);
  const resetSigns = useSignStore((s) => s.resetSigns);

  const reports = keys.map((entry) => ({ ...entry, payload: inspectPayload(entry.key, readRaw(entry.key)) }));
  const future = reports.some((report) => report.status === 'future');
  const records = reports.reduce((sum, report) => sum + (report.payload.records ?? 0), 0);
  const bytes = reports.reduce((sum, report) => sum + report.payload.bytes, 0);
  const lastWritten = reports.reduce<number | null>(
    (latest, report) =>
      report.payload.lastWrittenAt !== null && (latest === null || report.payload.lastWrittenAt > latest)
        ? report.payload.lastWrittenAt
        : latest,
    null,
  );

  const exportDiagnostic = () => {
    const at = Date.now();
    const payloads: Record<string, string | null> = {};
    for (const key of OWNED_KEYS) payloads[key] = readRaw(key);
    const blob = new Blob(
      [
        buildDiagnostic({
          at,
          readsUpTo: {
            [STORAGE_KEY]: CURRENT_SCHEMA_VERSION,
            [EXAM_STORAGE_KEY]: EXAM_RECORD_VERSION,
            [SIGN_STORAGE_KEY]: SIGN_RECORD_VERSION,
            [SETUP_STORAGE_KEY]: 1,
          },
          payloads,
        }),
      ],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = diagnosticFileName(at);
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <AppBar title="Study" context={`${label} · saved progress unreadable`} online={online} />
      <main className="wrap stack pt-6">
        <section className="caution" role="alert">
          <SignSvg id="r1-1-stop" size="lg" label="Red octagonal stop sign — a full stop" />
          <div>
            <p className="eyebrow eyebrow--stop">Saved progress halted</p>
            <h1>Your saved progress can&rsquo;t be read</h1>
          </div>
        </section>

        <p className="read">
          {future
            ? 'The saved file was written by a newer version of TN Drive than the one running here, so this build will not touch it — reading it wrong would be worse than not reading it.'
            : 'The saved file is damaged, so this build will not touch it — writing over it would destroy whatever is still in there.'}{' '}
          It is still on the device, exactly as it was. Nothing has been deleted, and nothing you do
          in this session will overwrite it.
        </p>

        <SignPanel as="section" variant="stop" aria-labelledby="diag-head">
          <p className="eyebrow eyebrow--stop mb-2.5" id="diag-head">
            What&rsquo;s on the device
          </p>
          <dl className="plate">
            {reports.map((report) => (
              <div key={report.key}>
                <dt>{`Saved ${report.name}`}</dt>
                <dd className="flag">
                  {report.payload.version === null
                    ? 'unreadable'
                    : `schema ${String(report.payload.version)}`}
                </dd>
              </div>
            ))}
            <div>
              <dt>This app reads up to</dt>
              <dd>{reports.map((r) => `schema ${String(r.reads)}`).join(' · ')}</dd>
            </div>
            <div>
              <dt>Answers held</dt>
              <dd>{records > 0 ? String(records) : 'unreadable'}</dd>
            </div>
            {lastWritten !== null && (
              <div>
                <dt>Last written</dt>
                <dd>{formatStamp(lastWritten)}</dd>
              </div>
            )}
            <div>
              <dt>Size</dt>
              <dd>{`${formatBytes(bytes)} of 5 MB`}</dd>
            </div>
          </dl>
        </SignPanel>

        <section aria-labelledby="fix-head">
          <h2 className="mb-3.5" id="fix-head">
            Pick one
          </h2>
          <div className="fix">
            <Button
              variant="guide"
              block
              onClick={() => {
                window.location.reload();
              }}
            >
              <IconRefresh size={18} />
              {future ? 'Update the app and reopen' : 'Reload and try reading it again'}
            </Button>
            <p className="fix__note">
              {future
                ? 'Most likely fix. A newer version of the app has run on this device; loading it will read the file and put your progress back.'
                : 'Worth one attempt: a half-written save from a closed tab sometimes reads cleanly the second time.'}
            </p>
            <Button variant="quiet" block onClick={exportDiagnostic}>
              <IconDownload size={18} />
              Export a diagnostic file
            </Button>
            <p className="fix__note">
              Saves <span className="num">{diagnosticFileName(openedAt)}</span> to this device —
              the raw file plus the version numbers above. It never leaves the phone unless you send
              it somewhere.
            </p>
          </div>

          <div className="danger-zone">
            <p className="eyebrow eyebrow--stop mb-1.5">Last resort</p>
            <h3 className="mb-1.5">Reset saved progress</h3>
            <p className="dim text-[0.875rem]">
              {`Deletes the unreadable file and starts a clean one. You lose ${records > 0 ? `${String(records)} recorded answers` : 'whatever is in it'}, your streak and any exam results. Export the diagnostic first if you want a copy.`}
            </p>
            <div className="mt-3.5">
              <ConfirmGate checked={gate} onChange={setGate}>
                I understand this erases the saved file and cannot be undone.
              </ConfirmGate>
            </div>
            <div className="mt-3.5">
              <Button
                variant="danger"
                block
                disabled={!gate}
                describedBy="reset-hint"
                onClick={() => {
                  if (!gate) return;
                  resetProgress();
                  resetExams();
                  resetSigns();
                }}
              >
                Reset saved progress
              </Button>
              <p className="faint text-[0.75rem] mt-2" id="reset-hint">
                {gate
                  ? 'This erases the saved file and starts a clean one.'
                  : 'Tick the box above to enable this.'}
              </p>
            </div>
          </div>
        </section>

        <hr className="centreline" />

        <SignPanel as="section" variant="guide" aria-labelledby="unaffected-head">
          <p className="eyebrow eyebrow--guide mb-1.5">Unaffected</p>
          <h3 className="mb-1.5" id="unaffected-head">
            You can keep studying now
          </h3>
          <p className="dim text-[0.875rem]">
            The question bank ships inside the app, so none of it depends on the saved file. Answers
            from this session will not be recorded until the above is sorted.
          </p>
          <KeepsList
            items={[
              counts ? `${String(counts.bankSize)} questions` : 'Every question',
              counts ? `${String(counts.signCount)} signs` : 'Every sign',
              'Mock exams',
              'Citations',
            ]}
          />
          <div className="mt-4">
            <Button variant="quiet" block to="/study/session">
              Study without saving
            </Button>
          </div>
        </SignPanel>

        <SourceFooter className="mt-6" />
      </main>
    </>
  );
}
