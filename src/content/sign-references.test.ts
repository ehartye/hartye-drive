import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import registryJson from '~/content/signs.json';
import type { SignRegistry } from '~/content/types';

/**
 * Every sign id the product mentions must resolve to a registry entry.
 *
 * This exists because it did not. `/study/session?q=stp-002` rendered its topic
 * icon as an empty dashed `data-missing-sign` box: `src/routes/study/support.ts`
 * mapped topics onto the *mockup sprite's* ids (`stop`, `yield`, `curve-right`)
 * rather than the registry's (`r1-1-stop`, `r1-2-yield`, `w1-2-curve`), so every
 * one of its twenty entries missed. `SignSvg` degrades to a dashed placeholder
 * for an unknown id, which is the right runtime behaviour and exactly why the
 * bug survived: nothing threw, nothing logged, the box was simply empty.
 *
 * A type cannot catch this — `SignSvg`'s `id` is a string, and widening it to a
 * union would still not cover ids that live in JSON. So it is caught here, by
 * reading the sources the way a reviewer would and refusing to let a literal
 * sign id exist that the registry does not carry.
 */
const registry = registryJson as unknown as SignRegistry;
const registryIds = new Set(registry.signs.map((sign) => sign.id));

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir: string, match: RegExp): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full, match);
    return match.test(entry.name) ? [full] : [];
  });
}

/** Every string under any `signs: [...]` key, at any depth, in any content JSON. */
function signRefsIn(value: unknown, key?: string): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) =>
      key === 'signs' && typeof item === 'string' ? [item] : signRefsIn(item),
    );
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([childKey, child]) => signRefsIn(child, childKey));
  }
  return [];
}

describe('sign ids referenced by content resolve against the registry', () => {
  const contentFiles = walk(path.join(SRC, 'content'), /\.json$/);

  it('finds content to check, so a rename cannot quietly empty this test', () => {
    expect(contentFiles.length).toBeGreaterThan(5);
  });

  it.each(contentFiles.map((file) => [path.relative(SRC, file), file] as const))(
    '%s references only registry ids',
    (_label, file) => {
      const refs = signRefsIn(JSON.parse(readFileSync(file, 'utf8')));
      const unknown = [...new Set(refs)].filter((id) => !registryIds.has(id));
      expect(unknown).toEqual([]);
    },
  );
});

describe('sign ids hard-coded in the app resolve against the registry', () => {
  /**
   * `<SignSvg id="…">`, `signId="…"` and the topic/area sign maps are the three
   * shapes a literal registry id takes in the source. Ids assembled at runtime
   * from content are covered by the suite above.
   */
  const LITERAL_ID =
    /(?:<SignSvg[^>]*?\bid=|\bsignId=|\bsignForTopic\()\s*["']([a-z0-9][a-z0-9-]*)["']/g;

  const sources = walk(SRC, /\.tsx?$/).filter((file) => !/\.test\.tsx?$/.test(file));

  it('finds sources to check', () => {
    expect(sources.length).toBeGreaterThan(10);
  });

  it('resolves every literal sign id in src/', () => {
    const offences: string[] = [];
    for (const file of sources) {
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(LITERAL_ID)) {
        const id = match[1] ?? '';
        if (!registryIds.has(id)) offences.push(`${path.relative(SRC, file)}: "${id}"`);
      }
    }
    expect(offences).toEqual([]);
  });

  it('resolves every value in the study session topic and area sign maps', async () => {
    const { TOPIC_SIGN_IDS } = await import('~/routes/study/support');
    for (const [topic, id] of Object.entries(TOPIC_SIGN_IDS)) {
      expect(registryIds.has(id), `${topic} -> ${id}`).toBe(true);
    }
  });
});
