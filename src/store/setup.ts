/**
 * The setup store — what onboarding asked, and whether this device can keep it.
 *
 * Thin by convention (deviations.md, P4 §2): every decision about what the
 * state becomes is a pure function in `src/domain/setup.ts`; this holds the
 * current value, notifies React, and moves bytes.
 *
 * It carries one thing the other stores do not: a **storage probe**, run at
 * module load. `typeof localStorage !== 'undefined'` is not the question a
 * private-browsing learner needs answered — Safari exposes the object and
 * throws on write — so the app writes, reads back and compares before it
 * promises to remember anything (practices C5, executable-floor X21).
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PersistStorage } from 'zustand/middleware';
import { createSafeStorage } from '~/domain/persistence';
import {
  SETUP_SCHEMA_VERSION,
  SETUP_STORAGE_KEY,
  completeSetup,
  isSetupComplete,
  loadSetup,
  probeStorage,
  serializeSetup,
} from '~/domain/setup';
import type { Setup, StudyGoal } from '~/domain/setup';

/** `session-only` means the device refused the write; nothing is broken. */
export type StorageMode = 'ok' | 'session-only';

export interface SetupStore {
  setup: Setup;
  storageMode: StorageMode;
  /** The learner chose to carry on without saving. Never assumed for them. */
  acceptedSessionOnly: boolean;
  save: (input: { goal: StudyGoal; testDate: string | null; at: number }) => void;
  acceptSessionOnly: () => void;
  /** Re-runs the probe — what "Check storage again" actually does. */
  recheckStorage: () => StorageMode;
}

type Persisted = Pick<SetupStore, 'setup'>;

const browserStorage = (): Storage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

/** See `store/progress.ts`: nothing during `create` may touch the binding. */
let created = false;
let failed = false;

const safe = createSafeStorage(browserStorage(), () => {
  failed = true;
  if (created) useSetupStore.setState({ storageMode: 'session-only' });
});

/** Read once, before the store exists, so the first render already knows. */
const initial = loadSetup(safe.getItem(SETUP_STORAGE_KEY));
const initialMode: StorageMode = probeStorage(browserStorage()) ? 'ok' : 'session-only';

const storage: PersistStorage<Persisted> = {
  getItem(name) {
    const result = loadSetup(safe.getItem(name));
    return { state: { setup: result.state }, version: SETUP_SCHEMA_VERSION };
  },
  setItem(name, value) {
    safe.setItem(name, serializeSetup(value.state.setup));
  },
  removeItem(name) {
    safe.removeItem(name);
  },
};

export const useSetupStore = create<SetupStore>()(
  persist(
    (set, get) => ({
      setup: initial.state,
      storageMode: initialMode,
      acceptedSessionOnly: false,

      save(input) {
        set({ setup: completeSetup(get().setup, input) });
      },

      acceptSessionOnly() {
        set({ acceptedSessionOnly: true });
      },

      recheckStorage() {
        const mode: StorageMode = probeStorage(browserStorage()) ? 'ok' : 'session-only';
        set({ storageMode: mode });
        return mode;
      },
    }),
    {
      name: SETUP_STORAGE_KEY,
      storage,
      version: SETUP_SCHEMA_VERSION,
      partialize: (state): Persisted => ({ setup: state.setup }),
    },
  ),
);

created = true;
if (failed) useSetupStore.setState({ storageMode: 'session-only' });

/**
 * Onboarding is done when the two questions have been answered — or when the
 * learner has chosen session-only mode, where there is nothing to answer them
 * *into*. Derived rather than stored: a second flag saying the same thing is a
 * second thing that can be wrong.
 */
export function isReady(state: SetupStore): boolean {
  return isSetupComplete(state.setup) || state.acceptedSessionOnly;
}
