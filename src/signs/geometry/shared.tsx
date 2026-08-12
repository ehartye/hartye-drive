/**
 * Shared MUTCD drawing primitives.
 *
 * Everything in `src/signs/geometry/` is hand-authored SVG — there is no
 * clipart, no raster and no photography anywhere in this product (grounding §2
 * signature). These are the shapes and the treatments the sign families share,
 * so a face file states only what makes its sign that sign.
 *
 * Three sizes of box, matching the three `.sign--*` aspect classes in
 * `components.css`, so nothing letterboxes:
 *
 *   square   0 0 100 100    octagons, diamonds, circles, squares, pennants
 *   wide     0 0 140 100    horizontal rectangles and plaques
 *   tall     0 0 76 96      vertical rectangles (R2-1 SPEED LIMIT is 24×30 in)
 *
 * Each face also publishes its outline as path data (`FACE_*`). `audit:signs`
 * fills that path in a real browser and requires every `<text>` bounding box to
 * land inside it.
 */
import type { ReactNode } from 'react';
import { MUTCD_COLORS } from '../registry';

export const C = MUTCD_COLORS;

export const BOX_SQUARE = '0 0 100 100';
export const BOX_WIDE = '0 0 140 100';
export const BOX_TALL = '0 0 76 96';

/* --------------------------------------------------------------- outlines */

const OCTAGON_PTS = '29.3,0 70.7,0 100,29.3 100,70.7 70.7,100 29.3,100 0,70.7 0,29.3';
const DIAMOND_PTS = '50,1 99,50 50,99 1,50';
const YIELD_PTS = '2,7 98,7 50,96';
const PENTAGON_PTS = '50,1 98,37 79,99 21,99 2,37';
const PENNANT_PTS = '22,2 92,50 22,98';

export const FACE_OCTAGON = 'M29.3 0H70.7L100 29.3V70.7L70.7 100H29.3L0 70.7V29.3Z';
export const FACE_DIAMOND = 'M50 1L99 50L50 99L1 50Z';
export const FACE_YIELD = 'M2 7H98L50 96Z';
export const FACE_PENTAGON = 'M50 1L98 37L79 99H21L2 37Z';
export const FACE_PENNANT = 'M22 2L92 50L22 98Z';
export const FACE_CIRCLE = 'M1 50A49 49 0 1 0 99 50A49 49 0 1 0 1 50Z';
export const FACE_SQUARE = 'M1 1H99V99H1Z';
export const FACE_WIDE = 'M1 14H139V86H1Z';
export const FACE_TALL = 'M1 1H75V95H1Z';
/** R6-1 ONE WAY is 36×12 in — far shallower than a plaque. */
export const FACE_BAND = 'M1 30H139V70H1Z';
/**
 * The crossbuck's two blades, in root user units. Derived from the 90×18 blade
 * rotated ±45° about (50,50) — written out rather than transformed so the
 * containment check has real coordinates to test against.
 */
export const FACE_CROSSBUCK =
  'M24.54 11.82L88.18 75.46L75.46 88.18L11.82 24.54Z' +
  'M11.82 75.46L75.46 11.82L88.18 24.54L24.54 88.18Z';

/* ------------------------------------------------------------------ legend */

interface LegendOptions {
  /** `letter-spacing`, in user units. */
  track?: number;
  /** Overpass Mono with tabular figures — for numerals that are data. */
  mono?: boolean;
  weight?: number;
  /**
   * A halo in the face colour, painted under the glyphs. Only the crossbuck
   * needs it: RAILROAD and CROSSING genuinely cross at the sign's centre, and
   * without a halo the shared letters turn to mud.
   */
  halo?: string;
}

/**
 * One line of sign legend. Overpass is an open-source face derived from FHWA
 * Highway Gothic — the actual lettering on the signs being taught (§2).
 */
export function legend(
  fill: string,
  x: number,
  y: number,
  size: number,
  text: string,
  options: LegendOptions = {},
): ReactNode {
  return (
    <text
      key={`${text}@${String(x)},${String(y)}`}
      x={x}
      y={y}
      fill={fill}
      fontSize={size}
      textAnchor="middle"
      fontFamily={options.mono ? "'Overpass Mono', monospace" : "'Overpass', sans-serif"}
      fontWeight={options.weight ?? 800}
      letterSpacing={options.track ?? 0}
      stroke={options.halo}
      strokeWidth={options.halo === undefined ? undefined : 2.8}
      paintOrder={options.halo === undefined ? undefined : 'stroke'}
      style={options.mono ? { fontVariantNumeric: 'tabular-nums' } : undefined}
    >
      {text}
    </text>
  );
}

