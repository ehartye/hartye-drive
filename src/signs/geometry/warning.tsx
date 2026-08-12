/**
 * W-series warning signs — "Hazardous Or Unexpected Condition Ahead", as the
 * manual's own shape key puts it. Yellow diamonds unless the MUTCD says
 * otherwise, plus the two warning shapes that are not diamonds at all: the
 * W14-3 pennant and the OM3 object marker.
 *
 * W11-2 (pedestrian) is FLUORESCENT YELLOW-GREEN, not yellow and emphatically
 * not fluorescent pink — pink is incident management, a different thing
 * entirely (grounding §2).
 */
import type { ReactNode } from 'react';
import type { SignGeometry } from '../registry';
import {
  BOX_SQUARE,
  BOX_TALL,
  BOX_WIDE,
  C,
  FACE_DIAMOND,
  FACE_PENNANT,
  FACE_SQUARE,
  FACE_TALL,
  FACE_WIDE,
  arrowHead,
  bicycle,
  car,
  diamondFace,
  legend,
  legendLines,
  pennantFace,
  squareFace,
  tallFace,
  truck,
  walkingFigure,
  wideFace,
} from './shared';

/** A yellow diamond carrying a black symbol — the default warning face. */
function warn(symbol: ReactNode, fill: string = C.yellow): ReactNode {
  return (
    <>
      {diamondFace(fill)}
      {symbol}
    </>
  );
}

/** A stroked path in the legend colour, the way most W-series symbols are cut. */
function stroke(d: string, width = 7): ReactNode {
  return (
    <path fill="none" stroke={C.black} strokeWidth={width} strokeLinejoin="miter" d={d} />
  );
}

