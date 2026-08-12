import { useId } from 'react';
import {
  diamondPath,
  downsample,
  laneFill,
  markerFor,
  octagonPath,
  plotSeries,
  polylinePath,
} from '~/domain/charts';
import type { SeriesPoint } from '~/domain/charts';
import { READINESS_TARGET } from '~/domain/progress-report';
import type { AreaRow } from '~/domain/progress-report';
import type { MasteryBand } from '~/domain/mastery';
import { formatDay } from './format';

/**
 * The two charts, hand-authored inline SVG. Grounding §1 forbids a chart
 * library, and these are drawn in roadway vocabulary rather than dashboard
 * vocabulary:
 *
 *  - the readiness trend is a **road** — a grey carriageway with a yellow
 *    dashed centre line, climbing toward the pass mark, which is a small green
 *    guide sign hung above it;
 *  - accuracy by blueprint area is a **four-lane road seen from above**: one
 *    lane per exam area, lane stripes between them, and the 80% target drawn
 *    across all four.
 *
 * Nothing is carried by colour alone (§5). Lanes below target are also
 * **hatched**; a mock exam passed is a **diamond** and one missed is a **stop
 * octagon**; and every chart is backed by a visually-hidden data table, so the
 * figures survive with the picture switched off entirely.
 *
 * All the arithmetic lives in `src/domain/charts.ts`. These components emit
 * strings and nothing else.
 */

/* ------------------------------------------------------------ the trend */

/** The plotting area inside the 320×150 viewBox. */
const BOX = { x: 30, y: 14, width: 286, height: 114 };

/** Past this many readings the dots stop being legible and the road carries it. */
const DOT_LIMIT = 30;

/** More than this and the individual readings are thinned before plotting. */
const PLOT_LIMIT = 60;

export interface ExamMark {
  id: string;
  at: number;
  passed: boolean;
  correct: number;
  outOf: number;
}

export interface ReadinessChartProps {
  series: readonly SeriesPoint[];
  exams: readonly ExamMark[];
}

const valueFor = (target: number) => BOX.y + BOX.height * (1 - target / 100);