/** A stack of legend lines on a shared centre line. */
export function legendLines(
  fill: string,
  x: number,
  firstBaseline: number,
  size: number,
  leading: number,
  lines: readonly string[],
  options: LegendOptions = {},
): ReactNode[] {
  return lines.map((line, i) => legend(fill, x, firstBaseline + i * leading, size, line, options));
}

/* ------------------------------------------------------------------- faces */

/** The warning diamond every W-series sign is drawn on, with its inset border. */
export function diamondFace(fill: string, border: string = C.black): ReactNode {
  return (
    <>
      <polygon fill={fill} points={DIAMOND_PTS} />
      <polygon
        fill="none"
        stroke={border}
        strokeWidth={4}
        points={DIAMOND_PTS}
        transform="translate(50,50) scale(.85) translate(-50,-50)"
      />
    </>
  );
}

export function octagonFace(fill: string, border: string): ReactNode {
  return (
    <>
      <polygon fill={fill} points={OCTAGON_PTS} />
      <polygon
        fill="none"
        stroke={border}
        strokeWidth={5}
        points={OCTAGON_PTS}
        transform="translate(50,50) scale(.87) translate(-50,-50)"
      />
    </>
  );
}

/** R1-2: a WHITE field with a wide RED border. Never the inverse. */
export function yieldFace(field: string, border: string): ReactNode {
  return (
    <>
      <polygon fill={border} points={YIELD_PTS} />
      <polygon fill={field} points="11,15 89,15 50,87" />
    </>
  );
}

export function pentagonFace(fill: string, border: string = C.black): ReactNode {
  return (
    <>
      <polygon fill={fill} points={PENTAGON_PTS} />
      <polygon
        fill="none"
        stroke={border}
        strokeWidth={3.5}
        points={PENTAGON_PTS}
        transform="translate(50,55) scale(.86) translate(-50,-55)"
      />
    </>
  );
}

export function pennantFace(fill: string, border: string = C.black): ReactNode {
  return (
    <>
      <polygon fill={fill} points={PENNANT_PTS} />
      {/* Scaled about the centroid, or the border goes hairline at one edge. */}
      <polygon
        fill="none"
        stroke={border}
        strokeWidth={3.5}
        points={PENNANT_PTS}
        transform="translate(45.3,50) scale(.82) translate(-45.3,-50)"
      />
    </>
  );
}

export function circleFace(fill: string, border: string = C.black): ReactNode {
  return (
    <>
      <circle fill={fill} cx={50} cy={50} r={49} />
      <circle fill="none" stroke={border} strokeWidth={3} cx={50} cy={50} r={43} />
    </>
  );
}

export function squareFace(fill: string, border: string = C.black): ReactNode {
  return (
    <>
      <rect x={1} y={1} width={98} height={98} rx={6} fill={fill} />
      <rect
        x={6}
        y={6}
        width={88}
        height={88}
        rx={3}
        fill="none"
        stroke={border}
        strokeWidth={3}
      />
    </>
  );
}

/** 140×100 box. Horizontal rectangles, plaques and guide panels. */
export function wideFace(fill: string, border: string = C.black): ReactNode {
  return (
    <>
      <rect x={1} y={14} width={138} height={72} rx={5} fill={fill} />
      <rect
        x={6}
        y={19}
        width={128}
        height={62}
        rx={3}
        fill="none"
        stroke={border}
        strokeWidth={2.5}
      />
    </>
  );
}

/** 140×100 box, but a shallow band — R6-1 ONE WAY is three times as wide as tall. */
export function bandFace(fill: string, border: string = C.black): ReactNode {
  return (
    <>
      <rect x={1} y={30} width={138} height={40} rx={4} fill={fill} />
      <rect
        x={5}
        y={34}
        width={130}
        height={32}
        rx={2}
        fill="none"
        stroke={border}
        strokeWidth={2.5}
      />
    </>
  );
}

/** 76×96 box. Vertical rectangles. */
export function tallFace(fill: string, border: string = C.black): ReactNode {
  return (
    <>
      <rect x={1} y={1} width={74} height={94} rx={4} fill={fill} />
      <rect
        x={5}
        y={5}
        width={66}
        height={86}
        rx={2}
        fill="none"
        stroke={border}
        strokeWidth={3}
      />
    </>
  );
}

