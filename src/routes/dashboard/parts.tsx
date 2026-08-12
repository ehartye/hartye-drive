import { Link } from 'react-router';
import type { ReactNode } from 'react';
import { Button, RouteShield, SignPanel, SignSvg, VisuallyHidden } from '~/components';
import { IconArrowRight, IconCheck, IconShare, IconSigns } from '~/components/Icon';
import type { RouteRow, Streak, TopicRow } from '~/domain/dashboard';
import { relativeDay } from '~/domain/dashboard';
import { signForTopic } from '~/routes/study/support';
import type { BlueprintArea } from '~/content';

/* ------------------------------------------------------- the readiness plate */

export interface ReadinessPlateProps {
  percent: number;
  /** Dimmed and dashed until there is anything to measure. */
  measured: boolean;
}

/**
 * Readiness reads as a speed-limit sign — the app's chrome built from the same
 * sign system it teaches (grounding §2 signature). It is `aria-hidden` because
 * the figure is stated in words beside it; a screen reader hearing "TEST READY
 * 72" twice learns nothing the second time.
 */
export function ReadinessPlate({ percent, measured }: ReadinessPlateProps) {
  return (
    <div className={`speedplate${measured ? '' : ' speedplate--zero'}`} aria-hidden="true">
      <b>TEST</b>
      <b>READY</b>
      <strong>{measured ? percent : 0}</strong>
    </div>
  );
}

/* ------------------------------------------------- the signature: guide sign */

export interface GuideSignProps {
  rows: readonly RouteRow[];
  /** The one line of small print the sign's numbers need. */
  note?: string;
}

/** Progress rendered as an overhead guide sign: destinations and distances. */
export function GuideSign({ rows, note }: GuideSignProps) {
  return (
    <section aria-labelledby="route-legend">
      <div className="guidesign">
        <div className="guidesign__face">
          <p className="guidesign__legend" id="route-legend">
            Route to your test
          </p>
          {rows.map((row) => (
            <div className="guidesign__dest" key={row.id}>
              <b>{row.label}</b>
              <span className="guidesign__dist">
                {row.value === 0 ? <em>0</em> : row.value}
                <small>{` OF ${String(row.target)}`}</small>
              </span>
            </div>
          ))}
        </div>
      </div>
      {note && <p className="guidesign__note">{note}</p>}
    </section>
  );
}

/* -------------------------------------------------------------- weak topics */

export interface WeakRowProps {
  row: TopicRow;
  now: number;
  /** The taxonomy's label and area, passed in with the loaded content pack. */
  label: string;
  area: BlueprintArea;
  /** Where pressing it goes — a session made of that topic's questions. */
  to: string;
}

export function WeakRow({ row, now, label, area, to }: WeakRowProps) {
  return (
    <Link className="weakrow" to={to}>
      <SignSvg id={signForTopic(row.topic, area)} size="sm" decorative />
      <span className="weakrow__t">
        <span className="weakrow__n">{label}</span>
        <span className="weakrow__s">
          {`${String(row.correct)} of ${String(row.seen)} correct · last seen ${relativeDay(row.lastSeenAt, now)}`}
        </span>
      </span>
      <span className="weakrow__pct">{`${String(row.percent)}%`}</span>
    </Link>
  );
}

export interface StarterRowProps {
  topic: string;
  label: string;
  area: BlueprintArea;
  questionCount: number;
  to: string;
}

/** The same row before anything has been measured: structure, honestly empty. */
export function StarterRow({ topic, label, area, questionCount, to }: StarterRowProps) {
  return (
    <Link className="weakrow weakrow--unmeasured" to={to}>
      <SignSvg id={signForTopic(topic, area)} size="sm" decorative />
      <span className="weakrow__t">
        <span className="weakrow__n">{label}</span>
        <span className="weakrow__s">{`${String(questionCount)} questions · not measured`}</span>
      </span>
      <span className="weakrow__pct" aria-hidden="true">
        —
      </span>
      <VisuallyHidden>Not measured yet</VisuallyHidden>
    </Link>
  );
}

