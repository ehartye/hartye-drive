/**
 * Small presentation helpers for the study session. Nothing here decides
 * anything about scheduling — that all lives in `src/domain/`.
 */
import type { BlueprintArea } from '~/content';

/**
 * The sign that rides beside the topic line. It is decorative: the topic is
 * already written in words next to it, so the sign carries no meaning a screen
 * reader would miss.
 *
 * Only ids present in P1's seeded renderer (`src/signs/signs.tsx`) are used —
 * a sign the renderer does not know draws a dashed placeholder, which would be
 * worse than none. **P3 grows the registry to ≥80 signs; when it lands, this
 * map should widen to a genuine per-topic sign** rather than falling back by
 * blueprint area.
 */
const TOPIC_SIGN: Record<string, string> = {
  'sign-colors-and-shapes': 'yield',
  'regulatory-signs': 'stop',
  'warning-signs': 'curve-right',
  'work-zone-signs': 'road-work-ahead',
  'railroad-crossing-signs': 'crossbuck',
  'traffic-signals': 'signal-ahead',
  'pavement-markings': 'no-passing-zone',
  'guide-and-service-signs': 'guide-destination',
  'sharing-road-pedestrians-and-bicycles': 'pedestrian-crossing',
  'speed-limits': 'speed-limit',
  'lane-use-and-passing': 'no-passing-zone',
  'required-stops': 'stop',
  'right-of-way': 'yield',
  'interstate-driving': 'guide-destination',
  'defensive-driving': 'curve-right',
  'adverse-weather': 'curve-right',
};

const AREA_SIGN: Record<BlueprintArea, string> = {
  signs: 'yield',
  'safe-driving': 'curve-right',
  'rules-of-road': 'signal-ahead',
  'alcohol-drugs': 'stop',
};

export function signForTopic(topic: string, area: BlueprintArea): string {
  return TOPIC_SIGN[topic] ?? AREA_SIGN[area];
}

const EFFECTIVE_DATE = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

/**
 * `2023-07-01` → `July 1, 2023`. Practices D10 requires each disclosure to
 * carry its **real** effective date, so this never degrades to "in force 2023".
 */
export function formatEffectiveDate(iso: string): string {
  const parsed = Date.parse(`${iso}T00:00:00Z`);
  return Number.isNaN(parsed) ? iso : EFFECTIVE_DATE.format(parsed);
}
