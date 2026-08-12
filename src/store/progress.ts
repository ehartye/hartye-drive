/**
 * The study record store — `zustand` + `persist` (grounding §1).
 *
 * This file is deliberately thin. Every decision about *what the state becomes*
 * lives in `src/domain/` as a pure function; the store only holds the current
 * value, notifies React, and moves bytes to and from `localStorage`. The
 * envelope, the migrations and the corruption handling are the domain's too —
 * `persist`'s own serializer is replaced with the domain one so the code a
 * critic tests with a garbage payload is the code that actually runs
 * (executable-floor X19/X20).
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PersistStorage } from 'zustand/middleware';
import {
  CURRENT_SCHEMA_VERSION,
  STORAGE_KEY,
  createSafeStorage,
  loadProgress,
  serializeProgress,
} from '~/domain/persistence';
import type { LoadResult } from '~/domain/persistence';
import { completeSession, emptyProgress, recordAttempt } from '~/domain/progress';
import type { AttemptInput, RecordedAttempt, StudyProgress } from '~/domain/progress';

/**
 * `session-only` means the device refused the write. Nothing is broken — the
 * app works for this sitting — but the learner is owed the truth about it
 * (practices C5).
 */
export type StorageMode = 'ok' | 'session-only';

export interface ProgressStore {
  progress: StudyProgress;
  storageMode: StorageMode;
  /** One sentence explaining why the stored record was not used, if it wasn't. */
  storageNotice: string | null;
  answer: (input: AttemptInput) => RecordedAttempt;
  finishSession: (at: number) => void;
  resetProgress: () => void;
}

type Persisted = Pick<ProgressStore, 'progress'>;

/** Discovered during rehydration, which runs before the store exists. */
let pending: Pick<ProgressStore, 'storageMode' | 'storageNotice'> | null = null;

const browserStorage = (): Storage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

const safe = createSafeStorage(browserStorage(), () => {
  const notice =
    'This device is not letting the app save anything — private browsing or a full ' +
    'storage quota. You can keep studying; this session just will not be remembered.';
  pending = { storageMode: 'session-only', storageNotice: notice };
  useProgressStore.setState(pending);
});

function noticeFor(result: LoadResult): string | null {
  switch (result.status) {
    case 'corrupt':
      return `Your saved progress could not be read, so it has been started over. (${result.detail ?? ''})`.trim();
    case 'future':
      return 'Your saved progress was written by a newer version of this app, so it has been left alone and this session starts fresh.';
    case 'migrated':
      return null;
    default:
      return null;
  }
}

const storage: PersistStorage<Persisted> = {
  getItem(name) {
    const result = loadProgress(safe.getItem(name));
    const notice = noticeFor(result);
    if (notice) pending = { storageMode: 'ok', storageNotice: notice };
    return { state: { progress: result.state }, version: CURRENT_SCHEMA_VERSION };
  },
  setItem(name, value) {
    safe.setItem(name, serializeProgress(value.state.progress));
  },
  removeItem(name) {
    safe.removeItem(name);
  },
};

export const useProgressStore = create<ProgressStore>()(
  persist(
    (set, get) => ({
      progress: emptyProgress(),
      storageMode: 'ok',
      storageNotice: null,

      answer(input) {
        const result = recordAttempt(get().progress, input);
        set({ progress: result.state });
        return result;
      },

      finishSession(at) {
        set({ progress: completeSession(get().progress, at) });
      },

      resetProgress() {
        set({ progress: emptyProgress() });
      },
    }),
    {
      name: STORAGE_KEY,
      storage,
      version: CURRENT_SCHEMA_VERSION,
      partialize: (state): Persisted => ({ progress: state.progress }),
      onRehydrateStorage: () => () => {
        if (pending) useProgressStore.setState(pending);
      },
    },
  ),
);
