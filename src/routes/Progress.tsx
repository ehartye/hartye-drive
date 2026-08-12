import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AppBar, Button, SignPanel, SignSvg, StatTile, TopicMeter } from '~/components';
import { IconArrowRight, IconChevronRight } from '~/components/Icon';
import { usePageTitle } from '~/app/usePageTitle';
import { blueprintAreas, topics as topicDefs } from '~/content';
import { DEFAULT_SESSION_SIZE } from '~/domain/session';
import { masteryPercent } from '~/domain/mastery';
import {
  READINESS_TARGET,
  accuracyByArea,
  groupRuns,
  historyTimeline,
  readinessSeries,
  summariseProgress,
  topicRows,
  weakestFirst,
} from '~/domain/progress-report';
import type { AreaRow, TopicRow } from '~/domain/progress-report';
import type { SeriesPoint } from '~/domain/charts';
import { ATTEMPT_HISTORY_LIMIT } from '~/domain/progress';
import { useProgressStore } from '~/store/progress';
import { useExamStore } from '~/store/exam';
import { BlueprintChart, BlueprintKey, ReadinessChart, ReadinessKey } from './progress/charts';
import type { ExamMark } from './progress/charts';
import {
  BlueprintTable,
  ChartNotOpenYet,
  HistoryList,
  ProgressFooter,
  ReadinessTable,
  StartOfTheRoad,
  WhatLandsHere,
} from './progress/parts';
import { formatDay } from './progress/format';

/** Sittings per page in the history, and the point at which months appear. */
const PAGE = 20;
const LONG_HISTORY = 20;

/** Below this many readings the trend needs no range control. */
const RANGE_CONTROL_AT = 20;

type Range = 'all' | 'recent' | 'exams';

/**
 * Progress — where the learner stands against the exam blueprint, and what is
 * still holding them back.
 *
 * Every number on this page is derived in `src/domain/progress-report.ts` from
 * the study record and the exam record. Nothing here is stored, so no figure
 * can drift from the record it came from, and there is no second source of
 * truth for readiness, mastery or history.
 *
 * The charts are hand-authored inline SVG (grounding §1 — no chart library) and
 * each is backed by a visually-hidden table.
 */
