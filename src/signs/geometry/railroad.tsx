/**
 * Railroad signs other than the crossbuck itself (R15-1, which lives with the
 * R-series). The manual's shape key is unusually blunt here: "Round Shape —
 * Railroad Ahead", "Broad 'X' Shape — Railroad Here".
 */
import type { SignGeometry } from '../registry';
import {
  BOX_SQUARE,
  BOX_TALL,
  C,
  FACE_CIRCLE,
  FACE_DIAMOND,
  FACE_TALL,
  circleFace,
  diamondFace,
  legend,
  legendLines,
  tallFace,
} from './shared';

export const RAILROAD: Readonly<Record<string, SignGeometry>> = {
  'w10-1-railroad-advance': {
    viewBox: BOX_SQUARE,
    face: FACE_CIRCLE,
    // An X, never a +. W10-1 is the crossbuck's advance warning and carries the
    // same broad X, with an R in each side quadrant.
    draw: () => (
      <>
        {circleFace(C.yellow)}
        <path fill="none" stroke={C.black} strokeWidth={8} d="M19 19 L81 81 M81 19 L19 81" />
        {legend(C.black, 27, 59, 23, 'R')}
        {legend(C.black, 73, 59, 23, 'R')}
      </>
    ),
  },

  'w10-2-railroad-at-intersection': {
    viewBox: BOX_SQUARE,
    face: FACE_DIAMOND,
    // Tracks crossing one leg of an intersection just ahead: the crossbuck
    // symbol sitting on the side road.
    draw: () => (
      <>
        {diamondFace(C.yellow)}
        <path fill="none" stroke={C.black} strokeWidth={6} d="M50 80 V30 M30 46 H74" />
        <path fill="none" stroke={C.black} strokeWidth={5} d="M56 26 L74 44 M74 26 L56 44" />
      </>
    ),
  },

  'i-13-ens': {
    viewBox: BOX_TALL,
    aspect: 'tall',
    face: FACE_TALL,
    // The Emergency Notification System sign, "normally blue in color and may
    // be located on the crossbuck post or signal post". No telephone number is
    // drawn, because the manual does not print one and this app invents nothing.
    draw: () => (
      <>
        {tallFace(C.blue, C.white)}
        {legendLines(C.white, 38, 24, 8, 12, ['RAILROAD', 'CROSSING'], { track: 0.1 })}
        <rect fill={C.white} x={13} y={44} width={50} height={2} />
        {legendLines(C.white, 38, 60, 8, 12, ['EMERGENCY', 'NOTIFICATION'], { track: 0.1 })}
        {legend(C.white, 38, 86, 9, 'ENS', { track: 0.4 })}
      </>
    ),
  },
};
