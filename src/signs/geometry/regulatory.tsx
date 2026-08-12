/**
 * R-series regulatory signs — the ones that state the law.
 *
 * Colours here are the true MUTCD colours, even where they clash with the
 * surrounding panel (grounding §2). Each face paints exactly the colours its
 * registry entry declares and nothing else; `audit:signs` asserts both
 * directions.
 */
import type { ReactNode } from 'react';
import type { SignGeometry } from '../registry';
import {
  BOX_SQUARE,
  BOX_TALL,
  BOX_WIDE,
  C,
  FACE_BAND,
  FACE_CROSSBUCK,
  FACE_OCTAGON,
  FACE_SQUARE,
  FACE_TALL,
  FACE_WIDE,
  FACE_YIELD,
  arrowHead,
  bandFace,
  bicycle,
  legend,
  legendLines,
  octagonFace,
  prohibition,
  squareFace,
  tallFace,
  truck,
  wideFace,
  yieldFace,
} from './shared';

/** A left-turn arrow, stem up from the bottom then bending left. `dir` mirrors it. */
function turnArrow(fill: string, dir: 1 | -1 = 1): ReactNode {
  return (
    <g transform={dir === -1 ? 'translate(100,0) scale(-1,1)' : undefined}>
      <path fill="none" stroke={fill} strokeWidth={9} d="M62 76 V54 H44" />
      {arrowHead(fill, 30, 54, 14, 180)}
    </g>
  );
}

