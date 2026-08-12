import { colorLabel, shapeLabel } from '~/signs/registry';
import type { SignEntry } from '~/signs/registry';
import { categoryLabel } from './categories';

/**
 * What the search box actually reads.
 *
 * Name and meaning are the obvious half. Shape, colour and category are the
 * important half: a learner who saw a sign on the way to work remembers "an
 * orange diamond", not "W20-1", and the library's whole argument is that shape
 * and colour come before words. The MUTCD designation is in there too, for the
 * one learner in a hundred who is looking one up.
 */
export function searchIndex(sign: SignEntry): string {
  return [
    sign.name,
    sign.mutcd,
    shapeLabel(sign.shape),
    colorLabel(sign.faceColor),
    colorLabel(sign.legendColor),
    ...(sign.accentColors ?? []).map(colorLabel),
    categoryLabel(sign.category),
    sign.meaning,
  ]
    .join(' ')
    .toLowerCase();
}

/**
 * Every word must land, in any order — "orange diamond" is a real thing a
 * learner types, and it should not depend on which word they put first. An
 * empty query matches everything: an empty box is not a filter.
 */
export function matchesSignQuery(sign: SignEntry, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const index = searchIndex(sign);
  return words.every((word) => index.includes(word));
}

/* ------------------------------------------------------------ near misses */

export interface NearMiss {
  /** The sign that actually governs the thing the learner searched for. */
  signId: string;
  /** Why nothing matched, and what does. One sentence, no apology. */
  note: string;
}

/**
 * Things learners search for that Tennessee posts no sign for.
 *
 * An empty result that says "no matches" teaches nothing. These say *why*
 * there is no such sign and hand over the rule that actually applies — which is
 * the difference between a dead end and a lesson. Kept deliberately short: every
 * entry is a thing the manual genuinely governs under another sign's name, not
 * a guess at what someone meant.
 */
const NEAR_MISSES: Readonly<Record<string, NearMiss>> = {
  roundabout: {
    signId: 'r1-2-yield',
    note: 'Tennessee posts no sign called “roundabout”. Entering one is governed by YIELD — you give way to traffic already in the circle.',
  },
  'traffic circle': {
    signId: 'r1-2-yield',
    note: 'A traffic circle has no sign of its own. YIELD is the rule at the entry: traffic already in the circle goes first.',
  },
  carpool: {
    signId: 'r3-10-hov-lane',
    note: 'The carpool lane is signed as HIGH OCCUPANCY VEHICLE — a white regulatory sign naming the minimum number of people in the car and the hours it applies.',
  },
  handicap: {
    signId: 'r7-8-accessible-parking',
    note: 'The blue sign with the wheelchair symbol reserves accessible parking. Parking there without the permit is a violation, not a courtesy.',
  },
  'speed bump': {
    signId: 'w13-1p-advisory-speed',
    note: 'A speed bump is not a MUTCD sign. Where one is signed at all, it is a yellow warning with an advisory speed plaque under it.',
  },
};

export function nearMissFor(query: string): NearMiss | undefined {
  return NEAR_MISSES[query.trim().toLowerCase().replace(/\s+/g, ' ')];
}
