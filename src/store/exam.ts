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
import type { ExamAttempt, ExamLoadResult, ExamRecord } from '~/domain/exam-history';
import type { ExamArea, ExamState } from '~/domain/exam';

export type StorageMode = 'ok' | 'session-only';

export interface ExamStore {
  record: ExamRecord;
  storageMode: StorageMode;
  storageNotice: string | null;
  /** Holds the sitting in progress, so a reload never silently destroys it. */
  saveActive: (state: ExamState) => void;
  /** Files a finished sitting and clears the one in progress. */
  fileAttempt: (state: ExamState, areas: readonly ExamArea[]) => ExamAttempt | null;
  abandonActive: () => void;
}

type Persisted = Pick<ExamStore, 'record'>;

/** Discovered during rehydration, which runs before the store exists. */
let pending: Pick<ExamStore, 'storageMode' | 'storageNotice'> | null = null;

const browserStorage = (): Storage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

const safe = createSafeStorage(browserStorage(), () => {
  pending = {
    storageMode: 'session-only',
    storageNotice:
      'This device is not letting the app save anything — private browsing or a full storage ' +
      'quota. You can still sit the exam; the score report just will not be kept.',
  };
  useExamStore.setState(pending);
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

const storage: PersistStorage<Persisted> = {
  getItem(name) {
    const result = loadExamRecord(safe.getItem(name));
    const notice = noticeFor(result);
    if (notice) pending = { storageMode: 'ok', storageNotice: notice };
    return { state: { record: result.state }, version: EXAM_RECORD_VERSION };
  },
  setItem(name, value) {
    safe.setItem(name, serializeExamRecord(value.state.record));
  },
  removeItem(name) {
    safe.removeItem(name);
  },
};

export const useExamStore = create<ExamStore>()(
  persist(
    (set, get) => ({
      record: emptyExamRecord(),
      storageMode: 'ok',
      storageNotice: null,

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
    }),
    {
      name: EXAM_STORAGE_KEY,
      storage,
      version: EXAM_RECORD_VERSION,
      partialize: (state): Persisted => ({ record: state.record }),
      onRehydrateStorage: () => () => {
        if (pending) useExamStore.setState(pending);
      },
    },
  ),
);
