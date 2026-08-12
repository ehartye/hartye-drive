/**
 * What a face outline actually *is*, measured from the path the geometry draws.
 *
 * `src/content/signs.json` declares a `shape` per sign. Until now nothing
 * checked it: the declaration was used only to build the accessible name, which
 * is generated *from* the declaration — so "does this sign have the shape it
 * claims?" was answered by reading the claim back. A critic proved the hole by
 * changing `r1-1-stop` from `octagon` to `circle` with the geometry untouched;
 * `npm run audit:signs` said PASS.
 *
 * This module closes it. It reads the face outline as path data, flattens every
 * command to a polyline, and reports what is there — how many closed subpaths,
 * where the corners are, whether anything curves, how wide against how tall.
 * `outlineMatchesShape` then asks whether that measurement can be the declared
 * shape. Nothing here reads `signs.json`, so the check cannot be circular.
 *
 * The outline itself is not taken on trust either: `audit:signs` samples a grid
 * inside it in a real browser and fails a sign whose declared outline is not
 * where the paint is (`face-color-mismatch` / `shape-mismatch` in `audit.ts`).
 */
import type { SignShape } from '~/content/types';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface OutlineBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly width: number;
  readonly height: number;
}

export interface OutlineMeasurement {
  /** The corner vertices of each closed subpath, in path order. */
  readonly subpaths: readonly (readonly Point[])[];
  /** Corners across all subpaths. */
  readonly corners: number;
  /** True when any command drew a curve or an elliptical arc. */
  readonly curved: boolean;
  readonly bounds: OutlineBounds;
  /** width ÷ height. */
  readonly aspect: number;
  /** Every corner-to-corner edge runs horizontally or vertically. */
  readonly axisAligned: boolean;
  /** Set when the path data could not be read; every shape then fails. */
  readonly error?: string;
}

/**
 * A joint counts as a corner when the outline turns more than this. Flattened
 * curves turn a few degrees per segment, so a smooth arc contributes none and
 * the point of a shield or a pennant contributes one.
 */
const CORNER_TURN = (25 * Math.PI) / 180;

/** Points closer together than this are the same point. User units. */
const SAME_POINT = 0.25;

/** Segments per cubic bézier, and the arc step, when flattening. */
const BEZIER_STEPS = 24;
const ARC_STEP = (5 * Math.PI) / 180;

const EMPTY_BOUNDS: OutlineBounds = {
  minX: 0,
  minY: 0,
  maxX: 0,
  maxY: 0,
  width: 0,
  height: 0,
};

/* --------------------------------------------------------------- flattening */

interface Cursor {
  x: number;
  y: number;
}

function cubic(from: Point, c1: Point, c2: Point, to: Point): Point[] {
  const out: Point[] = [];
  for (let i = 1; i <= BEZIER_STEPS; i++) {
    const t = i / BEZIER_STEPS;
    const u = 1 - t;
    out.push({
      x: u * u * u * from.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * to.x,
      y: u * u * u * from.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * to.y,
    });
  }
  return out;
}

