/**
 * Session building — the weakness-targeting half of the adaptive engine.
 *
 * The scheduler decides *when* a question comes back. This decides *what the
 * next twelve questions are*, which is the thing the learner actually
 * experiences. Four sources, in priority order:
 *
 *  1. **Due reviews** — cards the ladder says are owed, most overdue first.
 *     Capped at `REVIEW_SHARE` of the session so a learner who has been away
 *     for a fortnight is not handed twelve of their own past failures in a row.
 *  2. **Weak topics** — unseen questions, with slots allocated across topics in
 *     proportion to how badly the learner is doing in each. This is what makes
 *     the session adaptive rather than merely spaced.
 *  3. **New ground** — the same mechanism with no evidence yet, which
 *     degenerates to an even spread across the bank. A first session must cover
 *     the blueprint, not one topic.
 *  4. **Refreshers** — once the bank is exhausted, the least recently seen
 *     material, so a session is never short.
 *
 * The picks are then interleaved across those four buckets, because a session
 * that opens with eight consecutive items you got wrong last week teaches less
 * than one that mixes them with ground you are gaining.
 *
 * Pure, DOM-free, and deterministic given a seed — the seed exists so a session
 * survives a reload, and so tests can assert on an actual sequence.
 */
import { makeRandom, shuffled } from './random';
import { compareByDue, isDue } from './scheduler';
import type { CardState } from './scheduler';

/** The structural minimum a question needs to be schedulable. */
export interface SessionCandidate {
  id: string;
  topic: string;
  area: string;
}

export interface TopicStat {
  seen: number;
  correct: number;
}

export type PickReason = 'due' | 'weak-topic' | 'new' | 'refresher';

export interface SessionPick {
  questionId: string;
  topic: string;
  reason: PickReason;
}

export interface SessionPlan {
  picks: SessionPick[];
  /** Weak topics represented in this session, weakest first. Drives the copy. */
  weakestTopics: string[];
}

export interface BuildSessionInput {
  candidates: SessionCandidate[];
  cards: Record<string, CardState>;
  topics: Record<string, TopicStat>;
  now: number;
  size: number;
  seed: number;
}

/** Twelve: long enough to be worth sitting down for, short enough to finish. */
export const DEFAULT_SESSION_SIZE = 12;

/** At most two thirds of a session may be review. */
export const REVIEW_SHARE = 2 / 3;

/** Below this smoothed accuracy a topic is "weak" — and said so out loud. */
export const WEAK_TOPIC_CEILING = 0.7;

/** Fewer answers than this and the app has no business calling a topic weak. */
export const WEAK_TOPIC_MIN_SEEN = 3;

/**
 * Laplace-smoothed accuracy: `(correct + 1) / (seen + 2)`. An untouched topic
 * sits at 0.5, so it outranks a topic the learner is failing but not a topic
 * they are passing — which is exactly the priority the session wants, and it
 * cannot divide by zero.
 */
export function smoothedAccuracy(stat: TopicStat | undefined): number {
  const seen = stat?.seen ?? 0;
  const correct = stat?.correct ?? 0;
  return (correct + 1) / (seen + 2);
}

export function isWeakTopic(stat: TopicStat | undefined): boolean {
  if (!stat || stat.seen < WEAK_TOPIC_MIN_SEEN) return false;
  return smoothedAccuracy(stat) < WEAK_TOPIC_CEILING;
}

