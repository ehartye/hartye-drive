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
import type { LoadResult, LoadStatus } from '~/domain/persistence';
import { completeSession, emptyProgress, recordAttempt } from '~/domain/progress';
import type { AttemptInput, RecordedAttempt, StudyProgress } from '~/domain/progress';

/**
 * `session-only` means the device refused the write. Nothing is broken — the
 * app works for this sitting — but the learner is owed the truth about it
 * (practices C5).
 *
 * `quarantined` means the opposite failure: the device *has* a record and this
 * build could not read it (corrupt, or written by a newer version). Writing
 * would overwrite the only copy of work the learner might still get back, so
 * the store goes read-only until they choose. Mockup `02d` promises exactly
 * this in words — "your 248 answers are still on the device, nothing has been
 * deleted" — and a promise the code does not keep is worse than no promise.
 */
export type StorageMode = 'ok' | 'session-only' | 'quarantined';

export interface ProgressStore {
  progress: StudyProgress;
  storageMode: StorageMode;
  /** What the loader made of the stored payload — drives the error screen. */
  storageStatus: LoadStatus;
  /** Present on `future`: the version the device's record was written by. */
  foundVersion: number | null;
  /** One sentence explaining why the stored record was not used, if it wasn't. */
  storageNotice: string | null;
  answer: (input: AttemptInput) => RecordedAttempt;
  finishSession: (at: number) => void;
  /** Erases the stored record, quarantine included, and starts a clean one. */
  resetProgress: () => void;
}

type Persisted = Pick<ProgressStore, 'progress'>;

type StorageFacts = Pick<
  ProgressStore,
  'storageMode' | 'storageNotice' | 'storageStatus' | 'foundVersion'
>;

/** Set while an unreadable record is on the device. Suppresses every write. */
let quarantined = false;

/**
 * The store binding is not usable until `create` returns, and `zustand`'s
 * `persist` runs a synchronous storage synchronously *inside* it. Anything
 * discovered during that pass is therefore stashed and applied afterwards —
 * calling `useProgressStore.setState` from inside the hydration would hit the
 * `const`'s temporal dead zone, and zustand swallows the error, which is
 * exactly how a storage notice can be written, shipped, and never once appear.
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
    storageNotice:
      'This device is not letting the app save anything — private browsing or a full ' +
      'storage quota. You can keep studying; this session just will not be remembered.',
    storageStatus: 'empty',
    foundVersion: null,
  };
  if (created) useProgressStore.setState(failure);
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

function factsFor(result: LoadResult): StorageFacts {
  // Corrupt and future payloads are the two the app must not write over.
  quarantined = result.status === 'corrupt' || result.status === 'future';
  return {
    storageMode: quarantined ? 'quarantined' : 'ok',
    storageNotice: noticeFor(result),
    storageStatus: result.status,
    foundVersion: result.foundVersion ?? null,
  };
}

/** Read once, before the store exists, so the first render already knows. */
const initial = loadProgress(safe.getItem(STORAGE_KEY));
const initialFacts = factsFor(initial);

const storage: PersistStorage<Persisted> = {
  getItem(name) {
    const result = loadProgress(safe.getItem(name));
    factsFor(result);
    return { state: { progress: result.state }, version: CURRENT_SCHEMA_VERSION };
  },
  setItem(name, value) {
    if (quarantined) return;
    safe.setItem(name, serializeProgress(value.state.progress));
  },
  removeItem(name) {
    safe.removeItem(name);
  },
};

export const useProgressStore = create<ProgressStore>()(
  persist(
    (set, get) => ({
      progress: initial.state,
      ...initialFacts,

      answer(input) {
        const result = recordAttempt(get().progress, input);
        set({ progress: result.state });
        return result;
      },

      finishSession(at) {
        set({ progress: completeSession(get().progress, at) });
      },

      resetProgress() {
        // Lifting the quarantine is the point of the button: the learner has
        // been shown what is on the device and has chosen to replace it.
        quarantined = false;
        safe.removeItem(STORAGE_KEY);
        set({
          progress: emptyProgress(),
          storageMode: get().storageMode === 'session-only' ? 'session-only' : 'ok',
          storageStatus: 'empty',
          foundVersion: null,
          storageNotice: null,
        });
      },
    }),
    {
      name: STORAGE_KEY,
      storage,
      version: CURRENT_SCHEMA_VERSION,
      partialize: (state): Persisted => ({ progress: state.progress }),
    },
  ),
);

created = true;
// A device that refused the read has already reported it by now.
if (failure) useProgressStore.setState(failure);