/** SVG endpoint-parameterized arc → polyline (spec F.6.5, then sampled). */
function arc(
  from: Point,
  rxIn: number,
  ryIn: number,
  rotationDeg: number,
  largeArc: boolean,
  sweep: boolean,
  to: Point,
): Point[] {
  const rx0 = Math.abs(rxIn);
  const ry0 = Math.abs(ryIn);
  if (rx0 === 0 || ry0 === 0) return [to];

  const phi = (rotationDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const dx = (from.x - to.x) / 2;
  const dy = (from.y - to.y) / 2;
  const x1p = cosPhi * dx + sinPhi * dy;
  const y1p = -sinPhi * dx + cosPhi * dy;

  const lambda = (x1p * x1p) / (rx0 * rx0) + (y1p * y1p) / (ry0 * ry0);
  const scale = lambda > 1 ? Math.sqrt(lambda) : 1;
  const rx = rx0 * scale;
  const ry = ry0 * scale;

  const numerator = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const denominator = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const factor =
    (largeArc === sweep ? -1 : 1) * Math.sqrt(Math.max(0, numerator) / (denominator || 1));
  const cxp = (factor * rx * y1p) / ry;
  const cyp = (-factor * ry * x1p) / rx;
  const cx = cosPhi * cxp - sinPhi * cyp + (from.x + to.x) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (from.y + to.y) / 2;

  const start = Math.atan2((y1p - cyp) / ry, (x1p - cxp) / rx);
  const end = Math.atan2((-y1p - cyp) / ry, (-x1p - cxp) / rx);
  let sweptAngle = end - start;
  if (!sweep && sweptAngle > 0) sweptAngle -= 2 * Math.PI;
  if (sweep && sweptAngle < 0) sweptAngle += 2 * Math.PI;

  const steps = Math.max(2, Math.ceil(Math.abs(sweptAngle) / ARC_STEP));
  const out: Point[] = [];
  for (let i = 1; i <= steps; i++) {
    const theta = start + (sweptAngle * i) / steps;
    const ex = rx * Math.cos(theta);
    const ey = ry * Math.sin(theta);
    out.push({ x: cosPhi * ex - sinPhi * ey + cx, y: sinPhi * ex + cosPhi * ey + cy });
  }
  return out;
}

/* ------------------------------------------------------------------ parsing */

/** Every command this reader understands. Anything else is reported, not guessed. */
const SUPPORTED = 'MmLlHhVvCcAaZz';

interface Flattened {
  readonly polylines: Point[][];
  readonly curved: boolean;
  readonly error?: string;
}

function flatten(data: string): Flattened {
  const tokens = data.match(/[A-Za-z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  const polylines: Point[][] = [];
  let current: Point[] = [];
  let curved = false;
  let command = '';
  let index = 0;
  const cursor: Cursor = { x: 0, y: 0 };
  const start: Cursor = { x: 0, y: 0 };

  const number = (): number => {
    const token = tokens[index++];
    return token === undefined ? Number.NaN : Number(token);
  };
  const push = (points: readonly Point[]) => {
    for (const point of points) current.push(point);
    const last = points[points.length - 1];
    if (last !== undefined) {
      cursor.x = last.x;
      cursor.y = last.y;
    }
  };
  const close = () => {
    if (current.length > 1) polylines.push(current);
    current = [];
  };

  while (index < tokens.length) {
    const token = tokens[index];
    if (token === undefined) break;
    if (/^[A-Za-z]$/.test(token)) {
      if (!SUPPORTED.includes(token)) {
        return { polylines, curved, error: `unsupported path command "${token}"` };
      }
      command = token;
      index++;
    } else if (command === '') {
      return { polylines, curved, error: 'path data does not begin with a command' };
    }

    const relative = command === command.toLowerCase();
    const originX = relative ? cursor.x : 0;
    const originY = relative ? cursor.y : 0;

    switch (command.toUpperCase()) {
      case 'M': {
        close();
        const x = number() + originX;
        const y = number() + originY;
        cursor.x = x;
        cursor.y = y;
        start.x = x;
        start.y = y;
        current = [{ x, y }];
        // A second coordinate pair after M is an implicit lineto.
        command = relative ? 'l' : 'L';
        break;
      }
      case 'L': {
        push([{ x: number() + originX, y: number() + originY }]);
        break;
      }
      case 'H': {
        push([{ x: number() + originX, y: cursor.y }]);
        break;
      }
      case 'V': {
        push([{ x: cursor.x, y: number() + originY }]);
        break;
      }
      case 'C': {
        const from = { x: cursor.x, y: cursor.y };
        const c1 = { x: number() + originX, y: number() + originY };
        const c2 = { x: number() + originX, y: number() + originY };
        const to = { x: number() + originX, y: number() + originY };
        curved = true;
        push(cubic(from, c1, c2, to));
        break;
      }
      case 'A': {
        const from = { x: cursor.x, y: cursor.y };
        const rx = number();
        const ry = number();
        const rotation = number();
        const largeArc = number() !== 0;
        const sweep = number() !== 0;
        const to = { x: number() + originX, y: number() + originY };
        curved = true;
        push(arc(from, rx, ry, rotation, largeArc, sweep, to));
        break;
      }
      case 'Z': {
        cursor.x = start.x;
        cursor.y = start.y;
        close();
        break;
      }
      default:
        return { polylines, curved, error: `unsupported path command "${command}"` };
    }
  }
  close();
  return { polylines, curved };
}

/* -------------------------------------------------------------- measurement */

const dedupe = (points: readonly Point[]): Point[] => {
  const out: Point[] = [];
  for (const point of points) {
    const last = out[out.length - 1];
    if (last !== undefined && Math.hypot(point.x - last.x, point.y - last.y) < SAME_POINT) continue;
    out.push(point);
  }
  const first = out[0];
  const last = out[out.length - 1];
  if (out.length > 1 && first !== undefined && last !== undefined) {
    if (Math.hypot(first.x - last.x, first.y - last.y) < SAME_POINT) out.pop();
  }
  return out;
};

/** Vertices where the closed polyline turns more than `CORNER_TURN`. */
function cornersOf(polyline: readonly Point[]): Point[] {
  const points = dedupe(polyline);
  if (points.length < 3) return [...points];
  const out: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const previous = points[(i - 1 + points.length) % points.length];
    const here = points[i];
    const next = points[(i + 1) % points.length];
    if (previous === undefined || here === undefined || next === undefined) continue;
    const incoming = Math.atan2(here.y - previous.y, here.x - previous.x);
    const outgoing = Math.atan2(next.y - here.y, next.x - here.x);
    let turn = outgoing - incoming;
    while (turn > Math.PI) turn -= 2 * Math.PI;
    while (turn < -Math.PI) turn += 2 * Math.PI;
    if (Math.abs(turn) > CORNER_TURN) out.push(here);
  }
  return out;
}

export function measureOutline(data: string): OutlineMeasurement {
  const flat = flatten(data);
  const all = flat.polylines.flat();
  if (all.length === 0 || all.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    return {
      subpaths: [],
      corners: 0,
      curved: flat.curved,
      bounds: EMPTY_BOUNDS,
      aspect: 0,
      axisAligned: false,
      error: flat.error ?? 'path data draws nothing',
    };
  }

  const xs = all.map((point) => point.x);
  const ys = all.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = maxX - minX;
  const height = maxY - minY;

  const subpaths = flat.polylines.map((polyline) => cornersOf(polyline));
  const tolerance = Math.max(width, height) * 0.03;

  const axisAligned =
    !flat.curved &&
    subpaths.every((corners) =>
      corners.every((corner, i) => {
        const next = corners[(i + 1) % corners.length];
        if (next === undefined) return false;
        return Math.abs(next.x - corner.x) < tolerance || Math.abs(next.y - corner.y) < tolerance;
      }),
    );

  return {
    subpaths,
    corners: subpaths.reduce((sum, corners) => sum + corners.length, 0),
    curved: flat.curved,
    bounds: { minX, minY, maxX, maxY, width, height },
    aspect: height === 0 ? 0 : width / height,
    axisAligned,
    ...(flat.error === undefined ? {} : { error: flat.error }),
  };
}

/* ------------------------------------------------------------- shape rules */

/** How far from square still reads as square, either way. */
const SQUARE_ASPECT = 1.12;

const near = (a: number, b: number, tolerance: number): boolean => Math.abs(a - b) < tolerance;
const squarish = (m: OutlineMeasurement): boolean =>
  m.aspect >= 1 / SQUARE_ASPECT && m.aspect <= SQUARE_ASPECT;
const tolerance = (m: OutlineMeasurement): number =>
  Math.max(m.bounds.width, m.bounds.height) * 0.03;
const only = (m: OutlineMeasurement): readonly Point[] => m.subpaths[0] ?? [];
const straightPolygon = (m: OutlineMeasurement, corners: number): boolean =>
  !m.curved && m.subpaths.length === 1 && m.corners === corners;

/** Corners sitting on the horizontal or vertical centre line of the bounds. */
function onMidlines(m: OutlineMeasurement): boolean {
  const cx = (m.bounds.minX + m.bounds.maxX) / 2;
  const cy = (m.bounds.minY + m.bounds.maxY) / 2;
  const tol = tolerance(m);
  const vertical = only(m).filter((point) => near(point.x, cx, tol)).length;
  const horizontal = only(m).filter((point) => near(point.y, cy, tol)).length;
  return vertical === 2 && horizontal === 2;
}

/** How many corners sit on a given edge of the bounding box. */
function onEdge(m: OutlineMeasurement, edge: 'minX' | 'maxX' | 'minY' | 'maxY'): number {
  const tol = tolerance(m);
  const axis = edge === 'minX' || edge === 'maxX' ? 'x' : 'y';
  return only(m).filter((point) => near(point[axis], m.bounds[edge], tol)).length;
}

/** Corner-to-corner edges that run horizontally. */
function horizontalEdges(m: OutlineMeasurement): number[] {
  const corners = only(m);
  const tol = tolerance(m);
  const out: number[] = [];
  for (let i = 0; i < corners.length; i++) {
    const here = corners[i];
    const next = corners[(i + 1) % corners.length];
    if (here === undefined || next === undefined) continue;
    if (Math.abs(next.y - here.y) < tol) out.push(Math.abs(next.x - here.x));
  }
  return out;
}

/**
 * Can this outline be the declared shape? One predicate per `SignShape`, so a
 * new shape in the content schema fails typecheck here rather than passing
 * unchecked.
 */
const SHAPE_RULE: Record<SignShape, (m: OutlineMeasurement) => boolean> = {
  octagon: (m) => straightPolygon(m, 8) && squarish(m),
  diamond: (m) => straightPolygon(m, 4) && squarish(m) && !m.axisAligned && onMidlines(m),
  square: (m) => straightPolygon(m, 4) && m.axisAligned && squarish(m),
  'rectangle-horizontal': (m) => straightPolygon(m, 4) && m.axisAligned && m.aspect > SQUARE_ASPECT,
  'rectangle-vertical': (m) =>
    straightPolygon(m, 4) && m.axisAligned && m.aspect < 1 / SQUARE_ASPECT,
  // The yield triangle: a horizontal top edge and a single apex at the bottom.
  'triangle-down': (m) => straightPolygon(m, 3) && onEdge(m, 'minY') === 2 && onEdge(m, 'maxY') === 1,
  // The no-passing pennant: a vertical left edge and a single apex at the right.
  pennant: (m) => straightPolygon(m, 3) && onEdge(m, 'minX') === 2 && onEdge(m, 'maxX') === 1,
  pentagon: (m) => straightPolygon(m, 5),
  // Two crossed blades. Nothing else in the registry draws its face in two
  // pieces, and each blade is a four-cornered bar.
  crossbuck: (m) => !m.curved && m.subpaths.length === 2 && m.corners === 8,
  circle: (m) => m.curved && m.subpaths.length === 1 && m.corners === 0 && squarish(m),
  // A route shield: curved sides, a point or shoulders rather than a rim.
  shield: (m) =>
    m.curved && m.subpaths.length === 1 && m.corners >= 1 && m.corners <= 5 && m.aspect > 0.55 && m.aspect < 1.45,
  // Two horizontal edges of different lengths — the flanks slope.
  trapezoid: (m) => {
    if (!straightPolygon(m, 4) || m.axisAligned) return false;
    const horizontal = horizontalEdges(m);
    const [a, b] = horizontal;
    return horizontal.length === 2 && a !== undefined && b !== undefined && !near(a, b, tolerance(m));
  },
};

export function outlineMatchesShape(shape: SignShape, m: OutlineMeasurement): boolean {
  if (m.error !== undefined) return false;
  return SHAPE_RULE[shape](m);
}

/** What the outline turned out to be, for a failure message a human can act on. */
export function describeOutline(m: OutlineMeasurement): string {
  if (m.error !== undefined) return `unreadable (${m.error})`;
  const parts = [
    `${String(m.subpaths.length)} subpath${m.subpaths.length === 1 ? '' : 's'}`,
    `${String(m.corners)} corner${m.corners === 1 ? '' : 's'}`,
    `${m.bounds.width.toFixed(1)}×${m.bounds.height.toFixed(1)} (aspect ${m.aspect.toFixed(2)})`,
    m.curved ? 'curved' : m.axisAligned ? 'straight, axis-aligned' : 'straight',
  ];
  return parts.join(', ');
}
