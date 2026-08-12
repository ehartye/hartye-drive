import { Fragment } from 'react';
import { Link } from 'react-router';
import { Button, SignSvg } from '~/components';
import { IconCheck, IconX } from '~/components/Icon';
import type { SeriesPoint } from '~/domain/charts';
import { READINESS_TARGET } from '~/domain/progress-report';
import type { AreaRow, HistoryEvent, StudyRun } from '~/domain/progress-report';
import type { ExamAttempt } from '~/domain/exam-history';
import { formatDay, formatDuration, formatMonth, formatWhen, monthKey } from './format';

/* ------------------------------------------------- the charts, as tables */

/**
 * Every chart is backed by a visually-hidden table. A picture that cannot be
 * read is not evidence, and this is the version that survives a screen reader,
 * a print stylesheet and a copy-paste into an email.
 */
export function ReadinessTable({
  series,
  examsAt,
}: {
  series: readonly SeriesPoint[];
  examsAt: ReadonlyMap<number, string>;
}) {
  if (series.length === 0) return null;
  return (
    <table className="sr-only">
      <caption>
        {`Readiness after each sitting, ${formatDay(series[0]?.at ?? 0)} to ${formatDay(
          series.at(-1)?.at ?? 0,
        )}`}
      </caption>
      <thead>
        <tr>
          <th scope="col">Sitting</th>
          <th scope="col">Readiness</th>
          <th scope="col">Mock exam</th>
        </tr>
      </thead>
      <tbody>
        {series.map((point) => (
          <tr key={point.at}>
            <td>{formatDay(point.at)}</td>
            <td>{`${String(point.value)}%`}</td>
            <td>{examsAt.get(point.at) ?? 'none'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function BlueprintTable({ rows }: { rows: readonly AreaRow[] }) {
  return (
    <table className="sr-only">
      <caption>{`Accuracy by exam area, target ${String(READINESS_TARGET)} percent`}</caption>
      <thead>
        <tr>
          <th scope="col">Exam area</th>
          <th scope="col">Correct</th>
          <th scope="col">Answered</th>
          <th scope="col">Accuracy</th>
          <th scope="col">Against target</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>{row.label}</td>
            <td>{row.touched ? row.correct : '—'}</td>
            <td>{row.touched ? row.seen : '—'}</td>
            <td>{row.touched ? `${String(row.percent)}%` : 'not answered yet'}</td>
            <td>
              {!row.touched
                ? 'not started'
                : row.meetsTarget
                  ? 'past target'
                  : `${String(row.pointsShort)} points short`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ------------------------------------------------------- attempt history */

const scoreTone = (correct: number, outOf: number): string => {
  if (outOf === 0) return '';
  const percent = (correct / outOf) * 100;
  if (percent >= READINESS_TARGET) return ' score--ok';
  if (percent < 50) return ' score--bad';
  return '';
};

function examLine(attempt: ExamAttempt): string {
  switch (attempt.verdict) {
    case 'pass':
      return 'Mock exam · passed';
    case 'halted':
      return 'Mock exam · ended early at seven wrong';
    default:
      return 'Mock exam · did not pass';
  }
}

function runLine(run: StudyRun, labelFor: (topicId: string) => string): string {
  const [first, second] = run.topics;
  if (first === undefined) return 'Study session';
  if (second === undefined) return `Study session · ${labelFor(first)}`;
  return `Study session · ${labelFor(first)} and ${String(run.topics.length - 1)} more`;
}

interface HistoryListProps {
  events: readonly HistoryEvent[];
  now: number;
  labelFor: (topicId: string) => string;
  /** Month headings only once the history is long enough to need them. */
  grouped: boolean;
}

/**
 * The road already driven: a dashed centre line with a node for every sitting.
 * The node's colour is a passed or missed mock exam — and the same fact is
 * written out in the row's own words, so the colour is never the carrier (A3).
 */
export function HistoryList({ events, now, labelFor, grouped }: HistoryListProps) {
  const groups = grouped ? groupByMonth(events) : [{ key: 'all', label: '', events }];

  return (
    <>
      {groups.map((group) => (
        <Fragment key={group.key}>
          {grouped && (
            <p className="monthhead">
              <span>{group.label}</span>
              <span className="monthhead__n">
                {`${String(group.events.length)} ${group.events.length === 1 ? 'sitting' : 'sittings'}`}
              </span>
            </p>
          )}
          <ol className="trace">
            {group.events.map((event) =>
              event.kind === 'exam' ? (
                <li key={event.attempt.id}>
                  <span
                    className={`trace__node trace__node--${
                      event.attempt.verdict === 'pass' ? 'pass' : 'fail'
                    }`}
                    aria-hidden="true"
                  />
                  <div className="spread items-start">
                    <div className="min-w-0">
                      <p className="trace__kind">{examLine(event.attempt)}</p>
                      <p className="trace__meta">
                        {`${formatWhen(event.at, now)} · ${formatDuration(
                          event.attempt.elapsedSeconds * 1000,
                        )}`}
                      </p>
                    </div>
                    <span
                      className={`score${scoreTone(event.attempt.correct, event.attempt.outOf)}`}
                    >
                      {event.attempt.verdict === 'pass' ? (
                        <IconCheck size={11} />
                      ) : (
                        <IconX size={11} />
                      )}
                      {`${String(event.attempt.correct)}/${String(event.attempt.outOf)}`}
                    </span>
                  </div>
                </li>
              ) : (
                <li key={event.run.id}>
                  <span className="trace__node" aria-hidden="true" />
                  <div className="spread items-start">
                    <div className="min-w-0">
                      <p className="trace__kind">{runLine(event.run, labelFor)}</p>
                      <p className="trace__meta">
                        {`${formatWhen(event.at, now)} · ${String(event.run.asked)} ${
                          event.run.asked === 1 ? 'question' : 'questions'
                        } · ${formatDuration(event.run.endedAt - event.run.startedAt)}`}
                      </p>
                    </div>
                    <span className={`score${scoreTone(event.run.correct, event.run.asked)}`}>
                      {`${String(event.run.correct)}/${String(event.run.asked)}`}
                    </span>
                  </div>
                </li>
              ),
            )}
          </ol>
        </Fragment>
      ))}
    </>
  );
}

function groupByMonth(
  events: readonly HistoryEvent[],
): { key: string; label: string; events: HistoryEvent[] }[] {
  const groups: { key: string; label: string; events: HistoryEvent[] }[] = [];
  for (const event of events) {
    const key = monthKey(event.at);
    const current = groups.at(-1);
    if (current && current.key === key) current.events.push(event);
    else groups.push({ key, label: formatMonth(event.at), events: [event] });
  }
  return groups;
}

/* ------------------------------------------------------------ zero state */

/**
 * What will land here once there is something to chart. The empty progress page
 * is an invitation, and an invitation has to say what is being offered.
 */
export function WhatLandsHere() {
  return (
    <section className="panel panel--route" aria-labelledby="lands-h">
      <p className="eyebrow eyebrow--route mb-3" id="lands-h">
        What lands on this page
      </p>
      <ul className="whatlist">
        <li>
          <svg
            className="ico"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M3 17l5-6 4 3 4-6 5 4" />
            <path d="M3 21h18" />
          </svg>
          <div>
            <b>A readiness line</b>
            <span>
              {`One reading per sitting, climbing (or not) toward the ${String(READINESS_TARGET)}% you need. Drawn from the first session onward.`}
            </span>
          </div>
        </li>
        <li>
          <svg
            className="ico"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M3 5h13M3 11h9M3 17h16" />
          </svg>
          <div>
            <b>Accuracy in each quarter of the test</b>
            <span>
              Four lanes, one per exam area, so you can see which quarter is dragging the other
              three down.
            </span>
          </div>
        </li>
        <li>
          <SignSvg
            id="w1-2-curve"
            className="sign"
            label="Yellow warning diamond: the mark used for a topic you are weak on"
          />
          <div>
            <b>Your weak topics, named</b>
            <span>
              Every topic you have touched, with the score, and a caution diamond on the ones worth
              going back to.
            </span>
          </div>
        </li>
        <li>
          <svg
            className="ico"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M12 3v18" />
            <circle cx="12" cy="7" r="2.5" />
            <circle cx="12" cy="17" r="2.5" />
          </svg>
          <div>
            <b>Every session and mock exam you have taken</b>
            <span>Kept on this device, exportable as a file, never sent anywhere.</span>
          </div>
        </li>
      </ul>
    </section>
  );
}

/**
 * The readiness chart is not drawn with no data. An empty time series has
 * nothing true to say, and drawing its axes would be theatre — state-matrix
 * cell 9-empty says so in as many words.
 */
export function ChartNotOpenYet() {
  return (
    <div className="workzone">
      <SignSvg
        id="w20-1-road-work-ahead"
        size="sm"
        label="Orange diamond work-zone sign: this section is not built yet"
      />
      <div>
        <p className="workzone__t">This chart needs one session to exist</p>
        <p className="workzone__s">
          We would rather show you an empty road than a graph of nothing. Answer twelve questions
          and the first reading appears here — then one more every time you study.
        </p>
      </div>
    </div>
  );
}

/**
 * What this page has to say while a saved record sits on the device that this
 * build cannot read.
 *
 * It is emphatically **not** the empty state. Empty means "you have not started
 * yet, here is how"; this means "you have a history and we cannot get at it" —
 * and the difference matters enough that showing the wrong one is the whole
 * defect. Reporting 0% readiness and 0 topics touched here would contradict the
 * dashboard's promise that nothing has been deleted, and it would invite the
 * learner to start a first session that will not be recorded.
 *
 * The recovery itself lives on one screen (Study), because it needs the raw
 * payload, the diagnostic export and an acknowledgement. This names the problem
 * and hands them over.
 */
export function HistoryUnreadable({ records }: { records: string }) {
  return (
    <>
      <section className="caution" role="alert">
        <SignSvg id="r1-1-stop" size="lg" label="Red octagonal stop sign — a full stop" />
        <div>
          <p className="eyebrow eyebrow--stop">Saved progress halted</p>
          <h1>There is nothing to chart until your record can be read</h1>
        </div>
      </section>

      <p className="read">
        {`Your ${records} is still on this device, exactly as it was — this build just cannot read it, so none of it can be charted or counted. Nothing has been deleted. Every figure on this page would be a zero that isn't true, so the page holds off rather than print one.`}
      </p>

      <div>
        <Button variant="guide" block to="/">
          See what is on the device
        </Button>
        <p className="dim text-center mt-2 text-[0.8125rem]">
          The Study screen shows the file, offers a diagnostic copy, and is the only place that can
          clear it.
        </p>
      </div>
    </>
  );
}

/** The single honest node on an empty history: you are here. */
export function StartOfTheRoad() {
  return (
    <ol className="trace">
      <li>
        <span className="trace__node trace__node--here" aria-hidden="true" />
        <p className="trace__kind">You are here</p>
        <p className="trace__meta">
          Nothing behind you yet. Your first session lands at the top of this list.
        </p>
      </li>
    </ol>
  );
}

export function ProgressFooter() {
  return (
    <p className="faint text-[0.75rem] text-center leading-normal mt-6">
      Every figure here is computed on this device and stays on it. There is no account and nothing
      to sync.
      <br />
      Source: Tennessee Comprehensive Driver License Manual.{' '}
      <Link className="citelink" to="/settings">
        Sources and corrections
      </Link>
      <br />
      Not affiliated with the State of Tennessee.
    </p>
  );
}
