/**
 * The sign-mastery store — `zustand` + `persist`, on the convention P4 set and
 * P5 followed (deviations.md, 2026-08-11 §2): **every state transition is a
 * pure function in `src/domain/`; the store only holds the current value,
 * notifies React and moves bytes.** `persist`'s own serializer is replaced with
 * the domain's, so the code a critic exercises by writing garbage into
 * `localStorage` is the code that actually runs.
 *
 * Its own key (`tn-drive:signs`), separate from the study record and the exam
 * record: different shape, different lifetime, and a change to the sign trainer
 * has no business migrating a learner's question ladder.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PersistStorage } from 'zustand/middleware';
import { createSafeStorage } from '~/domain/persistence';
import {
  SIGN_RECORD_VERSION,
  SIGN_STORAGE_KEY,
  completeDrill,
  emptySignRecord,
  loadSignRecord,
  recordSignAnswer,
  serializeSignRecord,
} from '~/domain/sign-progress';
import type {
  RecordedSignAnswer,
  SignAnswerInput,
  SignLoadResult,
  SignLoadStatus,
  SignRecord,
} from '~/domain/sign-progress';

/**
 * `quarantined`: the device holds a sign record this build cannot read, so every
 * write is suppressed rather than overwriting the only copy. Same rule as the
 * study and exam records — see `store/progress.ts`.
 */
export type StorageMode = 'ok' | 'session-only' | 'quarantined';

export interface SignStore {
  record: SignRecord;
  storageMode: StorageMode;
  storageStatus: SignLoadStatus;
  foundVersion: number | null;
  storageNotice: string | null;
  answerSign: (input: SignAnswerInput) => RecordedSignAnswer;
  finishDrill: (at: number) => void;
  resetSigns: () => void;
}

type Persisted = Pick<SignStore, 'record'>;

type StorageFacts = Pick<
  SignStore,
  'storageMode' | 'storageNotice' | 'storageStatus' | 'foundVersion'
>;

/** Set while an unreadable record is on the device. Suppresses every write. */
let quarantined = false;

/** See `store/progress.ts`: nothing during `create` may touch the binding. */
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
      'quota. You can keep drilling; which signs you have learned just will not be remembered.',
  };
  if (created) useSignStore.setState(failure);
});

function noticeFor(result: SignLoadResult): string | null {
  switch (result.status) {
    case 'corrupt':
      return `Your saved sign record could not be read, so it has been started over. (${result.detail ?? ''})`.trim();
    case 'future':
      return 'Your sign record was written by a newer version of this app, so it has been left alone and this session starts fresh.';
    default:
      return null;
  }
}

function factsFor(result: SignLoadResult): StorageFacts {
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
const initial = loadSignRecord(safe.getItem(SIGN_STORAGE_KEY));
const initialFacts = factsFor(initial);

const storage: PersistStorage<Persisted> = {
  getItem(name) {
    const result = loadSignRecord(safe.getItem(name));
    factsFor(result);
    return { state: { record: result.state }, version: SIGN_RECORD_VERSION };
  },
  setItem(name, value) {
    if (quarantined) return;
    safe.setItem(name, serializeSignRecord(value.state.record));
  },
  removeItem(name) {
    safe.removeItem(name);
  },
};

export const useSignStore = create<SignStore>()(
  persist(
    (set, get) => ({
      record: initial.state,
      ...initialFacts,

      answerSign(input) {
        const result = recordSignAnswer(get().record, input);
        set({ record: result.state });
        return result;
      },

      finishDrill(at) {
        set({ record: completeDrill(get().record, at) });
      },

      resetSigns() {
        // Lifting the quarantine is the point of the button: the learner has
        // been shown what is on the device and has chosen to replace it.
        quarantined = false;
        safe.removeItem(SIGN_STORAGE_KEY);
        set({
          record: emptySignRecord(),
          storageMode: get().storageMode === 'session-only' ? 'session-only' : 'ok',
          storageStatus: 'empty',
          foundVersion: null,
          storageNotice: null,
        });
      },
    }),
    {
      name: SIGN_STORAGE_KEY,
      storage,
      version: SIGN_RECORD_VERSION,
      partialize: (state): Persisted => ({ record: state.record }),
    },
  ),
);

created = true;
// A device that refused the read has already reported it by now.
if (failure) useSignStore.setState(failure);
