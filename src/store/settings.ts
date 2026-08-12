/**
 * Reading preferences — the one record a reset deliberately leaves alone.
 *
 * Erasing three weeks of work is what the learner asked for; also resetting the
 * text size of someone who needed it larger is a second loss they did not ask
 * for. So preferences live under their own key, with their own schema version,
 * and `resetAllRecords` does not touch them.
 *
 * Same convention as the other three stores (deviations.md, P4 §2): the domain
 * owns the shape, the migrations and the corruption handling; the store holds
 * the current value and moves bytes. No `persist` middleware — the payload is
 * two enums, and reading and writing it directly is shorter than configuring a
 * serializer around it.
 *
 * The preferences are applied to `<html>` as data attributes rather than as
 * inline styles, so the whole cascade responds to them — including inside the
 * focus modes, which sit outside `AppShell`.
 */
import { create } from 'zustand';
import { createSafeStorage } from '~/domain/persistence';
import {
  PREFERENCES_STORAGE_KEY,
  loadPreferences,
  serializePreferences,
} from '~/domain/settings';
import type { MotionSetting, Preferences, TextSize } from '~/domain/settings';

export type StorageMode = 'ok' | 'session-only';

export interface SettingsStore {
  prefs: Preferences;
  storageMode: StorageMode;
  setTextSize: (size: TextSize) => void;
  setMotion: (motion: MotionSetting) => void;
}

const documentRoot = (): HTMLElement | null =>
  typeof document === 'undefined' ? null : document.documentElement;

const browserStorage = (): Storage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

let refusedWrite = false;
const safe = createSafeStorage(browserStorage(), () => {
  refusedWrite = true;
  useSettingsStore.setState({ storageMode: 'session-only' });
});

/**
 * `data-text-size` scales reading copy only — question stems stay in Overpass
 * at their own size, because they are the sign, not the book. `data-motion`
 * carries the declared preference; the `prefers-reduced-motion` query in
 * `base.css` still handles the device's own setting, so the two are additive
 * and neither can undo the other.
 */
export function applyAppearance(prefs: Preferences, root: HTMLElement | null): void {
  if (!root) return;
  root.dataset.textSize = prefs.textSize;
  root.dataset.motion = prefs.motion;
}

const initial = loadPreferences(safe.getItem(PREFERENCES_STORAGE_KEY)).prefs;

function persistPrefs(prefs: Preferences): void {
  safe.setItem(PREFERENCES_STORAGE_KEY, serializePreferences(prefs));
  applyAppearance(prefs, documentRoot());
}

export const useSettingsStore = create<SettingsStore>()((set, get) => ({
  prefs: initial,
  storageMode: refusedWrite ? 'session-only' : 'ok',

  setTextSize(size) {
    const prefs = { ...get().prefs, textSize: size };
    set({ prefs });
    persistPrefs(prefs);
  },

  setMotion(motion) {
    const prefs = { ...get().prefs, motion };
    set({ prefs });
    persistPrefs(prefs);
  },
}));

/** Applied at import, so the first paint already carries the learner's choice. */
applyAppearance(initial, documentRoot());