/* -------------------------------------------------------------- treatments */

/**
 * The red circle-and-slash. The manual teaches this as a rule of its own:
 * "Signs having a white background and a red circle and a line diagonally
 * through them mean 'NO' according to what is shown behind the red symbol."
 * The slash runs from upper LEFT to lower RIGHT, and is drawn last so it sits
 * over the symbol it forbids.
 */
export function prohibition(red: string, cx = 50, cy = 50, r = 33): ReactNode {
  return (
    <>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={red} strokeWidth={8} />
      <line
        x1={cx - r * 0.72}
        y1={cy - r * 0.72}
        x2={cx + r * 0.72}
        y2={cy + r * 0.72}
        stroke={red}
        strokeWidth={8}
        strokeLinecap="butt"
      />
    </>
  );
}

/* ---------------------------------------------------------------- symbols */

/**
 * The walking figure MUTCD uses for W11-2 and S1-1. `scale` and the origin let
 * the same body serve a lone pedestrian and a pair of schoolchildren.
 */
export function walkingFigure(
  fill: string,
  x: number,
  y: number,
  scale: number,
  facing: 1 | -1 = 1,
): ReactNode {
  return (
    <g transform={`translate(${String(x)},${String(y)}) scale(${String(scale * facing)},${String(scale)})`}>
      <circle fill={fill} cx={0} cy={-26} r={6} />
      <path
        fill={fill}
        d="M-6 -18 h12 l4 18 h-5 l-2 -9 v10 l6 20 h-6 l-6 -17 l-5 17 h-6 l7 -24 v-9 l-2 12 h-5 z"
      />
    </g>
  );
}

/** The MUTCD bicycle symbol: two wheels, a frame, bars and a saddle. */
export function bicycle(fill: string, x: number, y: number, scale: number): ReactNode {
  return (
    <g transform={`translate(${String(x)},${String(y)}) scale(${String(scale)})`} fill="none" stroke={fill}>
      <circle cx={-15} cy={6} r={10} strokeWidth={3} />
      <circle cx={15} cy={6} r={10} strokeWidth={3} />
      <path d="M-15 6 L-4 -8 H8 L15 6 M-4 -8 L2 6 H-15" strokeWidth={3} strokeLinejoin="round" />
      <path d="M6 -12 H13 M-6 -11 H0" strokeWidth={3} strokeLinecap="round" />
      <path d="M8 -8 L13 -12" strokeWidth={3} />
    </g>
  );
}

/**
 * The MUTCD truck silhouette: box, cab and two wheels, facing +x. `rotate`
 * turns it about its own centre — a truck climbing an escape ramp is the same
 * truck, tilted.
 */
export function truck(fill: string, x: number, y: number, scale: number, rotate = 0): ReactNode {
  return (
    <g
      transform={`translate(${String(x)},${String(y)}) rotate(${String(rotate)}) scale(${String(scale)})`}
    >
      <path fill={fill} d="M-26 -10 H2 V10 H-26 Z" />
      <path fill={fill} d="M4 -2 H16 L24 6 V10 H4 Z" />
      <circle fill={fill} cx={-16} cy={13} r={5} />
      <circle fill={fill} cx={15} cy={13} r={5} />
    </g>
  );
}

/** A car in side view — W8-5 SLIPPERY WHEN WET rides on this. */
export function car(fill: string, x: number, y: number, scale: number): ReactNode {
  return (
    <g transform={`translate(${String(x)},${String(y)}) scale(${String(scale)})`}>
      {/* Cabin first, then the body, so the roofline reads as one silhouette. */}
      <path fill={fill} d="M-13 3 L-7 -9 H7 L14 3 Z" />
      <path fill={fill} d="M-25 1 H23 L26 5 V11 H-25 Z" />
      <circle fill={fill} cx={-15} cy={12} r={5} />
      <circle fill={fill} cx={15} cy={12} r={5} />
    </g>
  );
}

/** A solid arrowhead pointing along +x, tip at (x, y). */
export function arrowHead(fill: string, x: number, y: number, size: number, angle = 0): ReactNode {
  return (
    <polygon
      fill={fill}
      points={`0,0 ${String(-size)},${String(-size * 0.62)} ${String(-size)},${String(size * 0.62)}`}
      transform={`translate(${String(x)},${String(y)}) rotate(${String(angle)})`}
    />
  );
}
