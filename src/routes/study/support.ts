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
 * **These are registry ids from `src/content/signs.json`, and nothing else.**
 * This map used to hold the Phase-1 mockup sprite's names (`stop`, `yield`,
 * `curve-right`), none of which the registry carries, so every study session
 * drew an empty dashed placeholder where its topic icon belongs.
 * `sign-references.test.ts` now fails the build on an id the registry does not
 * resolve, in this map and anywhere else in `src/`.
 *
 * Every topic in `taxonomy.json` is listed, so the area fallback below is a
 * belt-and-braces default for a topic added later rather than the normal path.
 */
export const TOPIC_SIGN_IDS: Readonly<Record<string, string>> = {
  /* signs */
  'sign-colors-and-shapes': 'r1-2-yield',
  'regulatory-signs': 'r1-1-stop',
  'warning-signs': 'w1-2-curve',
  'work-zone-signs': 'w20-1-road-work-ahead',
  'railroad-crossing-signs': 'r15-1-crossbuck',
  'traffic-signals': 'w3-3-signal-ahead',
  'pavement-markings': 'w14-3-no-passing-zone',
  'guide-and-service-signs': 'd1-1-destination',
  /* safe driving */
  'vehicle-readiness': 'w13-1p-advisory-speed',
  'safety-belts-and-restraints': 'w21-1-workers',
  'following-and-stopping-distance': 'w3-1-stop-ahead',
  'night-driving': 'w1-8-chevron',
  'adverse-weather': 'w8-5-slippery-when-wet',
  'emergency-handling': 'w7-4-runaway-ramp',
  'defensive-driving': 'w1-4-reverse-curve',
  'sharing-road-pedestrians-and-bicycles': 'w11-2-pedestrian',
  'sharing-road-large-vehicles': 'w11-14-horse-drawn',
  /* rules of the road */
  'speed-limits': 'r2-1-speed-limit',
  'right-of-way': 'r1-2-yield',
  turning: 'r3-5-mandatory-turn-lane',
  'lane-use-and-passing': 'r4-1-do-not-pass',
  'interstate-driving': 'e11-1-exit-only',
  'parking-and-backing': 'r7-1-no-parking',
  'required-stops': 'r1-1-stop',
  'vehicle-lighting': 'w8-13-bridge-ices',
  'phones-and-distraction': 'w2-1-cross-road',
  'driving-responsibilities': 'r5-1a-wrong-way',
  /* alcohol and drugs */
  'alcohol-effects': 'w1-5-winding-road',
  'dui-law': 'r5-1-do-not-enter',
  'dui-penalties': 'r11-2-road-closed',
  'underage-and-other-drugs': 'r5-6-no-bicycles',
};

const AREA_SIGN: Record<BlueprintArea, string> = {
  signs: 'r1-2-yield',
  'safe-driving': 'w1-2-curve',
  'rules-of-road': 'w3-3-signal-ahead',
  'alcohol-drugs': 'r1-1-stop',
};

export function signForTopic(topic: string, area: BlueprintArea): string {
  return TOPIC_SIGN_IDS[topic] ?? AREA_SIGN[area];
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
