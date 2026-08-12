/**
 * Guide, route-marker and service signs.
 *
 * The manual's colour key does the teaching here: "GREEN: Guidance",
 * "BLUE: Motorist services and information", "WHITE: Regulatory and Route
 * Markers". Interstate markers are the one place red and blue meet.
 */
import type { SignGeometry } from '../registry';
import {
  BOX_SQUARE,
  BOX_TALL,
  BOX_WIDE,
  C,
  FACE_SQUARE,
  FACE_TALL,
  FACE_WIDE,
  arrowHead,
  legend,
  squareFace,
  tallFace,
  wideFace,
} from './shared';

/** The interstate shield outline, and the same shape inset for the field. */
const SHIELD_OUTER =
  'M50 5 C36 5 22 10 11 17 V44 C11 68 30 85 50 96 C70 85 89 68 89 44 V17 C78 10 64 5 50 5 Z';
const SHIELD_TOP = 'M50 10 C37 10 25 14 15 20 V32 H85 V20 C75 14 63 10 50 10 Z';
const SHIELD_BODY = 'M15 32 H85 V44 C85 65 68 80 50 90 C32 80 15 65 15 44 Z';

/** The U.S. route shield: black numerals on a white shield, black background. */
const US_SHIELD =
  'M50 12 C40 12 27 14 18 19 C18 41 18 57 26 71 C34 83 44 88 50 90 C56 88 66 83 74 71 C82 57 82 41 82 19 C73 14 60 12 50 12 Z';

export const GUIDE: Readonly<Record<string, SignGeometry>> = {
  'm1-1-interstate-shield': {
    viewBox: BOX_SQUARE,
    face: SHIELD_OUTER,
    // "Blue and red signs ... indicate that the route is part of the national
    // system of interstate and defense highways."
    draw: (value = 40) => (
      <>
        <path fill={C.white} d={SHIELD_OUTER} />
        <path fill={C.red} d={SHIELD_TOP} />
        <path fill={C.blue} d={SHIELD_BODY} />
        {legend(C.white, 50, 27, 8, 'INTERSTATE', { track: 0.2 })}
        {legend(C.white, 50, 72, 30, String(value), { mono: true, weight: 700 })}
      </>
    ),
  },

  'm1-4-us-route': {
    viewBox: BOX_SQUARE,
    face: FACE_SQUARE,
    // "black numerals on a white shield surrounded by a black background
    // without a border" — the manual, printed p.40.
    draw: (value = 41) => (
      <>
        <rect x={1} y={1} width={98} height={98} rx={4} fill={C.black} />
        <path fill={C.white} d={US_SHIELD} />
        {legend(C.black, 50, 66, 30, String(value), { mono: true, weight: 700 })}
      </>
    ),
  },

  'm1-5-state-route': {
    viewBox: BOX_SQUARE,
    face: FACE_SQUARE,
    // Tennessee draws its primary state route marker as a square.
    draw: (value = 44) => (
      <>
        {squareFace(C.white)}
        {legend(C.black, 50, 32, 11, 'TENN', { track: 0.4 })}
        {legend(C.black, 50, 76, 32, String(value), { mono: true, weight: 700 })}
      </>
    ),
  },

  'd10-1-milepost': {
    viewBox: BOX_TALL,
    aspect: 'tall',
    face: FACE_TALL,
    draw: (value = 125) => (
      <>
        {tallFace(C.green, C.white)}
        {legend(C.white, 38, 30, 11, 'MILE', { track: 0.4 })}
        {legend(C.white, 38, 72, 28, String(value), { mono: true, weight: 700 })}
      </>
    ),
  },

  'e5-1-exit-gore': {
    viewBox: BOX_TALL,
    aspect: 'tall',
    face: FACE_TALL,
    // The gore sign standing in the paved triangle where the ramp leaves.
    draw: () => (
      <>
        {tallFace(C.green, C.white)}
        {legend(C.white, 38, 34, 17, 'EXIT', { track: 0.4 })}
        <path fill="none" stroke={C.white} strokeWidth={5} d="M28 50 V64 L46 76" />
        {arrowHead(C.white, 52, 80, 12, 34)}
      </>
    ),
  },

  'e11-1-exit-only': {
    viewBox: BOX_WIDE,
    aspect: 'wide',
    face: FACE_WIDE,
    // "If an interstate guide sign is marked with the above sign, all traffic in
    // the lane(s) directly below the arrows MUST exit."
    draw: () => (
      <>
        {wideFace(C.yellow)}
        {legend(C.black, 70, 46, 18, 'EXIT ONLY', { track: 0.3 })}
        <path fill="none" stroke={C.black} strokeWidth={5} d="M52 54 V64 M88 54 V64" />
        {arrowHead(C.black, 52, 76, 12, 90)}
        {arrowHead(C.black, 88, 76, 12, 90)}
      </>
    ),
  },

  'd1-1-destination': {
    viewBox: BOX_WIDE,
    aspect: 'wide',
    face: FACE_WIDE,
    draw: () => (
      <>
        {wideFace(C.green, C.white)}
        {legend(C.white, 62, 45, 15, 'NASHVILLE', { track: 0.3 })}
        {legend(C.white, 48, 68, 15, '12', { mono: true, weight: 700 })}
        {legend(C.white, 82, 68, 11, 'MILES', { track: 0.3 })}
      </>
    ),
  },

  'd9-2-hospital': {
    viewBox: BOX_TALL,
    aspect: 'tall',
    face: FACE_TALL,
    draw: () => (
      <>
        {tallFace(C.blue, C.white)}
        <path fill={C.white} d="M25 24 h11 v14 h11 v-14 h11 v42 h-11 v-15 h-11 v15 h-11 z" />
        {legend(C.white, 38, 84, 10, 'HOSPITAL', { track: 0.1 })}
      </>
    ),
  },

  'd9-7-gas': {
    viewBox: BOX_TALL,
    aspect: 'tall',
    face: FACE_TALL,
    // A fuel pump: body, hose and nozzle.
    draw: () => (
      <>
        {tallFace(C.blue, C.white)}
        <path fill={C.white} d="M22 22 h22 v44 h-22 z" />
        <rect fill={C.blue} x={26} y={27} width={14} height={11} rx={1} />
        <path
          fill="none"
          stroke={C.white}
          strokeWidth={3}
          d="M46 32 h6 a3 3 0 0 1 3 3 v22 a4 4 0 0 0 8 0 V40"
        />
        <rect fill={C.white} x={18} y={66} width={30} height={5} rx={2} />
        {legend(C.white, 38, 86, 11, 'GAS', { track: 0.3 })}
      </>
    ),
  },

  'd9-8-food': {
    viewBox: BOX_TALL,
    aspect: 'tall',
    face: FACE_TALL,
    // Fork and knife.
    draw: () => (
      <>
        {tallFace(C.blue, C.white)}
        <path
          fill={C.white}
          d="M25 20 v14 h-3 v-14 h-3 v18 a4 4 0 0 0 3 4 v12 h6 v-12 a4 4 0 0 0 3 -4 v-18 h-3 v14 h-3 z"
        />
        <path fill={C.white} d="M48 20 c6 4 8 12 6 20 h-4 v28 h-6 v-28 c-2 -10 0 -16 4 -20 z" />
        {legend(C.white, 38, 86, 11, 'FOOD', { track: 0.3 })}
      </>
    ),
  },
};