export function SlowDownHeader() {
  return (
    <div className="spread mb-3.5">
      <h2>Slow down here</h2>
      <SignSvg id="w1-2-curve" size="sm" decorative />
    </div>
  );
}

/* ------------------------------------------------------------------ streak */

export interface StreakPanelProps {
  streak: Streak;
}

export function StreakPanel({ streak }: StreakPanelProps) {
  const { current, longest, isBest, days } = streak;
  const line =
    current === 0
      ? 'Today starts it'
      : isBest
        ? `${String(current)} ${current === 1 ? 'day' : 'days'} · longest run yet`
        : `${String(current)} ${current === 1 ? 'day' : 'days'} · best is ${String(longest)}`;

  return (
    <SignPanel as="section" flat aria-labelledby="streak-head">
      <div className="spread mb-3.5">
        <div>
          <p className="eyebrow mb-1" id="streak-head">
            Study streak
          </p>
          <p className="dim text-[0.875rem]">{line}</p>
        </div>
        <span
          className="num text-[1.75rem] font-bold"
          style={{ color: current > 0 ? 'var(--color-warning)' : 'var(--color-sign-faint)' }}
        >
          {current}
        </span>
      </div>
      <div className="streakstrip" aria-hidden="true">
        {days.map((day) => (
          <span
            key={day.key}
            className={`day${day.studied ? ' day--on' : ''}${day.isToday ? ' day--today' : ''}`}
          />
        ))}
      </div>
      <VisuallyHidden>
        {`Studied on ${String(days.filter((d) => d.studied).length)} of the last ${String(days.length)} days.`}
      </VisuallyHidden>
    </SignPanel>
  );
}

/* --------------------------------------------------------------- exam panel */

export interface ExamPanelProps {
  eyebrow: string;
  body: string;
  recommended: boolean;
  threshold: number;
  /** Desktop puts the prose under the head rather than beside the shield. */
  stacked?: boolean;
}

export function ExamPanel({ eyebrow, body, recommended, threshold, stacked = false }: ExamPanelProps) {
  const prose = (
    <p className="dim text-[0.875rem]" style={stacked ? { marginTop: '0.5rem' } : undefined}>
      {body}
    </p>
  );
  return (
    <SignPanel as="section" variant={recommended ? 'guide' : 'warn'} aria-labelledby="exam-head">
      <div className="spread items-start">
        <div className="flex-1">
          <p className={`eyebrow ${recommended ? 'eyebrow--guide' : 'eyebrow--warning'} mb-1.5`}>
            {eyebrow}
          </p>
          <h3 className="mb-1.5" id="exam-head">
            Take a full mock exam
          </h3>
          {!stacked && prose}
        </div>
        <RouteShield
          value={threshold}
          locked={!recommended}
          label={
            recommended
              ? `Readiness gate of ${String(threshold)} percent, cleared`
              : `Mock exam is recommended from ${String(threshold)} percent readiness`
          }
        />
      </div>
      {stacked && prose}
      <div className="mt-4">
        <Button variant={recommended ? 'guide' : 'quiet'} block to="/exam">
          {recommended ? 'Start a mock exam' : 'Take it anyway'}
        </Button>
      </div>
    </SignPanel>
  );
}

/* -------------------------------------------------------------- offline bits */

export function OfflineStrip() {
  return (
    <div className="offlinestrip" role="status">
      <IconSigns size={20} />
      <p>
        <b>No connection.</b>{' '}
        <span className="dim">
          Nothing on this screen needs one — the whole app is stored on your phone.
        </span>
      </p>
    </div>
  );
}

export interface ContentPackProps {
  bankSize: number;
  signCount: number;
  officialCount: number;
}