export function ReadinessChart({ series, exams }: ReadinessChartProps) {
  const baseId = useId();
  const titleId = `${baseId}-t`;
  const descId = `${baseId}-d`;

  const plotted = plotSeries(downsample(series, PLOT_LIMIT), BOX);
  const road = polylinePath(plotted);
  const dense = plotted.length > DOT_LIMIT;
  const passY = valueFor(READINESS_TARGET);

  const first = series[0];
  const last = series.at(-1);
  const middle = series[Math.floor((series.length - 1) / 2)];
  const passed = exams.filter((exam) => exam.passed).length;

  return (
    <svg viewBox="0 0 320 150" role="img" aria-labelledby={`${titleId} ${descId}`}>
      <title id={titleId}>
        {`Readiness from ${first ? formatDay(first.at) : ''} to ${
          last ? formatDay(last.at) : ''
        }, drawn as a road climbing toward the ${String(READINESS_TARGET)} percent pass mark`}
      </title>
      <desc id={descId}>
        {`${String(series.length)} readings rising from ${String(first?.value ?? 0)} percent to ${String(
          last?.value ?? 0,
        )} percent. The pass mark of ${String(READINESS_TARGET)} percent has ${
          (last?.value ?? 0) >= READINESS_TARGET ? 'been reached' : 'not been reached yet'
        }. ${String(exams.length)} mock exams are marked along the way; ${String(
          passed,
        )} were passed and ${String(exams.length - passed)} were not. Exact figures follow in the table below.`}
      </desc>

      {/* grid */}
      <g stroke="var(--color-shoulder)" strokeWidth="1">
        <line x1="30" y1="128" x2="316" y2="128" />
        <line x1="30" y1="71" x2="316" y2="71" strokeDasharray="2 4" opacity=".8" />
        <line x1="30" y1="14" x2="316" y2="14" strokeDasharray="2 4" opacity=".8" />
      </g>
      <g
        fill="var(--color-sign-dim)"
        fontFamily="Overpass Mono, monospace"
        fontSize="9"
        textAnchor="end"
      >
        <text x="22" y="131">
          0
        </text>
        <text x="22" y="74">
          50
        </text>
        <text x="22" y="17">
          100
        </text>
      </g>

      {/* the pass mark: a green guide sign hung over the road */}
      <line
        x1="30"
        y1={passY}
        x2="316"
        y2={passY}
        stroke="var(--color-sign-white)"
        strokeWidth="1.5"
        strokeDasharray="6 5"
        opacity=".55"
      />
      <rect
        x="30"
        y={passY - 17}
        width="86"
        height="15"
        rx="2"
        fill="var(--color-guide)"
        stroke="var(--color-sign-white)"
        strokeWidth="1"
      />
      <text
        x="73"
        y={passY - 6}
        textAnchor="middle"
        fontFamily="Overpass, sans-serif"
        fontSize="8.5"
        fontWeight="800"
        letterSpacing="1"
        fill="#FFFFFF"
      >
        {`PASS MARK ${String(READINESS_TARGET)}%`}
      </text>

      {/* the road: carriageway plus dashed centre line */}
      <path
        d={road}
        fill="none"
        stroke="var(--color-sign-white)"
        strokeOpacity=".17"
        strokeWidth={dense ? 7 : 11}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d={road}
        fill="none"
        stroke="var(--color-warning)"
        strokeWidth={dense ? 1.5 : 2}
        strokeDasharray={dense ? '4 5' : '7 9'}
        strokeLinejoin="round"
        opacity=".9"
      />

      {!dense && (
        <g fill="var(--color-sign-white)" opacity=".85">
          {plotted.map((point) => (
            <circle key={`r-${String(point.at)}`} cx={point.x} cy={point.y} r="2.1" />
          ))}
        </g>
      )}

      {/* Mock exams. The OUTCOME is the shape, not the colour: passed is a
          filled guide-green diamond, missed is a hollow stop octagon — the
          project's hard-stop geometry (§2). A learner who cannot separate the
          two hues still reads two different signs. */}
      <g strokeWidth="1.8">
        {exams.map((exam) => {
          const at = markerFor(plotted, exam.at);
          if (!at) return null;
          return exam.passed ? (
            <path
              key={exam.id}
              d={diamondPath(at.x, at.y, 6)}
              fill="var(--color-guide-lit)"
              stroke="var(--color-sign-white)"
              strokeWidth="2"
            />
          ) : (
            <path
              key={exam.id}
              d={octagonPath(at.x, at.y, 6)}
              fill="var(--color-asphalt-raised)"
              stroke="var(--color-stop-lit)"
            />
          );
        })}
      </g>

      <g
        fill="var(--color-sign-dim)"
        fontFamily="Overpass, sans-serif"
        fontSize="8.5"
        fontWeight="700"
        letterSpacing="0.8"
      >
        <text x="30" y="144">
          {first ? formatDay(first.at).toUpperCase() : ''}
        </text>
        {series.length > 2 && middle && (
          <text x="171" y="144" textAnchor="middle">
            {formatDay(middle.at).toUpperCase()}
          </text>
        )}
        <text x="316" y="144" textAnchor="end">
          {last ? formatDay(last.at).toUpperCase() : ''}
        </text>
      </g>
    </svg>
  );
}

/** The shape key. A legend of shapes, so it is not a colour key. */
export function ReadinessKey() {
  return (
    <ul className="key">
      <li>
        <svg viewBox="0 0 22 12" aria-hidden="true">
          <line
            x1="1"
            y1="6"
            x2="21"
            y2="6"
            stroke="var(--color-sign-white)"
            strokeOpacity=".17"
            strokeWidth="9"
            strokeLinecap="round"
          />
          <line
            x1="1"
            y1="6"
            x2="21"
            y2="6"
            stroke="var(--color-warning)"
            strokeWidth="2"
            strokeDasharray="6 5"
          />
        </svg>
        Readiness after each sitting
      </li>
      <li>
        <svg viewBox="0 0 22 12" aria-hidden="true">
          <path
            d="M11,1 L17,6 L11,11 L5,6 Z"
            fill="var(--color-guide-lit)"
            stroke="var(--color-sign-white)"
            strokeWidth="1.5"
          />
        </svg>
        Diamond = mock exam passed
      </li>
      <li>
        <svg viewBox="0 0 22 12" aria-hidden="true">
          <path
            d={octagonPath(11, 6, 5)}
            fill="none"
            stroke="var(--color-stop-lit)"
            strokeWidth="1.5"
          />
        </svg>
        Octagon = mock exam missed
      </li>
    </ul>
  );
}

