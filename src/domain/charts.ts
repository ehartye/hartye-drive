/**
 * Chart geometry — the arithmetic behind the hand-authored SVG.
 *
 * Grounding §1 forbids a chart library, which means the projection, the path
 * strings and the marker geometry are ours to get right. They live here rather
 * than inside a component for the same reason scoring does: a chart that plots
 * the wrong point is a lie about the learner's readiness, and a lie is worth a
 * unit test. The components below `src/routes/progress/` do nothing but emit the
 * strings this module returns.
 *
 * Pure and DOM-free. Coordinates are SVG user units in whatever `viewBox` the
 * caller draws; nothing here reads a clock, a stylesheet or an element.
 */

/** The plotting area inside a chart's `viewBox`, in user units. */
export interface ChartBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One reading: a timestamp and a whole-percent value. */
export interface SeriesPoint {
  at: number;
  value: number;
}

export interface PlottedPoint extends SeriesPoint {
  x: number;
  y: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Two decimals: enough for a 320-unit viewBox, short enough to read in the DOM. */
const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Projects readings into the box, 0% at the floor and 100% at the ceiling.
 *
 * The x-step is **positional, not temporal**. A learner who studies hard for a
 * week, disappears for a month and comes back would otherwise have that week
 * crushed into a few pixels while the gap — during which nothing was learned —
 * took most of the chart. The x axis is labelled with real dates either end, so
 * nothing is being hidden; the shape of the climb is simply drawn per reading.
 */
export function plotSeries(
  points: readonly SeriesPoint[],
  box: ChartBox,
  scale: { min: number; max: number } = { min: 0, max: 100 },
): PlottedPoint[] {
  if (points.length === 0) return [];
  const span = scale.max - scale.min;
  const step = points.length > 1 ? box.width / (points.length - 1) : 0;

  return points.map((point, index) => {
    const ratio = span === 0 ? 0 : clamp((point.value - scale.min) / span, 0, 1);
    return {
      ...point,
      x: round(box.x + step * index),
      y: round(box.y + box.height * (1 - ratio)),
    };
  });
}

/** `M…L…` for a polyline. A single point draws a zero-length segment so its cap shows. */
export function polylinePath(points: readonly { x: number; y: number }[]): string {
  const [first, ...rest] = points;
  if (!first) return '';
  const head = `M${String(round(first.x))},${String(round(first.y))}`;
  if (rest.length === 0) return `${head} L${String(round(first.x))},${String(round(first.y))}`;
  return [head, ...rest.map((p) => `L${String(round(p.x))},${String(round(p.y))}`)].join(' ');
}

/**
 * Thins a long series to at most `max` readings, always keeping the first and
 * the last. Past roughly thirty readings the individual points stop being
 * legible and the shape of the climb is the information — but the ends are the
 * two the learner reads as numbers, so they are never the ones dropped.
 */
export function downsample<T>(points: readonly T[], max: number): T[] {
  if (points.length <= max) return [...points];
  if (max <= 2) {
    const first = points[0];
    const last = points.at(-1);
    return first === undefined || last === undefined ? [] : [first, last];
  }
  const step = (points.length - 1) / (max - 1);
  const out: T[] = [];
  for (let i = 0; i < max; i += 1) {
    const value = points[Math.round(i * step)];
    if (value !== undefined) out.push(value);
  }
  return out;
}

/**
 * Where an event (a mock exam) sits on the plotted road: the nearest reading in
 * time. Exams are marked *on* the trend rather than plotted as their own
 * series, because their score and the readiness they contributed to are the
 * same climb seen twice.
 */
export function markerFor(points: readonly PlottedPoint[], at: number): PlottedPoint | null {
  if (points.length === 0) return null;
  let best = points[0];
  if (!best) return null;
  let bestGap = Math.abs(best.at - at);
  for (const point of points) {
    const gap = Math.abs(point.at - at);
    if (gap < bestGap) {
      best = point;
      bestGap = gap;
    }
  }
  return best;
}

/** A four-point diamond centred on `cx, cy` — a mock exam passed (§2). */
export function diamondPath(cx: number, cy: number, r: number): string {
  return polylinePath([
    { x: cx, y: cy - r },
    { x: cx + r, y: cy },
    { x: cx, y: cy + r },
    { x: cx - r, y: cy },
  ]).concat(' Z');
}

/**
 * A regular octagon with horizontal and vertical flats — the project's hard-stop
 * geometry, used for a mock exam missed. Shape, not colour, carries the outcome
 * (§5): a learner who cannot separate the two hues still reads two signs.
 */
export function octagonPath(cx: number, cy: number, r: number): string {
  const half = r * Math.tan(Math.PI / 8);
  return polylinePath([
    { x: cx + half, y: cy - r },
    { x: cx + r, y: cy - half },
    { x: cx + r, y: cy + half },
    { x: cx + half, y: cy + r },
    { x: cx - half, y: cy + r },
    { x: cx - r, y: cy + half },
    { x: cx - r, y: cy - half },
    { x: cx - half, y: cy - r },
  ]).concat(' Z');
}

/** How far down a lane the learner has driven. 0% is an empty lane, not a bar. */
export function laneFill(percent: number, trackWidth: number): number {
  return round((clamp(percent, 0, 100) / 100) * trackWidth);
}
