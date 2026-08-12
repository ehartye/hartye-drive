/**
 * The erase, and the proof that it happened.
 *
 * "Delete" is assumed to always succeed. It does not: a private window, a
 * locked profile, a managed device or a read-only volume can each refuse the
 * write — sometimes by throwing, sometimes by accepting the call and changing
 * nothing at all. Both are failures, and the second is the dangerous one,
 * because an app that trusts the absence of an exception reports success over
 * data that is still sitting there.
 *
 * So the order matters, and it is deliberate:
 *
 *   1. remove each record key, catching whatever the browser throws;
 *   2. **read every key back**;
 *   3. judge the outcome in `src/domain/settings.ts`, which is pure and tested;
 *   4. clear the in-memory stores **only on success**.
 *
 * Step 4 last is the whole point. Clearing memory first and then discovering
 * the write was refused would leave the learner looking at an empty progress
 * page while their record sat intact on disk — the app telling them it lost
 * their work, which is the opposite of what happened.
 *
 * Preferences are not in this list. They are not progress, and erasing them is
 * a loss the learner did not ask for.
 */
import { STORAGE_KEY as PROGRESS_KEY } from '~/domain/persistence';
import { EXAM_STORAGE_KEY, emptyExamRecord } from '~/domain/exam-history';
import { SIGN_STORAGE_KEY } from '~/domain/sign-progress';
import { classifyErasure } from '~/domain/settings';
import type { ErasureProbe, ResetOutcome } from '~/domain/settings';
import { useProgressStore } from './progress';
import { useExamStore } from './exam';
import { useSignStore } from './signs';

/** Every key that holds something the learner earned. */
export const RECORD_KEYS: readonly string[] = [PROGRESS_KEY, EXAM_STORAGE_KEY, SIGN_STORAGE_KEY];

function probe(key: string): ErasureProbe {
  let threw = false;
  try {
    localStorage.removeItem(key);
  } catch {
    threw = true;
  }

  let readBack: string | null = null;
  try {
    readBack = localStorage.getItem(key);
  } catch {
    // A storage that will not even be read is certainly not one that was
    // cleared. Reported as a refusal rather than assumed empty.
    threw = true;
  }

  return { key, threw, readBack };
}

export function resetAllRecords(): ResetOutcome {
  let probes: ErasureProbe[];
  try {
    probes = RECORD_KEYS.map(probe);
  } catch {
    // `localStorage` itself is unreachable — a blocked-cookies policy throws on
    // the property access, not on the method.
    return { ok: false, blocked: [...RECORD_KEYS], reason: 'storage-refused' };
  }

  const outcome = classifyErasure(probes);
  if (!outcome.ok) return outcome;

  useProgressStore.getState().resetProgress();
  useSignStore.getState().resetSigns();
  useExamStore.setState({ record: emptyExamRecord() });

  return outcome;
}

/** What the settings page reports before the erase, and after one that failed. */
export function readRecordSizes(): { key: string; raw: string | null }[] {
  return RECORD_KEYS.map((key) => {
    try {
      return { key, raw: localStorage.getItem(key) };
    } catch {
      return { key, raw: null };
    }
  });
}
