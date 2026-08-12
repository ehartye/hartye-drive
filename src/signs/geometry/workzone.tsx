/**
 * Work-zone signs. "generally diamond or rectangular shaped, orange with black
 * letters or symbols" — the manual, printed p.39.
 *
 * Orange is construction and maintenance warning. It is not incident
 * management (fluorescent pink) and it is not a general warning (yellow).
 */
import type { SignGeometry } from '../registry';
import {
  BOX_SQUARE,
  BOX_WIDE,
  C,
  FACE_DIAMOND,
  FACE_SQUARE,
  FACE_WIDE,
  arrowHead,
  diamondFace,
  legend,
  legendLines,
  squareFace,
  wideFace,
} from './shared';

export const WORK_ZONE: Readonly<Record<string, SignGeometry>> = {
  'w20-1-road-work-ahead': {
    viewBox: BOX_SQUARE,
    face: FACE_DIAMOND,
    draw: () => (
      <>
        {diamondFace(C.orange)}
        {legendLines(C.black, 50, 43, 11, 14, ['ROAD', 'WORK', 'AHEAD'])}
      </>
    ),
  },

  'w20-4-one-lane-road-ahead': {
    viewBox: BOX_SQUARE,
    face: FACE_DIAMOND,
    draw: () => (
      <>
        {diamondFace(C.orange)}
        {legendLines(C.black, 50, 40, 10, 13, ['ONE LANE', 'ROAD', 'AHEAD'])}
      </>
    ),
  },

  'w20-5-right-lane-closed': {
    viewBox: BOX_SQUARE,
    face: FACE_DIAMOND,
    draw: () => (
      <>
        {diamondFace(C.orange)}
        {legendLines(C.black, 50, 40, 9, 13, ['RIGHT LANE', 'CLOSED', 'AHEAD'])}
      </>
    ),
  },

  'w20-7-flagger': {
    viewBox: BOX_SQUARE,
    face: FACE_DIAMOND,
    // A flagger with the paddle raised — "Flaggers, at most worksites, will be
    // using paddles with the word stop on one side and slow on the other."
    draw: () => (
      <>
        {diamondFace(C.orange)}
        <circle fill={C.black} cx={40} cy={30} r={6} />
        <path fill={C.black} d="M34 38 h12 l3 15 h-5 l-2 -7 v9 l6 21 h-6 l-5 -16 l-4 16 h-6 l6 -23 v-8 l-2 9 h-5 z" />
        {/* The raised arm and the paddle it holds — "paddles with the word
            stop on one side and slow on the other". */}
        <path fill="none" stroke={C.black} strokeWidth={4} d="M46 42 L57 36" />
        <rect fill={C.black} x={56} y={26} width={13} height={13} rx={2} />
      </>
    ),
  },

  'w21-1-workers': {
    viewBox: BOX_SQUARE,
    face: FACE_DIAMOND,
    // The worker with a shovel, bent to the work.
    draw: () => (
      <>
        {diamondFace(C.orange)}
        {/* Hard hat, then the worker bent to a shovel. */}
        <path fill={C.black} d="M33 26 a9 8 0 0 1 18 0 h-18 z" />
        <circle fill={C.black} cx={42} cy={30} r={5.5} />
        <path fill={C.black} d="M36 36 h12 l4 13 h-5 l-3 -6 l1 9 l5 24 h-6 l-5 -18 l-4 18 h-6 l5 -25 z" />
        <path fill="none" stroke={C.black} strokeWidth={3.5} d="M50 43 L64 60" />
        <path fill={C.black} d="M62 57 l11 6 l-6 8 z" />
      </>
    ),
  },

  'g20-2-end-road-work': {
    viewBox: BOX_WIDE,
    aspect: 'wide',
    face: FACE_WIDE,
    draw: () => (
      <>
        {wideFace(C.orange)}
        {legendLines(C.black, 70, 44, 16, 21, ['END', 'ROAD WORK'], { track: 0.3 })}
      </>
    ),
  },

  'm4-9-detour': {
    viewBox: BOX_WIDE,
    aspect: 'wide',
    face: FACE_WIDE,
    draw: () => (
      <>
        {wideFace(C.orange)}
        {legend(C.black, 62, 50, 20, 'DETOUR', { track: 0.4 })}
        <path fill="none" stroke={C.black} strokeWidth={6} d="M40 68 H92" />
        {arrowHead(C.black, 104, 68, 14, 0)}
      </>
    ),
  },

  'w20-1a-road-work-distance': {
    viewBox: BOX_SQUARE,
    face: FACE_SQUARE,
    // W16-2P: the distance plaque in FEET. The MILES plaque is W16-3P.
    draw: () => (
      <>
        {squareFace(C.orange)}
        {legend(C.black, 50, 48, 22, '1500', { mono: true, weight: 700 })}
        {legend(C.black, 50, 72, 17, 'FEET', { track: 0.3 })}
      </>
    ),
  },
};
