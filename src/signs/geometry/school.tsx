/**
 * S-series school signs.
 *
 * **Fluorescent yellow-green (`#C7EA00`), always.** The manual's own colour key
 * reads "FLUORESCENT YELLOW-GREEN: School zones", and MUTCD reserves
 * fluorescent pink for incident management. Phase 1 shipped these in pink; that
 * is a factual error in the curriculum, not a style choice, and `audit:signs`
 * now fails the build on any colour a sign's registry entry does not declare.
 */
import type { SignGeometry } from '../registry';
import {
  BOX_SQUARE,
  BOX_TALL,
  C,
  FACE_DIAMOND,
  FACE_PENTAGON,
  FACE_TALL,
  diamondFace,
  legend,
  pentagonFace,
  tallFace,
  walkingFigure,
} from './shared';

const FYG = C['fluorescent-yellow-green'];

export const SCHOOL: Readonly<Record<string, SignGeometry>> = {
  's1-1-school': {
    viewBox: BOX_SQUARE,
    face: FACE_PENTAGON,
    // The five-sided school sign: two children walking, the taller behind.
    draw: () => (
      <>
        {pentagonFace(FYG)}
        {walkingFigure(C.black, 41, 70, 0.86)}
        {walkingFigure(C.black, 62, 72, 0.72)}
      </>
    ),
  },

  's3-1-school-bus-stop-ahead': {
    viewBox: BOX_SQUARE,
    face: FACE_DIAMOND,
    // A school bus in side view, loading.
    draw: () => (
      <>
        {diamondFace(FYG)}
        <path fill={C.black} d="M24 34 H70 C74 34 76 38 76 42 V64 H24 Z" />
        <rect fill={FYG} x={29} y={39} width={11} height={11} rx={1} />
        <rect fill={FYG} x={43} y={39} width={11} height={11} rx={1} />
        <rect fill={FYG} x={57} y={39} width={11} height={11} rx={1} />
        <circle fill={C.black} cx={35} cy={68} r={6} />
        <circle fill={C.black} cx={65} cy={68} r={6} />
        <rect fill={C.black} x={22} y={28} width={8} height={5} rx={1} />
      </>
    ),
  },

  's5-1-school-speed-limit': {
    viewBox: BOX_TALL,
    aspect: 'tall',
    face: FACE_TALL,
    // "controlled by a time clock and flashes yellow lights while illuminating
    // the speed limit" — hence the WHEN FLASHING legend. The beacons themselves
    // are a separate assembly mounted above the sign, not part of S5-1, so they
    // are not drawn on its face.
    draw: (value = 15) => (
      <>
        {tallFace(FYG)}
        {legend(C.black, 38, 22, 11, 'SCHOOL', { track: 0.2 })}
        {legend(C.black, 38, 35, 9, 'SPEED LIMIT', { track: 0.1 })}
        {legend(C.black, 38, 62, 24, String(value), { mono: true, weight: 700 })}
        {legend(C.black, 38, 75, 7.5, 'WHEN', { track: 0.1 })}
        {legend(C.black, 38, 85, 7.5, 'FLASHING', { track: 0.1 })}
      </>
    ),
  },
};
