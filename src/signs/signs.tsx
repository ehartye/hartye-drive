/**
 * Hand-authored MUTCD geometry. No clipart and no photography anywhere in this
 * product (grounding §2 signature). See `registry.ts` for the rules these obey
 * and for the note that P3 owns growing this seed to ≥80 entries.
 */
import type { SignEntry } from './registry';
import { MUTCD_COLORS as C } from './registry';

const OCT = '29.3,0 70.7,0 100,29.3 100,70.7 70.7,100 29.3,100 0,70.7 0,29.3';
const DIA = '50,1 99,50 50,99 1,50';
const TRI = '2,7 98,7 50,96';
const PEN = '50,1 98,37 79,99 21,99 2,37';

/** The yellow warning diamond every W-series sign is drawn on. */
const warningDiamond = (fill: string) => (
  <>
    <polygon fill={fill} points={DIA} />
    <polygon
      fill="none"
      stroke={C.black}
      strokeWidth={4}
      points={DIA}
      transform="translate(50,50) scale(.85) translate(-50,-50)"
    />
  </>
);

const LEGEND = { fontFamily: "'Overpass', sans-serif", fontWeight: 800, textAnchor: 'middle' } as const;

const entries: SignEntry[] = [
  {
    id: 'stop',
    mutcd: 'R1-1',
    name: 'Stop',
    category: 'regulatory',
    shape: 'Octagon',
    color: 'red',
    meaning: 'stop completely before the stop line',
    palette: [C.red, C.white],
    viewBox: '0 0 100 100',
    draw: () => (
      <>
        <polygon fill={C.red} points={OCT} />
        <polygon
          fill="none"
          stroke={C.white}
          strokeWidth={5}
          points={OCT}
          transform="translate(50,50) scale(.87) translate(-50,-50)"
        />
        <text {...LEGEND} fill={C.white} x={50} y={62} fontSize={28} letterSpacing={1}>
          STOP
        </text>
      </>
    ),
  },
  {
    id: 'yield',
    mutcd: 'R1-2',
    name: 'Yield',
    category: 'regulatory',
    shape: 'Downward triangle',
    color: 'white with a red border',
    meaning: 'slow down and give way to traffic and pedestrians ahead',
    palette: [C.red, C.white],
    viewBox: '0 0 100 100',
    // A red field with a white legend is the INVERSE of the real sign.
    draw: () => (
      <>
        <polygon fill={C.red} points={TRI} />
        <polygon fill={C.white} points="15,18 85,18 50,81" />
        <text {...LEGEND} fill={C.red} x={50} y={43} fontSize={12} letterSpacing={0.3}>
          YIELD
        </text>
      </>
    ),
  },
  {
    id: 'speed-limit',
    mutcd: 'R2-1',
    name: 'Speed limit',
    category: 'regulatory',
    shape: 'Vertical rectangle',
    color: 'white with black legend',
    meaning: 'the maximum legal speed in ideal conditions',
    palette: [C.white, C.black],
    viewBox: '0 0 76 96',
    aspect: 'tall',
    draw: (value = 55) => (
      <>
        <rect x={1} y={1} width={74} height={94} rx={4} fill={C.white} />
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
        <text {...LEGEND} fill={C.black} x={38} y={26} fontSize={12} letterSpacing={0.6}>
          SPEED
        </text>
        <text {...LEGEND} fill={C.black} x={38} y={40} fontSize={12} letterSpacing={0.6}>
          LIMIT
        </text>
        <text
          x={38}
          y={80}
          fontSize={40}
          fontWeight={700}
          textAnchor="middle"
          fill={C.black}
          fontFamily="'Overpass Mono', monospace"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {value}
        </text>
      </>
    ),
  },
  {
    id: 'no-passing-zone',
    mutcd: 'W14-3',
    name: 'No passing zone',
    category: 'warning',
    shape: 'Pennant',
    color: 'yellow',
    meaning: 'you are entering a no-passing zone; it is mounted on the left shoulder',
    palette: [C.yellow, C.black],
    viewBox: '0 0 100 100',
    draw: () => (
      <>
        <polygon fill={C.yellow} points="22,2 92,50 22,98" />
        {/* Scaled about the centroid, or the border goes hairline at one edge. */}
        <polygon
          fill="none"
          stroke={C.black}
          strokeWidth={3.5}
          points="22,2 92,50 22,98"
          transform="translate(45.3,50) scale(.82) translate(-45.3,-50)"
        />
        <text {...LEGEND} fill={C.black} x={44} y={38} fontSize={9}>
          NO
        </text>
        <text {...LEGEND} fill={C.black} x={44} y={53} fontSize={9}>
          PASSING
        </text>
        <text {...LEGEND} fill={C.black} x={44} y={68} fontSize={9}>
          ZONE
        </text>
      </>
    ),
  },
  {
    id: 'curve-right',
    mutcd: 'W1-2',
    name: 'Curve',
    category: 'warning',
    shape: 'Diamond',
    color: 'yellow',
    meaning: 'the road ahead curves; slow to a safe speed before you reach it',
    palette: [C.yellow, C.black],
    viewBox: '0 0 100 100',
    draw: () => (
      <>
        {warningDiamond(C.yellow)}
        {/* A gentle bend. A right angle would be W1-1 TURN, a different sign. */}
        <path
          fill="none"
          stroke={C.black}
          strokeWidth={7}
          strokeLinecap="butt"
          d="M40 78 C40 60 44 50 56 42"
        />
        <polygon fill={C.black} points="50,30 70,36 55,50" />
      </>
    ),
  },
  {
    id: 'signal-ahead',
    mutcd: 'W3-3',
    name: 'Signal ahead',
    category: 'warning',
    shape: 'Diamond',
    color: 'yellow',
    meaning: 'a traffic signal is ahead, often out of sight; be ready to stop',
    palette: [C.yellow, C.black, C.red, '#1FA05F'],
    viewBox: '0 0 100 100',
    draw: () => (
      <>
        {warningDiamond(C.yellow)}
        <rect fill={C.black} x={40} y={24} width={20} height={52} rx={4} />
        <circle fill={C.red} cx={50} cy={35} r={6} />
        <circle fill={C.yellow} cx={50} cy={50} r={6} />
        <circle fill="#1FA05F" cx={50} cy={65} r={6} />
      </>
    ),
  },
  {
    id: 'pedestrian-crossing',
    mutcd: 'W11-2',
    name: 'Pedestrian crossing',
    category: 'warning',
    shape: 'Diamond',
    color: 'fluorescent yellow-green',
    meaning: 'people on foot may be crossing ahead; yield to them',
    palette: [C.fluorescentYellowGreen, C.black],
    viewBox: '0 0 100 100',
    draw: () => (
      <>
        {warningDiamond(C.fluorescentYellowGreen)}
        <circle fill={C.black} cx={50} cy={30} r={6} />
        <path
          fill={C.black}
          d="M44 38 h12 l4 18 h-5 l-2-9 v10 l6 20 h-6 l-6-17 l-5 17 h-6 l7-24 v-9 l-2 12 h-5 z"
        />
      </>
    ),
  },
  {
    id: 'school-crossing',
    mutcd: 'S1-1',
    name: 'School zone / school crossing',
    category: 'school',
    shape: 'Pentagon',
    color: 'fluorescent yellow-green',
    meaning: 'a school zone or school crossing is ahead; watch for children',
    palette: [C.fluorescentYellowGreen, C.black],
    viewBox: '0 0 100 100',
    // Fluorescent yellow-green, never pink. Pink is incident management.
    draw: () => (
      <>
        <polygon fill={C.fluorescentYellowGreen} points={PEN} />
        <polygon
          fill="none"
          stroke={C.black}
          strokeWidth={3.5}
          points={PEN}
          transform="translate(50,55) scale(.86) translate(-50,-55)"
        />
        <circle fill={C.black} cx={41} cy={44} r={5} />
        <path
          fill={C.black}
          d="M36 51 h10 l4 14 h-4.5 l-1.5-7 v8 l5 16 h-5 l-4.5-13 l-4 13 h-5 l5.5-19 v-7 l-1.5 9 h-4.5 z"
        />
        <circle fill={C.black} cx={62} cy={47} r={4.5} />
        <path
          fill={C.black}
          d="M58 53 h9 l3.5 12 h-4 l-1-6 v7 l4.5 14 h-4.5 l-4-11 l-3.5 11 h-4.5 l5-16 v-6 l-1.5 7 h-4 z"
        />
      </>
    ),
  },
  {
    id: 'rr-advance',
    mutcd: 'W10-1',
    name: 'Railroad advance warning',
    category: 'railroad',
    shape: 'Circle',
    color: 'yellow',
    meaning: 'a railroad crosses the road ahead; slow, look and listen',
    palette: [C.yellow, C.black],
    viewBox: '0 0 100 100',
    // An X, never a +.
    draw: () => (
      <>
        <circle fill={C.yellow} cx={50} cy={50} r={49} />
        <circle fill="none" stroke={C.black} strokeWidth={3} cx={50} cy={50} r={43} />
        <path fill="none" stroke={C.black} strokeWidth={8} d="M19 19 L81 81 M81 19 L19 81" />
        <text {...LEGEND} fill={C.black} x={27} y={59} fontSize={23}>
          R
        </text>
        <text {...LEGEND} fill={C.black} x={73} y={59} fontSize={23}>
          R
        </text>
      </>
    ),
  },
  {
    id: 'crossbuck',
    mutcd: 'R15-1',
    name: 'Crossbuck',
    category: 'railroad',
    shape: 'Two crossed blades (an X)',
    color: 'white with black legend',
    meaning: 'you are at the crossing itself; yield to any train',
    palette: [C.white, C.black],
    viewBox: '0 0 100 100',
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
        {/* Legends painted after both blades so neither word is buried. */}
        <g transform="rotate(45 50 50)">
          <text
            {...LEGEND}
            fill={C.black}
            stroke={C.white}
            strokeWidth={2.2}
            paintOrder="stroke"
            x={50}
            y={54.5}
            fontSize={10}
            letterSpacing={0.2}
          >
            RAILROAD
          </text>
        </g>
        <g transform="rotate(-45 50 50)">
          <text
            {...LEGEND}
            fill={C.black}
            stroke={C.white}
            strokeWidth={2.2}
            paintOrder="stroke"
            x={50}
            y={54.5}
            fontSize={10}
            letterSpacing={0.2}
          >
            CROSSING
          </text>
        </g>
      </>
    ),
  },
  {
    id: 'road-work-ahead',
    mutcd: 'W20-1',
    name: 'Road work ahead',
    category: 'construction',
    shape: 'Diamond',
    color: 'orange',
    meaning: 'a work zone begins ahead; expect workers, equipment and lower speeds',
    palette: [C.orange, C.black],
    viewBox: '0 0 100 100',
    draw: () => (
      <>
        {warningDiamond(C.orange)}
        <text {...LEGEND} fill={C.black} x={50} y={43} fontSize={11}>
          ROAD
        </text>
        <text {...LEGEND} fill={C.black} x={50} y={57} fontSize={11}>
          WORK
        </text>
        <text {...LEGEND} fill={C.black} x={50} y={71} fontSize={11}>
          AHEAD
        </text>
      </>
    ),
  },
  {
    id: 'guide-destination',
    mutcd: 'D1-1',
    name: 'Destination guide sign',
    category: 'guide',
    shape: 'Horizontal rectangle',
    color: 'green',
    meaning: 'where this road goes and how far it is',
    palette: [C.green, C.white],
    viewBox: '0 0 140 100',
    aspect: 'wide',
    draw: () => (
      <>
        <rect fill={C.green} x={1} y={14} width={138} height={72} rx={5} />
        <rect
          fill="none"
          stroke={C.white}
          strokeWidth={2.5}
          x={6}
          y={19}
          width={128}
          height={62}
          rx={3}
        />
        <text {...LEGEND} fill={C.white} x={62} y={45} fontSize={15} letterSpacing={0.3}>
          NASHVILLE
        </text>
        <text {...LEGEND} fill={C.white} x={48} y={68} fontSize={15} letterSpacing={0.3}>
          12
        </text>
        <text {...LEGEND} fill={C.white} x={78} y={68} fontSize={11} letterSpacing={0.3}>
          MILES
        </text>
      </>
    ),
  },
  {
    id: 'motorist-services',
    mutcd: 'D9-2',
    name: 'Hospital / motorist services',
    category: 'services',
    shape: 'Square',
    color: 'blue',
    meaning: 'a motorist service — here, a hospital — is available at this exit',
    palette: [C.blue, C.white],
    viewBox: '0 0 100 100',
    draw: () => (
      <>
        <rect fill={C.blue} x={1} y={8} width={98} height={84} rx={5} />
        <rect
          fill="none"
          stroke={C.white}
          strokeWidth={2.5}
          x={6}
          y={13}
          width={88}
          height={74}
          rx={3}
        />
        <path fill={C.white} d="M43 30h14v13h13v14H57v13H43V57H30V43h13z" />
      </>
    ),
  },
];

export const SIGNS: ReadonlyMap<string, SignEntry> = new Map(entries.map((e) => [e.id, e]));

export const allSigns: readonly SignEntry[] = entries;

export function getSign(id: string): SignEntry | undefined {
  return SIGNS.get(id);
}