/* ------------------------------------------------------------ the lanes */

/**
 * The lane's own fill follows the ratified `TopicMeter` bands, so a topic and
 * the area it sits in never disagree about what colour a number is: ≥80% guide,
 * 50–79% warn, <50% stop. Red is reserved for under half.
 */
const LANE_FILL: Record<MasteryBand, string> = {
  guide: 'var(--color-guide-lit)',
  warn: 'var(--color-warning)',
  stop: 'var(--color-stop-lit)',
};

const LANE_TRACK = 320;
const LANE_TOP = 40;
const LANE_STEP = 54;
const LANE_HEIGHT = 24;

export interface BlueprintChartProps {
  rows: readonly AreaRow[];
  /** Each area's published share of the test, e.g. `0.25`. */
  shareOf: (areaId: string) => number;
}

/**
 * Four lanes, always — the blueprint exists before the learner does. A lane
 * with nothing in it reads "NOT DRIVEN YET" rather than as a bar scoring zero,
 * which is the difference between an empty road and a failure.
 */
export function BlueprintChart({ rows, shareOf }: BlueprintChartProps) {
  const baseId = useId();
  const titleId = `${baseId}-t`;
  const descId = `${baseId}-d`;
  const hatchId = `${baseId}-hatch`;
  const targetX = laneFill(READINESS_TARGET, LANE_TRACK);
  const anyTouched = rows.some((row) => row.touched);

  return (
    // 5 units of bleed left and right, 2 top and bottom: the lane labels and
    // the counts are drawn to x=0 and x=320, and without the bleed the SVG's
    // own clip shaves them at narrow widths.
    <svg viewBox="-5 -2 330 244" role="img" aria-labelledby={`${titleId} ${descId}`}>
      <title id={titleId}>
        {anyTouched
          ? 'Accuracy in each of the four exam areas, drawn as four lanes of a road'
          : 'The four exam areas drawn as four empty lanes of road, each a quarter of the test'}
      </title>
      <desc id={descId}>
        {anyTouched
          ? `${rows
              .map((row) =>
                row.touched
                  ? `${row.label} ${String(row.percent)} percent`
                  : `${row.label} not answered yet`,
              )
              .join(', ')}. A dashed line across all four lanes marks the ${String(
              READINESS_TARGET,
            )} percent target; lanes that fall short of it are drawn hatched. Exact figures follow in the table below.`
          : `${rows
              .map((row) => row.label)
              .join(', ')}. Each is a quarter of the test. No lane has any accuracy recorded yet. A dashed line across all four marks the ${String(
              READINESS_TARGET,
            )} percent target you are aiming at.`}
      </desc>

      <defs>
        {/* The shortfall hatch: lanes under target are PATTERNED as well as
            coloured, so the reading survives without colour entirely. */}
        <pattern
          id={hatchId}
          width="7"
          height="7"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="7" stroke="var(--color-asphalt)" strokeWidth="3.2" opacity=".55" />
        </pattern>
      </defs>

      <rect
        x={targetX - 49}
        y="0"
        width="98"
        height="16"
        rx="2"
        fill="var(--color-guide)"
        stroke="var(--color-sign-white)"
        strokeWidth="1"
      />
      <text
        x={targetX}
        y="11.5"
        textAnchor="middle"
        fontFamily="Overpass, sans-serif"
        fontSize="8.5"
        fontWeight="800"
        letterSpacing="1"
        fill="#FFFFFF"
      >
        {`TARGET ${String(READINESS_TARGET)}%`}
      </text>
      <line
        x1={targetX}
        y1="18"
        x2={targetX}
        y2="232"
        stroke="var(--color-sign-white)"
        strokeWidth="1.5"
        strokeDasharray="5 5"
        opacity=".5"
      />

      <g fontFamily="Overpass, sans-serif">
        {rows.map((row, index) => {
          const top = LANE_TOP + LANE_STEP * index;
          const fill = laneFill(row.percent, LANE_TRACK);
          const short = row.touched && !row.meetsTarget;
          return (
            <g key={row.id}>
              <text x="0" y={top - 7} fontSize="12" fontWeight="700" fill="var(--color-sign-white)">
                {row.label}
              </text>
              <text
                x="320"
                y={top - 7}
                textAnchor="end"
                fontSize="10"
                fontFamily="Overpass Mono, monospace"
                fill="var(--color-sign-dim)"
              >
                {row.touched
                  ? `${String(row.correct)} / ${String(row.seen)}`
                  : `${String(Math.round(shareOf(row.id) * 100))}% of test`}
              </text>

              <rect
                x="0"
                y={top}
                width={LANE_TRACK}
                height={LANE_HEIGHT}
                rx="3"
                fill="var(--color-asphalt-sunk)"
                stroke="var(--color-shoulder)"
              />

              {row.touched ? (
                <>
                  {fill > 0 && (
                    <>
                      <rect
                        x="0"
                        y={top}
                        width={fill}
                        height={LANE_HEIGHT}
                        rx="3"
                        fill={LANE_FILL[row.band]}
                      />
                      {short && (
                        <rect
                          x="0"
                          y={top}
                          width={fill}
                          height={LANE_HEIGHT}
                          rx="3"
                          fill={`url(#${hatchId})`}
                        />
                      )}
                    </>
                  )}
                  {/* White reads on guide green at this size (bold, ~15.75px
                      rendered — SC 1.4.3's large-text threshold), and does not
                      read on warning yellow at all. So a lane at target labels
                      itself inside the fill and a lane short of target labels
                      itself on the dark track just past it. Never white on
                      yellow. */}
                  <text
                    x={row.meetsTarget ? Math.max(fill - 6, 34) : fill + 8}
                    y={top + 16}
                    textAnchor={row.meetsTarget ? 'end' : 'start'}
                    fontSize="12"
                    fontWeight="800"
                    fill={row.meetsTarget ? '#FFFFFF' : 'var(--color-sign-white)'}
                  >
                    {`${String(row.percent)}%`}
                  </text>
                </>
              ) : (
                <text
                  x="8"
                  y={top + 16}
                  fontSize="10.5"
                  fontWeight="700"
                  letterSpacing="1.2"
                  fill="var(--color-sign-faint)"
                >
                  NOT DRIVEN YET
                </text>
              )}

              {index < rows.length - 1 && (
                <line
                  x1="0"
                  y1={top + 36}
                  x2="320"
                  y2={top + 36}
                  stroke="var(--color-sign-white)"
                  strokeWidth="1.5"
                  strokeDasharray="11 13"
                  opacity=".2"
                />
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

export function BlueprintKey() {
  return (
    <ul className="key">
      <li>
        <svg viewBox="0 0 22 12" aria-hidden="true">
          <rect x="0" y="1" width="22" height="10" rx="2" fill="var(--color-guide-lit)" />
        </svg>
        At or past target
      </li>
      <li>
        <svg viewBox="0 0 22 12" aria-hidden="true">
          <defs>
            <pattern
              id="key-hatch"
              width="7"
              height="7"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="7"
                stroke="var(--color-asphalt)"
                strokeWidth="3.2"
                opacity=".55"
              />
            </pattern>
          </defs>
          <rect x="0" y="1" width="22" height="10" rx="2" fill="var(--color-warning)" />
          <rect x="0" y="1" width="22" height="10" rx="2" fill="url(#key-hatch)" />
        </svg>
        Hatched = short of target
      </li>
      <li>
        <svg viewBox="0 0 22 12" aria-hidden="true">
          <rect x="0" y="1" width="22" height="10" rx="2" fill="var(--color-stop-lit)" />
          <rect x="0" y="1" width="22" height="10" rx="2" fill="url(#key-hatch)" />
        </svg>
        Red = under half right
      </li>
    </ul>
  );
}
