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
  SignRecord,
} from '~/domain/sign-progress';

export type StorageMode = 'ok' | 'session-only';

export interface SignStore {
  record: SignRecord;
  storageMode: StorageMode;
  storageNotice: string | null;
  answerSign: (input: SignAnswerInput) => RecordedSignAnswer;
  finishDrill: (at: number) => void;
  resetSigns: () => void;
}

type Persisted = Pick<SignStore, 'record'>;

/** Discovered during rehydration, which runs before the store exists. */
let pending: Pick<SignStore, 'storageMode' | 'storageNotice'> | null = null;

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
      'quota. You can keep drilling; which signs you have learned just will not be remembered.',
  };
  useSignStore.setState(pending);
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

const storage: PersistStorage<Persisted> = {
  getItem(name) {
    const result = loadSignRecord(safe.getItem(name));
    const notice = noticeFor(result);
    if (notice) pending = { storageMode: 'ok', storageNotice: notice };
    return { state: { record: result.state }, version: SIGN_RECORD_VERSION };
  },
  setItem(name, value) {
    safe.setItem(name, serializeSignRecord(value.state.record));
  },
  removeItem(name) {
    safe.removeItem(name);
  },
};

export const useSignStore = create<SignStore>()(
  persist(
    (set, get) => ({
      record: emptySignRecord(),
      storageMode: 'ok',
      storageNotice: null,

      answerSign(input) {
        const result = recordSignAnswer(get().record, input);
        set({ record: result.state });
        return result;
      },

      finishDrill(at) {
        set({ record: completeDrill(get().record, at) });
      },

      resetSigns() {
        set({ record: emptySignRecord() });
      },
    }),
    {
      name: SIGN_STORAGE_KEY,
      storage,
      version: SIGN_RECORD_VERSION,
      partialize: (state): Persisted => ({ record: state.record }),
      onRehydrateStorage: () => () => {
        if (pending) useSignStore.setState(pending);
      },
    },
  ),
);