export const WARNING: Readonly<Record<string, SignGeometry>> = {
  'w1-1-turn': {
    viewBox: BOX_SQUARE,
    face: FACE_DIAMOND,
    // A right angle. A gentle bend would be W1-2 CURVE, a different sign with a
    // different advisory speed.
    draw: () => warn(<>{stroke('M58 80 V44 H42')}{arrowHead(C.black, 30, 44, 14, 180)}</>),
  },

  'w1-2-curve': {
    viewBox: BOX_SQUARE,
    face: FACE_DIAMOND,
    // A gentle bend. A right angle would be W1-1 TURN.
    draw: () =>
      warn(
        <>
          {stroke('M40 80 C40 60 44 50 56 42')}
          {arrowHead(C.black, 62, 38, 14, -55)}
        </>,
      ),
  },

  'w1-3-reverse-turn': {
    viewBox: BOX_SQUARE,
    face: FACE_DIAMOND,
    draw: () => warn(<>{stroke('M38 82 V62 H62 V38')}{arrowHead(C.black, 62, 26, 14, -90)}</>),
  },

  'w1-4-reverse-curve': {
    viewBox: BOX_SQUARE,
    face: FACE_DIAMOND,
    draw: () =>
      warn(
        <>
          {stroke('M38 84 C38 68 62 68 62 52 C62 42 62 38 62 34')}
          {arrowHead(C.black, 62, 24, 14, -90)}
        </>,
      ),
  },

  'w1-5-winding-road': {
    viewBox: BOX_SQUARE,
    face: FACE_DIAMOND,
    // Three or more changes of direction — that is what makes it winding
    // rather than a reverse curve.
    draw: () =>
      warn(
        <>
          {stroke('M40 86 C40 74 62 72 62 60 C62 48 38 46 38 34')}
          {arrowHead(C.black, 38, 24, 14, -90)}
        </>,
      ),
  },

  'w1-6-large-arrow': {
    viewBox: BOX_WIDE,
    aspect: 'wide',
    face: FACE_WIDE,
    draw: () => (
      <>
        {wideFace(C.yellow)}
        <path fill={C.black} d="M20 42 H92 V28 L124 50 L92 72 V58 H20 Z" />
      </>
    ),
  },

  'w1-8-chevron': {
    viewBox: BOX_TALL,
    aspect: 'tall',
    face: FACE_TALL,
    draw: () => (
      <>
        {tallFace(C.yellow)}
        <path fill={C.black} d="M22 14 L54 48 L22 82 V62 L34 48 L22 34 Z" />
      </>
    ),
  },

  'w13-1p-advisory-speed': {
    viewBox: BOX_SQUARE,
    face: FACE_SQUARE,
    draw: (value = 25) => (
      <>
        {squareFace(C.yellow)}
        {legend(C.black, 50, 56, 34, String(value), { mono: true, weight: 700 })}
        {legend(C.black, 50, 80, 13, 'M.P.H.', { track: 0.2 })}
      </>
    ),
  },

  'w2-1-cross-road': {
    viewBox: BOX_SQUARE,
    face: FACE_DIAMOND,
    draw: () => warn(<>{stroke('M50 22 V78 M22 50 H78', 8)}</>),
  },

  'w2-2-side-road': {
    viewBox: BOX_SQUARE,
    face: FACE_DIAMOND,
    draw: () => warn(<>{stroke('M50 22 V78 M50 50 L76 24', 8)}</>),
  },

  'w2-4-t-intersection': {
    viewBox: BOX_SQUARE,
    face: FACE_DIAMOND,
    draw: () => warn(<>{stroke('M50 78 V32 M22 32 H78', 8)}</>),
  },

  'w3-1-stop-ahead': {
    viewBox: BOX_SQUARE,
    face: FACE_DIAMOND,
    // The sign it warns of, drawn as itself: a red octagon with a white border.
    draw: () =>
      warn(
        <>
          <polygon
            fill={C.red}
            points="53.5,26 66.5,26 75.7,35.2 75.7,48.2 66.5,57.4 53.5,57.4 44.3,48.2 44.3,35.2"
          />
          <polygon
            fill="none"
            stroke={C.white}
            strokeWidth={2}
            points="55,29 65,29 72.7,36.7 72.7,46.7 65,54.4 55,54.4 47.3,46.7 47.3,36.7"
          />
          {stroke('M32 80 V64 L44 52', 6)}
          {arrowHead(C.black, 48, 48, 11, -45)}
        </>,
      ),
  },

  'w3-2-yield-ahead': {
    viewBox: BOX_SQUARE,
    face: FACE_DIAMOND,
    // A white triangle with a wide red border — the same sign R1-2 really is.
    draw: () =>
      warn(
        <>
          <polygon fill={C.red} points="44,25 78,25 61,58" />
          <polygon fill={C.white} points="49,30 73,30 61,53" />
          {stroke('M32 80 V64 L44 52', 6)}
          {arrowHead(C.black, 48, 48, 11, -45)}
        </>,
      ),
  },

  'w3-3-signal-ahead': {
    viewBox: BOX_SQUARE,
    face: FACE_DIAMOND,
    draw: () =>
      warn(
        <>
          <rect fill={C.black} x={40} y={22} width={20} height={52} rx={4} />
          <circle fill={C.red} cx={50} cy={33} r={6} />
          <circle fill={C.yellow} cx={50} cy={48} r={6} />
          <circle fill={C.green} cx={50} cy={63} r={6} />
        </>,
      ),
  },

  'w4-1-merge': {
    viewBox: BOX_SQUARE,
    face: FACE_DIAMOND,
    // Traffic blending into the main stream from the right.
    draw: () =>
      warn(
        <>
          {stroke('M42 82 V34')}
          {stroke('M70 82 V58 L44 40')}
          {arrowHead(C.black, 42, 26, 13, -90)}
        </>,
      ),
  },

  'w4-2-lane-ends': {
    viewBox: BOX_SQUARE,
    face: FACE_DIAMOND,
    // The right lane runs out and must merge left.
    draw: () =>
      warn(
        <>
          {stroke('M38 82 V26')}
          {stroke('M66 82 V56 C66 44 52 42 42 40')}
        </>,
      ),
  },

  'w4-3-added-lane': {
    viewBox: BOX_SQUARE,
    face: FACE_DIAMOND,
    // A new lane joins from the right without anyone having to merge.
    draw: () =>
      warn(
        <>
          {stroke('M38 82 V26')}
          {stroke('M70 82 V56 C70 44 66 38 66 26')}
        </>,
      ),
  },

  'w5-2-narrow-bridge': {
    viewBox: BOX_SQUARE,
    face: FACE_DIAMOND,
    draw: () =>
      warn(
        <>
          {stroke('M30 80 V60 L42 48 V36', 6)}
          {stroke('M70 80 V60 L58 48 V36', 6)}
        </>,
      ),
  },

  'w6-1-divided-highway': {
    viewBox: BOX_SQUARE,
    face: FACE_DIAMOND,
    // Two carriageways opening around a median island.
    draw: () =>
      warn(
        <>
          {stroke('M36 82 V52 C36 42 40 34 40 26', 6)}
          {stroke('M64 82 V52 C64 42 60 34 60 26', 6)}
          <rect fill={C.black} x={47} y={34} width={6} height={30} rx={3} />
          {arrowHead(C.black, 40, 20, 11, -90)}
          {arrowHead(C.black, 60, 20, 11, -90)}
        </>,
      ),
  },

  'w6-3-two-way-traffic': {
    viewBox: BOX_SQUARE,
    face: FACE_DIAMOND,
    draw: () =>
      warn(
        <>
          {stroke('M40 80 V34', 6)}
          {arrowHead(C.black, 40, 24, 12, -90)}
          {stroke('M60 26 V72', 6)}
          {arrowHead(C.black, 60, 82, 12, 90)}
        </>,
      ),
  },

  'w8-5-slippery-when-wet': {
    viewBox: BOX_SQUARE,
    face: FACE_DIAMOND,
    // A car with its tracks swinging out from under it.
    draw: () =>
      warn(
        <>
          {car(C.black, 50, 38, 0.95)}
          <path
            fill="none"
            stroke={C.black}
            strokeWidth={4}
            strokeLinecap="round"
            d="M36 60 C28 65 44 69 36 75 M64 60 C56 65 72 69 64 75"
          />
        </>,
      ),
  },

  'w8-13-bridge-ices': {
    viewBox: BOX_SQUARE,
    face: FACE_DIAMOND,
    draw: () => warn(<>{legendLines(C.black, 50, 44, 10, 13, ['BRIDGE ICES', 'BEFORE', 'ROAD'])}</>),
  },

  'w8-14-fallen-rocks': {
    viewBox: BOX_SQUARE,
    face: FACE_DIAMOND,
    // Rocks in the road, not rocks striking from overhead: the manual is
    // explicit, so the rocks sit on the roadway line.
    draw: () =>
      warn(
        <>
          <path fill={C.black} d="M28 74 L46 30 L54 30 L40 74 Z" />
          <circle fill={C.black} cx={52} cy={54} r={6} />
          <circle fill={C.black} cx={62} cy={66} r={8} />
          <circle fill={C.black} cx={48} cy={70} r={5} />
          <rect fill={C.black} x={26} y={76} width={48} height={4} rx={2} />
        </>,
      ),
  },

  'w11-1-bicycle': {
    viewBox: BOX_SQUARE,
    face: FACE_DIAMOND,
    draw: () => warn(bicycle(C.black, 50, 50, 1.3)),
  },

  'w11-2-pedestrian': {
    viewBox: BOX_SQUARE,
    face: FACE_DIAMOND,
    draw: () => warn(walkingFigure(C.black, 50, 62, 1), C['fluorescent-yellow-green']),
  },

  'w11-3-deer': {
    viewBox: BOX_SQUARE,
    face: FACE_DIAMOND,
    // Every part of the animal has to sit inside the diamond, which narrows
    // fast toward the top — hence a deer in stride rather than one rearing.
    draw: () =>
      warn(
        <>
          <ellipse fill={C.black} cx={46} cy={56} rx={16} ry={8} />
          <circle fill={C.black} cx={34} cy={55} r={9} />
          <path fill={C.black} d="M56 58 L61 38 L68 40 L63 60 Z" />
          <ellipse fill={C.black} cx={70} cy={36} rx={7.5} ry={4} transform="rotate(-20 70 36)" />
          <path
            fill="none"
            stroke={C.black}
            strokeWidth={2.4}
            strokeLinecap="round"
            d="M66 32 L60 24 M63 28 L56 26 M70 31 L75 24 M73 27 L78 28"
          />
          <path
            fill="none"
            stroke={C.black}
            strokeWidth={4.5}
            d="M36 62 L31 76 M44 62 L46 76 M56 60 L53 76 M62 58 L66 74"
          />
          <path fill="none" stroke={C.black} strokeWidth={3} d="M27 50 L21 44" />
        </>,
      ),
  },

  'w11-4-cattle': {
    viewBox: BOX_SQUARE,
    face: FACE_DIAMOND,
    draw: () =>
      warn(
        <>
          <ellipse fill={C.black} cx={50} cy={54} rx={18} ry={9} />
          <ellipse fill={C.black} cx={29} cy={49} rx={8} ry={6} />
          <path
            fill="none"
            stroke={C.black}
            strokeWidth={3}
            strokeLinecap="round"
            d="M25 43 L21 39 M33 43 L36 38"
          />
          <path
            fill="none"
            stroke={C.black}
            strokeWidth={4.5}
            d="M38 61 L36 76 M46 61 L48 76 M56 61 L54 76 M64 59 L67 74"
          />
          <path fill="none" stroke={C.black} strokeWidth={3} d="M66 47 C73 49 75 56 71 63" />
        </>,
      ),
  },

  'w11-7-equestrian': {
    viewBox: BOX_SQUARE,
    face: FACE_DIAMOND,
    draw: () =>
      warn(
        <>
          <ellipse fill={C.black} cx={48} cy={58} rx={16} ry={8} />
          <path fill={C.black} d="M58 60 L62 40 L69 43 L65 62 Z" />
          <ellipse fill={C.black} cx={73} cy={37} rx={8} ry={3.6} transform="rotate(-28 73 37)" />
          <path fill={C.black} d="M66 34 L64 27 L70 31 Z" />
          <path
            fill="none"
            stroke={C.black}
            strokeWidth={4.5}
            d="M38 64 L34 76 M46 64 L48 76 M58 62 L56 76 M64 60 L68 74"
          />
          {/* The rider, seated. */}
          <circle fill={C.black} cx={45} cy={34} r={5} />
          <path fill={C.black} d="M40 40 h9 l5 13 h-6 l-3 -6 v6 h-9 z" />
          <path fill="none" stroke={C.black} strokeWidth={3.5} d="M46 53 L43 63" />
        </>,
      ),
  },

  'w11-14-horse-drawn': {
    viewBox: BOX_SQUARE,
    face: FACE_DIAMOND,
    // The manual: "Warning signs will be posted in areas where you are likely
    // to find animal-drawn vehicles."
    draw: () =>
      warn(
        <>
          <ellipse fill={C.black} cx={32} cy={56} rx={11} ry={6.5} />
          <path fill={C.black} d="M25 57 L21 43 L27 41 L31 55 Z" />
          <ellipse fill={C.black} cx={20} cy={39} rx={7} ry={3.2} transform="rotate(-35 20 39)" />
          <path fill="none" stroke={C.black} strokeWidth={4} d="M27 61 L24 73 M37 61 L39 73" />
          <path fill="none" stroke={C.black} strokeWidth={3} d="M42 57 L58 59" />
          {/* The cart: a plain body over one tall wheel. */}
          <path fill={C.black} d="M57 44 h21 v13 h-21 z" />
          <circle fill="none" stroke={C.black} strokeWidth={3.5} cx={68} cy={64} r={9} />
        </>,
      ),
  },

  'w12-2-low-clearance': {
    viewBox: BOX_SQUARE,
    face: FACE_DIAMOND,
    draw: () => warn(<>{legend(C.black, 50, 57, 18, '12′-6″', { track: 0.3 })}</>),
  },

  'w14-3-no-passing-zone': {
    viewBox: BOX_SQUARE,
    face: FACE_PENNANT,
    draw: () => (
      <>
        {pennantFace(C.yellow)}
        {legendLines(C.black, 44, 38, 9, 15, ['NO', 'PASSING', 'ZONE'])}
      </>
    ),
  },

  'w7-4-runaway-ramp': {
    viewBox: BOX_WIDE,
    aspect: 'wide',
    face: FACE_WIDE,
    // A truck climbing the escape ramp off the downgrade.
    draw: () => (
      <>
        {wideFace(C.yellow)}
        <path fill="none" stroke={C.black} strokeWidth={5} d="M16 74 H62 L118 36" />
        {truck(C.black, 92, 42, 0.72, -34)}
      </>
    ),
  },

  'om3-l-object-marker': {
    viewBox: BOX_TALL,
    aspect: 'tall',
    face: FACE_TALL,
    // Type 3 object marker: alternating black and yellow stripes sloping down
    // toward the side traffic is meant to pass. Stripes are drawn inside a
    // nested viewport, which clips them to the face without needing an id.
    draw: () => (
      <>
        <rect x={1} y={1} width={74} height={94} rx={4} fill={C.yellow} />
        <svg x={5} y={5} width={66} height={86} viewBox="0 0 66 86">
          <path
            fill="none"
            stroke={C.black}
            strokeWidth={11}
            d="M20 -10 L-80 90 M50 -10 L-50 90 M80 -10 L-20 90 M110 -10 L10 90 M140 -10 L40 90 M170 -10 L70 90"
          />
        </svg>
        <rect
          x={5}
          y={5}
          width={66}
          height={86}
          rx={2}
          fill="none"
          stroke={C.black}
          strokeWidth={3}
        />
      </>
    ),
  },
};
