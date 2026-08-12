/**
 * One answer to "can this device's saved record be read?", for every screen
 * that has an opinion about the learner's data.
 *
 * The three records — study, exams, signs — each quarantine themselves when the
 * payload on the device is corrupt or was written by a newer build. The
 * dashboard read that and said the right thing; `/progress` and `/settings`
 * read only their own derived numbers, which are legitimately zero while a
 * quarantine is in force, and so contradicted it. A learner with a 41 KB record
 * on the device was told by one screen that nothing had been deleted, and by
 * two others that nothing existed — one of which offered to erase it under a
 * confirmation reading "Erase all 0 of your answers?".
 *
 * There is one fact and it now has one owner. Every surface that speaks about
 * the learner's data asks this module first; nothing derives quarantine from a
 * count being zero, because a count of zero is exactly what a quarantine looks
 * like from inside the derivation.
 */
import { CURRENT_SCHEMA_VERSION, STORAGE_KEY } from '~/domain/persistence';
import { EXAM_RECORD_VERSION, EXAM_STORAGE_KEY } from '~/domain/exam-history';
import { SIGN_RECORD_VERSION, SIGN_STORAGE_KEY } from '~/domain/sign-progress';
import { useExamStore } from './exam';
import { useProgressStore } from './progress';
import { useSignStore } from './signs';

export interface RecordReport {
  /** The `localStorage` key, so the diagnostic can read the raw bytes back. */
  key: string;
  /** How the learner would name it: "study record", not `tn-drive:progress`. */
  name: string;
  /** `corrupt` or `future` — the two the app must not write over. */
  status: string;
  /** Present on `future`: the schema the device's record was written by. */
  found: number | null;
  /** The newest schema this build can read. */
  reads: number;
}

/**
 * The records this build refuses to touch, in the order the recovery screen
 * lists them. Empty means everything read cleanly.
 */
export function useUnreadableRecords(): RecordReport[] {
  const progressMode = useProgressStore((s) => s.storageMode);
  const progressStatus = useProgressStore((s) => s.storageStatus);
  const progressFound = useProgressStore((s) => s.foundVersion);
  const examMode = useExamStore((s) => s.storageMode);
  const examStatus = useExamStore((s) => s.storageStatus);
  const examFound = useExamStore((s) => s.foundVersion);
  const signMode = useSignStore((s) => s.storageMode);
  const signStatus = useSignStore((s) => s.storageStatus);
  const signFound = useSignStore((s) => s.foundVersion);

  return [
    {
      key: STORAGE_KEY,
      name: 'study record',
      mode: progressMode,
      status: progressStatus as string,
      found: progressFound,
      reads: CURRENT_SCHEMA_VERSION,
    },
    {
      key: EXAM_STORAGE_KEY,
      name: 'exam history',
      mode: examMode,
      status: examStatus as string,
      found: examFound,
      reads: EXAM_RECORD_VERSION,
    },
    {
      key: SIGN_STORAGE_KEY,
      name: 'sign record',
      mode: signMode,
      status: signStatus as string,
      found: signFound,
      reads: SIGN_RECORD_VERSION,
    },
  ]
    .filter((entry) => entry.mode === 'quarantined')
    .map(({ key, name, status, found, reads }) => ({ key, name, status, found, reads }));
}

/**
 * `true` while any record on this device cannot be read. Every screen that
 * reports a number about the learner's own data must check this before
 * reporting it, or it reports a zero it cannot stand behind.
 */
export function useQuarantined(): boolean {
  return useUnreadableRecords().length > 0;
}

/** English for what is being withheld, for a page that names it in a sentence. */
export function recordNames(records: readonly RecordReport[]): string {
  const names = records.map((record) => record.name);
  if (names.length <= 1) return names[0] ?? 'saved record';
  return `${names.slice(0, -1).join(', ')} and ${String(names.at(-1))}`;
}
