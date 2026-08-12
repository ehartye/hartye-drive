/**
 * The exam record store — `zustand` + `persist`, on the convention P4 set
 * (deviations.md, 2026-08-11 §2): **every state transition is a pure function
 * in `src/domain/`; the store only holds the current value, notifies React and
 * moves bytes.** `persist`'s own serializer is replaced with the domain's, so
 * the code a critic exercises by writing garbage into `localStorage` is the
 * code that actually runs.
 *
 * It is a separate key from the study record (`tn-drive:exams`), because the
 * two have different shapes, different lifetimes and different bounds.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PersistStorage } from 'zustand/middleware';
import { createSafeStorage } from '~/domain/persistence';
import {
  EXAM_RECORD_VERSION,
  EXAM_STORAGE_KEY,
  attemptFromState,
  emptyExamRecord,
  loadExamRecord,
  recordExamAttempt,
  serializeExamRecord,
  setActiveExam,
} from '~/domain/exam-history';
import type {
  ExamAttempt,
  ExamLoadResult,
  ExamLoadStatus,
  ExamRecord,
} from '~/domain/exam-history';
import type { ExamArea, ExamState } from '~/domain/exam';

/**
 * `quarantined`: the device holds an exam history this build cannot read, so
 * every write is suppressed rather than overwriting the only copy. Same rule as
 * the study record — see `store/progress.ts`.
 */
export type StorageMode = 'ok' | 'session-only' | 'quarantined';

export interface ExamStore {
  record: ExamRecord;
  storageMode: StorageMode;
  storageStatus: ExamLoadStatus;
  foundVersion: number | null;
  storageNotice: string | null;
  /** Holds the sitting in progress, so a reload never silently destroys it. */
  saveActive: (state: ExamState) => void;
  /** Files a finished sitting and clears the one in progress. */
  fileAttempt: (state: ExamState, areas: readonly ExamArea[]) => ExamAttempt | null;
  abandonActive: () => void;
  /** Erases the stored history, quarantine included, and starts a clean one. */
  resetRecord: () => void;
}

type Persisted = Pick<ExamStore, 'record'>;

type StorageFacts = Pick<
  ExamStore,
  'storageMode' | 'storageNotice' | 'storageStatus' | 'foundVersion'
>;

/** Set while an unreadable history is on the device. Suppresses every write. */
let quarantined = false;

/**
 * See the note in `store/progress.ts`: `persist` runs a synchronous storage
 * synchronously inside `create`, so nothing discovered there may touch the
 * store binding. Facts are read first and applied as initial state.
 */
let created = false;
let failure: StorageFacts | null = null;

const browserStorage = (): Storage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

const safe = createSafeStorage(browserStorage(), () => {
  failure = {
    storageMode: 'session-only',
    storageStatus: 'empty',
    foundVersion: null,
    storageNotice:
      'This device is not letting the app save anything — private browsing or a full storage ' +
      'quota. You can still sit the exam; the score report just will not be kept.',
  };
  if (created) useExamStore.setState(failure);
});

function noticeFor(result: ExamLoadResult): string | null {
  switch (result.status) {
    case 'corrupt':
      return `Your saved exam history could not be read, so it has been started over. (${result.detail ?? ''})`.trim();
    case 'future':
      return 'Your exam history was written by a newer version of this app, so it has been left alone and this session starts fresh.';
    default:
      return null;
  }
}

function factsFor(result: ExamLoadResult): StorageFacts {
  quarantined = result.status === 'corrupt' || result.status === 'future';
  return {
    storageMode: quarantined ? 'quarantined' : 'ok',
    storageNotice: noticeFor(result),
    storageStatus: result.status,
    foundVersion: result.foundVersion ?? null,
  };
}

/** Read once, before the store exists, so the first render already knows. */
const initial = loadExamRecord(safe.getItem(EXAM_STORAGE_KEY));
const initialFacts = factsFor(initial);

const storage: PersistStorage<Persisted> = {
  getItem(name) {
    const result = loadExamRecord(safe.getItem(name));
    factsFor(result);
    return { state: { record: result.state }, version: EXAM_RECORD_VERSION };
  },
  setItem(name, value) {
    if (quarantined) return;
    safe.setItem(name, serializeExamRecord(value.state.record));
  },
  removeItem(name) {
    safe.removeItem(name);
  },
};

export const useExamStore = create<ExamStore>()(
  persist(
    (set, get) => ({
      record: initial.state,
      ...initialFacts,

      saveActive(state) {
        set({ record: setActiveExam(get().record, state) });
      },

      fileAttempt(state, areas) {
        const attempt = attemptFromState(state, areas);
        if (!attempt) return null;
        set({ record: recordExamAttempt(get().record, attempt) });
        return attempt;
      },

      abandonActive() {
        set({ record: setActiveExam(get().record, null) });
      },

      resetRecord() {
        quarantined = false;
        safe.removeItem(EXAM_STORAGE_KEY);
        set({
          record: emptyExamRecord(),
          storageMode: get().storageMode === 'session-only' ? 'session-only' : 'ok',
          storageStatus: 'empty',
          foundVersion: null,
          storageNotice: null,
        });
      },
    }),
    {
      name: EXAM_STORAGE_KEY,
      storage,
      version: EXAM_RECORD_VERSION,
      partialize: (state): Persisted => ({ record: state.record }),
    },
  ),
);

created = true;
// A device that refused the read has already reported it by now.
if (failure) useExamStore.setState(failure);