/** Weakest first. Ties go to the topic with more evidence, then to id order. */
export function rankTopicsByWeakness(
  topics: Record<string, TopicStat>,
  topicIds: readonly string[],
): string[] {
  return [...topicIds].sort((a, b) => {
    const diff = smoothedAccuracy(topics[a]) - smoothedAccuracy(topics[b]);
    if (Math.abs(diff) > 1e-12) return diff;
    const seen = (topics[b]?.seen ?? 0) - (topics[a]?.seen ?? 0);
    if (seen !== 0) return seen;
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

/* ------------------------------------------------------ deterministic draws */

/**
 * Largest-remainder allocation of `slots` across topics in proportion to
 * weight, never handing a topic more than it has. Deterministic: the input is
 * pre-ranked, and ties fall to the earlier (weaker) topic.
 */
function allocate(
  ranked: readonly { topic: string; weight: number; available: number }[],
  slots: number,
): Map<string, number> {
  const result = new Map<string, number>();
  const live = ranked.filter((t) => t.available > 0);
  const total = live.reduce((sum, t) => sum + t.weight, 0);
  if (live.length === 0 || slots <= 0 || total <= 0) return result;

  let assigned = 0;
  const shares = live.map((t, order) => {
    const ideal = (slots * t.weight) / total;
    const base = Math.min(Math.floor(ideal), t.available);
    assigned += base;
    return { topic: t.topic, take: base, available: t.available, remainder: ideal - Math.floor(ideal), order };
  });

  shares.sort((a, b) =>
    Math.abs(a.remainder - b.remainder) > 1e-12 ? b.remainder - a.remainder : a.order - b.order,
  );

  while (assigned < slots) {
    let progressed = false;
    for (const share of shares) {
      if (assigned >= slots) break;
      if (share.take >= share.available) continue;
      share.take += 1;
      assigned += 1;
      progressed = true;
    }
    // Every topic is full and the session is still short: the caller fills the
    // rest from another source.
    if (!progressed) break;
  }

  for (const share of shares) result.set(share.topic, share.take);
  return result;
}

/* ------------------------------------------------------------ the algorithm */

export function buildSession(input: BuildSessionInput): SessionPlan {
  const { candidates, cards, topics, now, size, seed } = input;
  if (size <= 0 || candidates.length === 0) return { picks: [], weakestTopics: [] };

  const random = makeRandom(seed);
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const taken = new Set<string>();
  const picks: SessionPick[] = [];

  const push = (questionId: string, topic: string, reason: PickReason) => {
    if (taken.has(questionId) || picks.length >= size) return;
    taken.add(questionId);
    picks.push({ questionId, topic, reason });
  };

  /* 1 — due reviews, capped. Cards for questions no longer in the bank are
        skipped rather than crashing the session (the bank can be re-cut). */
  const due = Object.values(cards)
    .filter((card) => byId.has(card.questionId) && isDue(card, now))
    .sort(compareByDue);
  const reviewCap = Math.min(due.length, Math.ceil(size * REVIEW_SHARE));
  for (const card of due.slice(0, reviewCap)) push(card.questionId, card.topic, 'due');

  /* 2/3 — unseen material, weighted toward the topics going worst. */
  const unseenByTopic = new Map<string, SessionCandidate[]>();
  for (const candidate of candidates) {
    if (cards[candidate.id] || taken.has(candidate.id)) continue;
    const bucket = unseenByTopic.get(candidate.topic);
    if (bucket) bucket.push(candidate);
    else unseenByTopic.set(candidate.topic, [candidate]);
  }

  const rankedTopicIds = rankTopicsByWeakness(topics, [...unseenByTopic.keys()]);
  const quota = allocate(
    rankedTopicIds.map((topic) => ({
      topic,
      weight: 1 - smoothedAccuracy(topics[topic]),
      available: unseenByTopic.get(topic)?.length ?? 0,
    })),
    size - picks.length,
  );

  for (const topic of rankedTopicIds) {
    const wanted = quota.get(topic) ?? 0;
    if (wanted <= 0) continue;
    const pool = shuffled(unseenByTopic.get(topic) ?? [], random);
    const reason: PickReason = isWeakTopic(topics[topic]) ? 'weak-topic' : 'new';
    for (const candidate of pool.slice(0, wanted)) push(candidate.id, candidate.topic, reason);
  }

  /* 4a — the review cap only exists to make room for new material. If there
          was none, spend the rest of the session on what is actually owed. */
  for (const card of due) {
    if (picks.length >= size) break;
    push(card.questionId, card.topic, 'due');
  }

  /* 4b — refreshers: seen, not yet owed, longest unseen first. */
  const refreshers = Object.values(cards)
    .filter((card) => byId.has(card.questionId) && !taken.has(card.questionId))
    .sort((a, b) =>
      a.lastSeenAt !== b.lastSeenAt
        ? a.lastSeenAt - b.lastSeenAt
        : a.questionId < b.questionId
          ? -1
          : 1,
    );
  for (const card of refreshers) {
    if (picks.length >= size) break;
    push(card.questionId, card.topic, 'refresher');
  }

  return {
    picks: interleave(picks),
    weakestTopics: rankTopicsByWeakness(
      topics,
      [...new Set(picks.map((p) => p.topic))].filter((topic) => isWeakTopic(topics[topic])),
    ),
  };
}

const BUCKET_ORDER: readonly PickReason[] = ['due', 'weak-topic', 'new', 'refresher'];

/** Round-robin across the four buckets, preserving order inside each. */
function interleave(picks: readonly SessionPick[]): SessionPick[] {
  const buckets = BUCKET_ORDER.map((reason) => picks.filter((p) => p.reason === reason));
  const out: SessionPick[] = [];
  const longest = Math.max(0, ...buckets.map((b) => b.length));
  for (let i = 0; i < longest; i += 1) {
    for (const bucket of buckets) {
      const pick = bucket[i];
      if (pick) out.push(pick);
    }
  }
  return out;
}

/**
 * The line under the question that says why it is being asked. An adaptive app
 * that cannot explain itself is indistinguishable from a shuffle.
 */
export function sessionRationale(
  weakestTopics: readonly string[],
  labelFor: (topicId: string) => string,
): string {
  const [first, second] = weakestTopics;
  if (first === undefined) {
    return 'queued to cover the exam blueprint evenly until there is enough history to target';
  }
  if (second === undefined) {
    return `queued because ${labelFor(first)} is your weakest topic`;
  }
  return `queued because ${labelFor(first)} and ${labelFor(second)} are your weakest topics`;
}