export const REGULATORY: Readonly<Record<string, SignGeometry>> = {
  'r1-1-stop': {
    viewBox: BOX_SQUARE,
    face: FACE_OCTAGON,
    draw: () => (
      <>
        {octagonFace(C.red, C.white)}
        {legend(C.white, 50, 62, 28, 'STOP', { track: 1 })}
      </>
    ),
  },

  'r1-2-yield': {
    viewBox: BOX_SQUARE,
    face: FACE_YIELD,
    // A red field with a white legend is the INVERSE of the real sign.
    draw: () => (
      <>
        {yieldFace(C.white, C.red)}
        {legend(C.red, 50, 44, 15, 'YIELD', { track: 0.3 })}
      </>
    ),
  },

  'r1-3p-all-way': {
    viewBox: BOX_WIDE,
    aspect: 'wide',
    face: FACE_WIDE,
    draw: () => (
      <>
        {wideFace(C.red, C.white)}
        {legend(C.white, 70, 58, 22, 'ALL WAY', { track: 0.5 })}
      </>
    ),
  },

  'r2-1-speed-limit': {
    viewBox: BOX_TALL,
    aspect: 'tall',
    face: FACE_TALL,
    draw: (value = 55) => (
      <>
        {tallFace(C.white)}
        {legend(C.black, 38, 26, 12, 'SPEED', { track: 0.6 })}
        {legend(C.black, 38, 40, 12, 'LIMIT', { track: 0.6 })}
        {legend(C.black, 38, 78, 34, String(value), { mono: true, weight: 700 })}
      </>
    ),
  },

  'r2-4p-minimum-speed': {
    viewBox: BOX_TALL,
    aspect: 'tall',
    face: FACE_TALL,
    draw: (value = 45) => (
      <>
        {tallFace(C.white)}
        {legend(C.black, 38, 24, 10, 'MINIMUM', { track: 0.3 })}
        {legend(C.black, 38, 38, 10, 'SPEED', { track: 0.3 })}
        {legend(C.black, 38, 78, 32, String(value), { mono: true, weight: 700 })}
      </>
    ),
  },

  'r3-1-no-right-turn': {
    viewBox: BOX_SQUARE,
    face: FACE_SQUARE,
    draw: () => (
      <>
        {squareFace(C.white)}
        {turnArrow(C.black, -1)}
        {prohibition(C.red)}
      </>
    ),
  },

  'r3-2-no-left-turn': {
    viewBox: BOX_SQUARE,
    face: FACE_SQUARE,
    draw: () => (
      <>
        {squareFace(C.white)}
        {turnArrow(C.black)}
        {prohibition(C.red)}
      </>
    ),
  },

  'r3-3-no-turns': {
    viewBox: BOX_SQUARE,
    face: FACE_SQUARE,
    // Both turns forbidden: one stem, two heads, one slash over the pair.
    draw: () => (
      <>
        {squareFace(C.white)}
        <path fill="none" stroke={C.black} strokeWidth={9} d="M50 78 V54 H36 M50 54 H64" />
        {arrowHead(C.black, 26, 54, 13, 180)}
        {arrowHead(C.black, 74, 54, 13, 0)}
        {prohibition(C.red)}
      </>
    ),
  },

  'r3-4-no-u-turn': {
    viewBox: BOX_SQUARE,
    face: FACE_SQUARE,
    draw: () => (
      <>
        {squareFace(C.white)}
        <path
          fill="none"
          stroke={C.black}
          strokeWidth={9}
          d="M36 74 V52 A14 14 0 0 1 64 52 V62"
        />
        {arrowHead(C.black, 64, 44, 13, -90)}
        {prohibition(C.red)}
      </>
    ),
  },

  'r3-5-mandatory-turn-lane': {
    viewBox: BOX_TALL,
    aspect: 'tall',
    face: FACE_TALL,
    // R3-5 states what the lane MUST do — the arrow carries it, no slash.
    draw: () => (
      <>
        {tallFace(C.white)}
        <path fill="none" stroke={C.black} strokeWidth={8} d="M46 76 V44 H32" />
        {arrowHead(C.black, 20, 44, 13, 180)}
        {legend(C.black, 38, 22, 9, 'ONLY', { track: 0.4 })}
      </>
    ),
  },

  'r3-7-lane-must-turn': {
    viewBox: BOX_WIDE,
    aspect: 'wide',
    face: FACE_WIDE,
    draw: () => (
      <>
        {wideFace(C.white)}
        {legendLines(C.black, 70, 38, 13, 16, ['LEFT LANE', 'MUST TURN LEFT'], { track: 0.3 })}
      </>
    ),
  },

  'r3-10-hov-lane': {
    viewBox: BOX_TALL,
    aspect: 'tall',
    face: FACE_TALL,
    // The white diamond the manual calls out: "often have a white diamond
    // posted at the side of the road and/or painted on the pavement surface".
    draw: () => (
      <>
        {tallFace(C.white)}
        <polygon
          fill="none"
          stroke={C.black}
          strokeWidth={3}
          points="38,16 52,32 38,48 24,32"
        />
        {legend(C.black, 38, 68, 15, '2 +', { track: 0.5 })}
        {legend(C.black, 38, 85, 10, 'ONLY', { track: 0.4 })}
      </>
    ),
  },

  'r3-17-bike-lane': {
    viewBox: BOX_TALL,
    aspect: 'tall',
    face: FACE_TALL,
    draw: () => (
      <>
        {tallFace(C.white)}
        {bicycle(C.black, 38, 32, 0.85)}
        {legend(C.black, 38, 68, 11, 'BIKE', { track: 0.3 })}
        {legend(C.black, 38, 83, 11, 'LANE', { track: 0.3 })}
      </>
    ),
  },

  'r4-1-do-not-pass': {
    viewBox: BOX_TALL,
    aspect: 'tall',
    face: FACE_TALL,
    draw: () => (
      <>
        {tallFace(C.white)}
        {legendLines(C.black, 38, 36, 13, 20, ['DO NOT', 'PASS'], { track: 0.3 })}
      </>
    ),
  },

  'r4-2-pass-with-care': {
    viewBox: BOX_TALL,
    aspect: 'tall',
    face: FACE_TALL,
    draw: () => (
      <>
        {tallFace(C.white)}
        {legendLines(C.black, 38, 32, 12, 19, ['PASS', 'WITH', 'CARE'], { track: 0.3 })}
      </>
    ),
  },

  'r4-3-slower-traffic-keep-right': {
    viewBox: BOX_TALL,
    aspect: 'tall',
    face: FACE_TALL,
    draw: () => (
      <>
        {tallFace(C.white)}
        {legendLines(C.black, 38, 26, 11, 18, ['SLOWER', 'TRAFFIC', 'KEEP', 'RIGHT'], {
          track: 0.2,
        })}
      </>
    ),
  },

  'r4-7-keep-right': {
    viewBox: BOX_TALL,
    aspect: 'tall',
    face: FACE_TALL,
    // The symbol version: traffic passes to the right of the obstruction.
    draw: () => (
      <>
        {tallFace(C.white)}
        <path fill="none" stroke={C.black} strokeWidth={8} d="M28 82 V54 L50 34" />
        {arrowHead(C.black, 56, 28, 14, -42)}
      </>
    ),
  },

  'r5-1-do-not-enter': {
    viewBox: BOX_SQUARE,
    face: FACE_SQUARE,
    // White square, red disc, white bar, white legend inside the disc.
    draw: () => (
      <>
        <rect x={1} y={1} width={98} height={98} rx={6} fill={C.white} />
        <circle cx={50} cy={50} r={45} fill={C.red} />
        <rect x={19} y={41} width={62} height={13} rx={1} fill={C.white} />
        {legend(C.white, 50, 72, 12, 'DO NOT', { track: 0.2 })}
        {legend(C.white, 50, 86, 12, 'ENTER', { track: 0.2 })}
      </>
    ),
  },

  'r5-1a-wrong-way': {
    viewBox: BOX_WIDE,
    aspect: 'wide',
    face: FACE_WIDE,
    draw: () => (
      <>
        {wideFace(C.red, C.white)}
        {legendLines(C.white, 70, 48, 20, 24, ['WRONG', 'WAY'], { track: 0.4 })}
      </>
    ),
  },

  'r5-2-no-trucks': {
    viewBox: BOX_SQUARE,
    face: FACE_SQUARE,
    draw: () => (
      <>
        {squareFace(C.white)}
        {truck(C.black, 50, 46, 0.95)}
        {prohibition(C.red)}
      </>
    ),
  },

  'r5-6-no-bicycles': {
    viewBox: BOX_SQUARE,
    face: FACE_SQUARE,
    draw: () => (
      <>
        {squareFace(C.white)}
        {bicycle(C.black, 50, 48, 1.15)}
        {prohibition(C.red)}
      </>
    ),
  },

  'r6-1-one-way': {
    viewBox: BOX_WIDE,
    aspect: 'wide',
    face: FACE_BAND,
    // A broad white arrow with the legend knocked out of its shaft.
    draw: () => (
      <>
        {bandFace(C.black, C.white)}
        <path fill={C.white} d="M12 41 H104 V32 L131 50 L104 68 V59 H12 Z" />
        {legend(C.black, 56, 55, 13, 'ONE WAY', { track: 0.4 })}
      </>
    ),
  },

  'r6-2-one-way-vertical': {
    viewBox: BOX_TALL,
    aspect: 'tall',
    face: FACE_TALL,
    draw: () => (
      <>
        {tallFace(C.black, C.white)}
        <path fill={C.white} d="M33 82 V38 H24 L38 18 L52 38 H43 V82 Z" />
        {legend(C.white, 38, 88, 8, 'ONE WAY', { track: 0.2 })}
      </>
    ),
  },

  'r7-1-no-parking': {
    viewBox: BOX_TALL,
    aspect: 'tall',
    face: FACE_TALL,
    // R7-1 is a word sign: red legend and red border on white.
    draw: () => (
      <>
        {tallFace(C.white, C.red)}
        {legendLines(C.red, 38, 28, 12, 19, ['NO', 'PARKING', 'ANY TIME'], { track: 0.2 })}
      </>
    ),
  },

  'r7-8-accessible-parking': {
    viewBox: BOX_TALL,
    aspect: 'tall',
    face: FACE_TALL,
    draw: () => (
      <>
        {tallFace(C.blue, C.white)}
        {/* The international symbol of access, as the manual names it. */}
        <g transform="translate(38,34) scale(1)">
          <circle fill={C.white} cx={-3} cy={-15} r={4.5} />
          <path
            fill="none"
            stroke={C.white}
            strokeWidth={3.5}
            d="M-3 -8 V2 H8 M-3 -3 A11 11 0 1 0 8 8"
          />
        </g>
        {legend(C.white, 38, 70, 9, 'RESERVED', { track: 0.2 })}
        {legend(C.white, 38, 85, 9, 'PARKING', { track: 0.2 })}
      </>
    ),
  },

  'r9-4-no-hitchhiking': {
    viewBox: BOX_SQUARE,
    face: FACE_SQUARE,
    // The figure with the thumb out. TN: "it is illegal to stand on a roadway
    // to solicit a ride."
    draw: () => (
      <>
        {squareFace(C.white)}
        <g transform="translate(52,52)">
          <circle fill={C.black} cx={2} cy={-24} r={6} />
          <path fill={C.black} d="M-4 -16 h12 l3 14 h-5 l-2 -6 v8 l5 20 h-6 l-4 -14 l-4 14 h-6 l6 -22 z" />
          <path fill="none" stroke={C.black} strokeWidth={4} d="M8 -12 L20 -20" />
          <circle fill={C.black} cx={22} cy={-22} r={4} />
        </g>
        {prohibition(C.red)}
      </>
    ),
  },

  'r10-11-no-turn-on-red': {
    viewBox: BOX_TALL,
    aspect: 'tall',
    face: FACE_TALL,
    draw: () => (
      <>
        {tallFace(C.white)}
        {legendLines(C.black, 38, 32, 13, 20, ['NO TURN', 'ON RED'], { track: 0.2 })}
      </>
    ),
  },

  'r11-2-road-closed': {
    viewBox: BOX_WIDE,
    aspect: 'wide',
    face: FACE_WIDE,
    draw: () => (
      <>
        {wideFace(C.white)}
        {legendLines(C.black, 70, 44, 17, 21, ['ROAD', 'CLOSED'], { track: 0.4 })}
      </>
    ),
  },

  'r15-1-crossbuck': {
    viewBox: BOX_SQUARE,
    face: FACE_CROSSBUCK,
    draw: () => (
      <>
        <g transform="rotate(45 50 50)">
          <rect x={5} y={41} width={90} height={18} rx={2} fill={C.white} />
          <rect
            x={5}
            y={41}
            width={90}
            height={18}
            rx={2}
            fill="none"
            stroke={C.black}
            strokeWidth={2}
          />
        </g>
        <g transform="rotate(-45 50 50)">
          <rect x={5} y={41} width={90} height={18} rx={2} fill={C.white} />
          <rect
            x={5}
            y={41}
            width={90}
            height={18}
            rx={2}
            fill="none"
            stroke={C.black}
            strokeWidth={2}
          />
        </g>
        {/* Legends painted after both blades so neither word is buried, each
            haloed in the face white where the two words genuinely cross. */}
        <g transform="rotate(45 50 50)">
          {legend(C.black, 50, 54.5, 9.5, 'RAILROAD', { track: 0.2, halo: C.white })}
        </g>
        <g transform="rotate(-45 50 50)">
          {legend(C.black, 50, 54.5, 9.5, 'CROSSING', { track: 0.2, halo: C.white })}
        </g>
      </>
    ),
  },

  'r15-2p-number-of-tracks': {
    viewBox: BOX_WIDE,
    aspect: 'wide',
    face: FACE_WIDE,
    draw: (value = 2) => (
      <>
        {wideFace(C.white)}
        {legend(C.black, 70, 58, 22, `${String(value)} TRACKS`, { track: 0.4 })}
      </>
    ),
  },
};
