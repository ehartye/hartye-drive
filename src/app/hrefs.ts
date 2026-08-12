/**
 * In-app addresses, written once.
 *
 * A leaf module on purpose: `route-paths.ts` pulls in the whole route table and
 * therefore every route component, so a component that imported its URL helper
 * from there would close a cycle back onto itself. Nothing here imports
 * anything.
 */

import { DEFAULT_SESSION_SIZE } from '~/domain/session';

/** The rule-reference page a citation resolves to. */
export function ruleHref(ruleId: string): string {
  return `/rules/${encodeURIComponent(ruleId)}`;
}

/**
 * A study session pinned to an exact line-up. Capped at one session's worth —
 * "practice this topic" means a sitting, not the whole topic in one go.
 */
export function practiceHref(questionIds: readonly string[]): string {
  const wanted = questionIds.slice(0, DEFAULT_SESSION_SIZE);
  return `/study/session?q=${wanted.map(encodeURIComponent).join(',')}`;
}
