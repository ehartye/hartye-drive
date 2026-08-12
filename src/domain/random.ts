/**
 * Deterministic draws, shared by the session builder and the exam sampler.
 *
 * Both need "random, but reproducible": a session must survive a reload, an
 * exam must be replayable from its seed, and a test must be able to assert on
 * an actual sequence. `Math.random()` can do none of that.
 */

/** mulberry32 — four lines, no dependency, and identical on every engine. */
export function makeRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Decorate-sort-undecorate: a shuffle with no index arithmetic to get wrong. */
export function shuffled<T>(items: readonly T[], random: () => number): T[] {
  return items
    .map((item) => ({ item, key: random() }))
    .sort((a, b) => a.key - b.key)
    .map((entry) => entry.item);
}