export function Progress() {
  usePageTitle('Progress');

  const progress = useProgressStore((s) => s.progress);
  const storageMode = useProgressStore((s) => s.storageMode);
  const examRecord = useExamStore((s) => s.record);

  // Pinned once per visit: "Today" must not change reading mid-session, and a
  // clock read during render would re-run the memos below on every keystroke.
  const [now] = useState(() => Date.now());
  const [range, setRange] = useState<Range>('all');
  const [shown, setShown] = useState(PAGE);

  const exams = examRecord.attempts;

  const summary = useMemo(
    () => summariseProgress(progress, exams, topicDefs),
    [progress, exams],
  );
  const areas = useMemo(
    () => accuracyByArea(progress.topics, topicDefs, blueprintAreas),
    [progress.topics],
  );
  const rows = useMemo(() => topicRows(progress.topics, topicDefs), [progress.topics]);
  const runs = useMemo(() => groupRuns(progress.attempts), [progress.attempts]);
  const events = useMemo(() => historyTimeline(runs, exams), [runs, exams]);

  const fullSeries = useMemo(() => readinessSeries(runs), [runs]);
  const examMarks: ExamMark[] = useMemo(
    () =>
      exams.map((attempt) => ({
        id: attempt.id,
        at: attempt.endedAt,
        passed: attempt.verdict === 'pass',
        correct: attempt.correct,
        outOf: attempt.outOf,
      })),
    [exams],
  );

  const series = useMemo(
    () => seriesForRange(range, fullSeries, examMarks),
    [range, fullSeries, examMarks],
  );

  const examsAt = useMemo(() => {
    const map = new Map<number, string>();
    for (const mark of examMarks) {
      const nearest = nearestReading(fullSeries, mark.at);
      if (nearest === null) continue;
      map.set(
        nearest,
        `${String(mark.correct)} of ${String(mark.outOf)} — ${mark.passed ? 'passed' : 'not passed'}`,
      );
    }
    return map;
  }, [examMarks, fullSeries]);

  const weak = weakestFirst(rows).filter((row) => row.band !== 'guide');
  /** Answers folded into the totals but no longer in the log (grounding §6). */
  const pruned = Math.max(0, summary.answered - progress.attempts.length);
  const long = events.length >= LONG_HISTORY;
  const visible = events.slice(0, shown);
  const remaining = events.length - visible.length;

  if (!summary.hasHistory) {
    return (
      <>
        <AppBar title="Progress" context="Nothing answered yet · 0 sittings" />
        <main className="wrap stack pt-6">
          <section>
            <p className="eyebrow">Progress</p>
            <h1>You haven&rsquo;t set off yet</h1>
            <p className="read mt-2.5">
              {`There is nothing to chart until you answer something. ${String(DEFAULT_SESSION_SIZE)} questions is enough to put a first point on the board and tell you which quarter of the test you are weakest in.`}
            </p>
          </section>

          <div>
            <Button variant="guide" block to="/study/session">
              {`Answer your first ${String(DEFAULT_SESSION_SIZE)} questions`}
              <IconArrowRight size={18} />
            </Button>
            <p className="dim text-center mt-2 text-[0.8125rem]">
              About six minutes · works with no signal
            </p>
          </div>

          <hr className="centreline" />

          <WhatLandsHere />

          <SignPanel as="section" aria-labelledby="trend-h">
            <div className="charthead">
              <h2 id="trend-h">Readiness over time</h2>
              <span className="badge border-work-text text-work-text">Not open yet</span>
            </div>
            <ChartNotOpenYet />
          </SignPanel>

          <SignPanel as="section" aria-labelledby="lanes-h">
            <div className="charthead">
              <h2 id="lanes-h">The four quarters of the test</h2>
              <span className="badge">Published blueprint</span>
            </div>
            <p className="dim text-[0.8125rem] -mt-1.5 mb-4">
              The manual tells you the split before you sit down. Each lane fills as you answer;
              right now all four are open road.
            </p>
            <figure className="chart">
              <BlueprintChart rows={areas} shareOf={shareOf} />
              <figcaption>
                Source: the manual&rsquo;s own description of the test — a quarter each on traffic
                signs and signals, safe driving principles, rules of the road, and drugs and
                alcohol.
              </figcaption>
            </figure>
            <BlueprintTable rows={areas} />
          </SignPanel>

          <hr className="centreline" />

          <section aria-labelledby="hist-h">
            <div className="spread mb-3.5">
              <h2 id="hist-h">Where you&rsquo;ve been</h2>
              <span className="badge">0 sittings</span>
            </div>
            <SignPanel flat>
              <StartOfTheRoad />
            </SignPanel>
          </section>

          <ProgressFooter />
        </main>
      </>
    );
  }

  const first = fullSeries[0];
  const latest = fullSeries.at(-1);
  const delta = first && latest ? latest.value - first.value : 0;

  return (
    <>
      <AppBar
        title="Progress"
        context={`${String(summary.readiness)}% ready · ${String(summary.answered)} answered · ${String(
          summary.sittings,
        )} sittings`}
      />

      <main className="wrap stack pt-6">
        <section className="readout">
          <SignSpeedPlate readiness={summary.readiness} />
          <div className="readout__copy">
            <p className="eyebrow">Progress</p>
            <h1>{headline(summary.readiness)}</h1>
            <p className="dim mt-1.5 text-[0.9375rem]">
              {`${String(summary.readiness)}% of everything you have answered. Tennessee needs ${String(
                READINESS_TARGET,
              )}% — 24 of 30.`}
            </p>
          </div>
        </section>

        <p className="sr-only">
          {`Readiness is your overall accuracy across all ${String(summary.answered)} questions you have answered: ${String(summary.correct)} correct.`}
        </p>

        {long && (
          <div className="grid-tiles">
            {/* The same count the history's own badge carries — a page must
                not report two different numbers for one thing. */}
            <StatTile value={events.length} label="Sittings" />
            <StatTile value={summary.answered} label="Answered" />
            <StatTile
              value={`${String(summary.examsPassed)}/${String(summary.examsTaken)}`}
              label="Exams passed"
            />
          </div>
        )}

        <SignPanel as="section" aria-labelledby="trend-h">
          <div className="charthead">
            <h2 id="trend-h">Readiness over time</h2>
            <span className="delta">
              {`${String(summary.readiness)}% now · ${delta >= 0 ? '+' : ''}${String(delta)} since ${
                first ? formatDay(first.at) : 'the start'
              }`}
            </span>
          </div>

          {fullSeries.length >= RANGE_CONTROL_AT && (
            <div className="row mb-3.5 gap-2.5 flex-wrap">
              <div className="seg" role="group" aria-label="Chart range">
                {(
                  [
                    ['all', `All ${String(fullSeries.length)}`],
                    ['recent', `Last ${String(PAGE)}`],
                    ['exams', 'Exams only'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={range === value}
                    onClick={() => {
                      setRange(value);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {series.length === 0 ? (
            <ChartNotOpenYet />
          ) : (
            <>
              <figure className="chart">
                <ReadinessChart series={series} exams={range === 'exams' ? [] : examMarks} />
                <ReadinessKey />
                <figcaption>
                  {range === 'exams'
                    ? `Each point is a mock exam, scored out of its own paper. Tennessee needs ${String(READINESS_TARGET)}%.`
                    : `Tennessee needs 24 of 30 — ${String(READINESS_TARGET)}%. The line is your running accuracy after every sitting, so one bad session moves it a little and a fortnight of them moves it a lot.`}
                  {/* The headline reads every answer ever given; the trend can
                      only read the answers still kept in full. Saying so is the
                      difference between a rounding gap and an apparent
                      contradiction. */}
                  {pruned > 0 && range !== 'exams' && (
                    <>
                      {' '}
                      {`Drawn from the ${String(progress.attempts.length)} most recent answers — the ${String(pruned)} older ones are counted in the ${String(summary.readiness)}% above but no longer plotted individually.`}
                    </>
                  )}
                </figcaption>
              </figure>
              <ReadinessTable series={series} examsAt={examsAt} />
            </>
          )}
        </SignPanel>

        <SignPanel as="section" aria-labelledby="lanes-h">
          <div className="charthead">
            <h2 id="lanes-h">Accuracy by exam area</h2>
            <span className="delta delta--quiet">{`${String(summary.answered)} answered`}</span>
          </div>
          <p className="dim text-[0.8125rem] -mt-1.5 mb-4">
            The manual publishes the blueprint: the test is a quarter each of these four. One lane
            each — how far down it you have driven is how often you are right.
          </p>
          <figure className="chart">
            <BlueprintChart rows={areas} shareOf={shareOf} />
            <BlueprintKey />
            <figcaption>{laneCaption(areas)}</figcaption>
          </figure>
          <BlueprintTable rows={areas} />
        </SignPanel>

        <hr className="centreline" />

        <section aria-labelledby="topics-h">
          <div className="spread mb-3.5">
            <h2 id="topics-h">Topic by topic</h2>
            <span className="badge">
              {`${String(summary.topicsTouched)} ${summary.topicsTouched === 1 ? 'topic' : 'topics'} touched`}
            </span>
          </div>

          {groupByArea(rows, areas).map((group) => (
            <SignPanel flat key={group.area.id} className="mt-3.5 first:mt-0">
              <p
                className={`eyebrow mb-3 ${
                  group.rows.every((row) => row.band === 'guide') ? 'eyebrow--guide' : 'eyebrow--warning'
                }`}
              >
                {group.area.label}
              </p>
              {weakestFirst(group.rows).map((row) => (
                <TopicMeter
                  key={row.id}
                  name={row.label}
                  correct={row.correct}
                  total={row.seen}
                />
              ))}
            </SignPanel>
          ))}

          {weak.length > 0 && (
            <>
              <div className="mt-4">
                <Button variant="guide" block to="/study/session">
                  {`Drill the ${String(weak.length)} ${weak.length === 1 ? 'topic' : 'topics'} you're weakest on`}
                  <IconArrowRight size={18} />
                </Button>
              </div>
              <p className="dim text-center mt-2.5 text-[0.8125rem]">
                {`${String(DEFAULT_SESSION_SIZE)} questions · about six minutes · the session weights itself toward ${weak
                  .slice(0, 2)
                  .map((row) => row.label.toLowerCase())
                  .join(' and ')}`}
              </p>
            </>
          )}
        </section>

        <hr className="centreline" />

        <section aria-labelledby="hist-h">
          <div className="spread mb-3.5">
            <h2 id="hist-h">Where you&rsquo;ve been</h2>
            <span className="badge">
              {`${String(events.length)} ${events.length === 1 ? 'sitting' : 'sittings'}`}
            </span>
          </div>

          <SignPanel flat>
            <HistoryList
              events={visible}
              now={now}
              labelFor={labelFor}
              grouped={long}
            />

            {remaining > 0 && (
              <div className="mt-5">
                <Button
                  variant="quiet"
                  block
                  onClick={() => {
                    setShown((count) => count + PAGE);
                  }}
                >
                  {`Load ${String(Math.min(PAGE, remaining))} more · ${String(remaining)} left`}
                </Button>
              </div>
            )}

            <p className="faint text-[0.75rem] text-center leading-normal mt-4">
              {`Your most recent ${String(ATTEMPT_HISTORY_LIMIT)} answers are kept in full on this device. Anything older is folded into the totals above and then dropped, so this never fills your storage.`}
            </p>

            {/* One export, in one place. Settings owns the file and the
                warning that goes with it; this is the way in. */}
            <Link className="linkrow mt-4" to="/settings">
              Export your progress
              <IconChevronRight size={16} />
            </Link>
          </SignPanel>
        </section>

        {storageMode === 'session-only' && (
          <p className="faint text-[0.75rem] text-center leading-normal">
            This device is not letting the app save anything, so nothing on this page will be
            remembered after you close the tab.
          </p>
        )}

        <ProgressFooter />
      </main>
    </>
  );
}

/* ------------------------------------------------------------------ bits */

/**
 * Readiness as a speed-limit sign — §2's signature: your readiness reads as a
 * speed limit. Decorative, because the figure is stated in words immediately
 * beside it and again in the visually-hidden sentence below; naming the sign
 * would make a screen reader read the same number three times.
 *
 * The registry's own R2-1, driven by a value. No second sign implementation.
 */
function SignSpeedPlate({ readiness }: { readiness: number }) {
  return <SignSvg id="r2-1-speed-limit" size="lg" value={readiness} decorative />;
}

function headline(readiness: number): string {
  if (readiness >= READINESS_TARGET) return 'Past the pass mark';
  if (readiness >= 65) return 'Closing on the pass mark';
  if (readiness >= 40) return 'Climbing';
  return 'Early days';
}

const labelFor = (topicId: string): string =>
  topicDefs.find((def) => def.id === topicId)?.label ?? topicId;

const shareOf = (areaId: string): number =>
  blueprintAreas.find((area) => area.id === areaId)?.share ?? 0.25;

function laneCaption(areas: readonly AreaRow[]): string {
  const short = areas.filter((area) => area.touched && !area.meetsTarget);
  if (short.length === 0) {
    return `Every area you have touched is at or past ${String(READINESS_TARGET)}%. That is what walking in ready looks like.`;
  }
  return `${short.length === 1 ? 'One lane is' : `${String(short.length)} lanes are`} hatched — short of target. ${
    short.length === 1 ? 'It is' : 'They are'
  } a quarter of the real test each.`;
}

function groupByArea(
  rows: readonly TopicRow[],
  areas: readonly AreaRow[],
): { area: AreaRow; rows: TopicRow[] }[] {
  return areas
    .map((area) => ({ area, rows: rows.filter((row) => row.area === area.id) }))
    .filter((group) => group.rows.length > 0)
    .sort((a, b) => a.area.percent - b.area.percent);
}

function nearestReading(series: readonly SeriesPoint[], at: number): number | null {
  let best: number | null = null;
  let gap = Number.POSITIVE_INFINITY;
  for (const point of series) {
    const distance = Math.abs(point.at - at);
    if (distance < gap) {
      gap = distance;
      best = point.at;
    }
  }
  return best;
}

function seriesForRange(
  range: Range,
  full: readonly SeriesPoint[],
  exams: readonly ExamMark[],
): SeriesPoint[] {
  switch (range) {
    case 'recent':
      return full.slice(-PAGE);
    case 'exams':
      return exams.map((exam) => ({
        at: exam.at,
        value: masteryPercent(exam.correct, exam.outOf),
      }));
    default:
      return [...full];
  }
}