/** What is actually stored on this device, stated plainly. Matrix note 7. */
export function ContentPack({ bankSize, signCount, officialCount }: ContentPackProps) {
  return (
    <SignPanel as="section" flat aria-labelledby="pack-head">
      <div className="row mb-3.5">
        <SignSvg id="d9-7-gas" size="sm" decorative />
        <div className="flex-1">
          <p className="eyebrow mb-0.5" id="pack-head">
            Content pack
          </p>
          <p className="dim text-[0.875rem]">Stored on this device</p>
        </div>
        <span className="badge badge--live">Bundled</span>
      </div>
      <dl className="plate">
        <div>
          <dt>Questions · signs</dt>
          <dd className="ok">{`${String(bankSize)} · ${String(signCount)}`}</dd>
        </div>
        <div>
          <dt>State-authored questions</dt>
          <dd>{String(officialCount)}</dd>
        </div>
        <div>
          <dt>Blueprint</dt>
          <dd>25 / 25 / 25 / 25</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>TN manual, Jul 1 2022</dd>
        </div>
      </dl>
      <p className="dim text-[0.8125rem] leading-normal mt-3.5">
        The pack ships inside the app, so there is nothing to download and nothing to wait for.
        Updates install only when you open the app with a connection, and never in the middle of an
        exam. Nothing is uploaded, then or ever.
      </p>
    </SignPanel>
  );
}

export interface InstallPanelProps {
  offer: 'prompt' | 'ios';
  onInstall: () => void;
  onDismiss: () => void;
}

/**
 * Offline is the feature, so this is an upgrade rather than a nag — and it
 * branches on the platform, because iOS Safari fires no `beforeinstallprompt`
 * and exposes no install API. A button that cannot work must not be drawn
 * there; the three taps are the honest affordance (grounding §1).
 */
export function InstallPanel({ offer, onInstall, onDismiss }: InstallPanelProps) {
  return (
    <SignPanel as="section" variant="guide" aria-labelledby="install-head">
      <div className="install">
        <span className="tile-preview" aria-hidden="true">
          TN
        </span>
        <div className="flex-1 min-w-0">
          <p className="eyebrow eyebrow--guide mb-1">Keep it on your phone</p>
          <h3 className="mb-1.5" id="install-head">
            Add to home screen
          </h3>
          <p className="dim text-[0.875rem]">
            Opens like an app, with no browser bar and no network at all. Same questions, same
            signs, in the Driver Service Center car park.
          </p>
        </div>
      </div>

      {offer === 'prompt' ? (
        <div className="row mt-4 flex-wrap gap-3">
          <Button variant="guide" onClick={onInstall}>
            Add to home screen
          </Button>
          <Button variant="quiet" onClick={onDismiss}>
            Not now
          </Button>
        </div>
      ) : (
        <>
          <ol className="steps">
            <li>
              Tap <b>Share</b>
              <IconShare size={14} /> in the Safari toolbar.
            </li>
            <li>
              Scroll down the sheet and tap <b>Add to Home Screen</b>.
            </li>
            <li>
              Tap <b>Add</b>. TN Drive lands beside your other apps.
            </li>
          </ol>
          <p className="faint text-[0.75rem] leading-normal mt-3">
            Safari gives a web app no way to open that sheet for you, so there is no button here to
            press — instructions are the honest affordance.
          </p>
          <div className="mt-3">
            <Button variant="quiet" block onClick={onDismiss}>
              Not now
            </Button>
          </div>
        </>
      )}
    </SignPanel>
  );
}

/* ------------------------------------------------------------------ chrome */

export function SourceFooter({ className = '' }: { className?: string }) {
  return (
    <p className={`faint text-[0.75rem] text-center leading-normal ${className}`}>
      Questions cite the Tennessee Comprehensive Driver License Manual.
      <br />
      Not affiliated with the State of Tennessee.
    </p>
  );
}

export interface PrimaryCtaProps {
  to: string;
  children: ReactNode;
  under: string;
}

export function PrimaryCta({ to, children, under }: PrimaryCtaProps) {
  return (
    <div>
      <Button variant="guide" block to={to} className="text-[1.0625rem]">
        {children}
        <IconArrowRight size={18} />
      </Button>
      <p className="dim text-center text-[0.8125rem] mt-2">{under}</p>
    </div>
  );
}

export function KeepsList({ items }: { items: readonly string[] }) {
  return (
    <ul className="keeps">
      {items.map((item) => (
        <li key={item}>
          <IconCheck size={12} />
          {item}
        </li>
      ))}
    </ul>
  );
}
