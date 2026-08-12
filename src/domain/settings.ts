/**
 * Settings: reading preferences, the export bundle, and the one question a
 * destructive action must answer honestly — *did the erase actually happen?*
 *
 * Preferences get their own `localStorage` key and their own schema version,
 * separate from the study record. They are the one thing a learner should keep
 * when they reset their progress: erasing three weeks of work and also silently
 * resetting the text size of someone who needed it larger would be a second,
 * unasked-for loss.
 *
 * `classifyErasure` exists because "delete" is assumed to always succeed and
 * does not. A private window, a locked profile or a read-only volume can each
 * refuse the write — sometimes by throwing, sometimes by accepting the call and
 * changing nothing. Both are failures, and the difference between them is the
 * difference between an app that tells the truth about a learner's data and one
 * that reports success over an untouched record.
 *
 * Pure and DOM-free: every function takes strings, not a `Storage`.
 */

export const PREFERENCES_STORAGE_KEY = 'tn-drive:preferences';
export const PREFERENCES_VERSION = 1;

/** The storage a browser gives a single origin, as the settings page quotes it. */
export const STORAGE_BUDGET_BYTES = 5 * 1024 * 1024;

export type TextSize = 'standard' | 'large' | 'larger';
export type MotionSetting = 'system' | 'reduced';

export interface Preferences {
  schemaVersion: number;
  textSize: TextSize;
  motion: MotionSetting;
}

const TEXT_SIZES: readonly TextSize[] = ['standard', 'large', 'larger'];
const MOTION_SETTINGS: readonly MotionSetting[] = ['system', 'reduced'];

/** Multiplier on reading copy only. Never below 1 — nothing here shrinks text. */
const TEXT_SCALE: Record<TextSize, number> = {
  standard: 1,
  large: 1.125,
  larger: 1.25,
};

export function defaultPreferences(): Preferences {
  return { schemaVersion: PREFERENCES_VERSION, textSize: 'standard', motion: 'system' };
}

export function textSizeScale(size: TextSize): number {
  return TEXT_SCALE[size];
}

export function textSizeLabel(size: TextSize): string {
  switch (size) {
    case 'standard':
      return 'Standard';
    case 'large':
      return 'Large';
    case 'larger':
      return 'Larger';
  }
}

export function motionLabel(setting: MotionSetting): string {
  return setting === 'system'
    ? 'Following your device setting'
    : 'Reduced — nothing slides, fades or counts up';
}

/* ----------------------------------------------------------- load / save */

export type PreferencesStatus = 'empty' | 'ok' | 'corrupt' | 'future';

export interface PreferencesResult {
  status: PreferencesStatus;
  /** Always usable. The defaults when the stored value could not be trusted. */
  prefs: Preferences;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function serializePreferences(prefs: Preferences): string {
  return JSON.stringify({ state: prefs, version: PREFERENCES_VERSION });
}

export function loadPreferences(raw: string | null): PreferencesResult {
  if (raw === null || raw === '') return { status: 'empty', prefs: defaultPreferences() };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: 'corrupt', prefs: defaultPreferences() };
  }

  if (!isRecord(parsed) || !isRecord(parsed.state)) {
    return { status: 'corrupt', prefs: defaultPreferences() };
  }
  const version = typeof parsed.version === 'number' ? parsed.version : 0;
  if (version > PREFERENCES_VERSION) return { status: 'future', prefs: defaultPreferences() };

  const { textSize, motion } = parsed.state;
  if (
    typeof textSize !== 'string' ||
    !TEXT_SIZES.includes(textSize as TextSize) ||
    typeof motion !== 'string' ||
    !MOTION_SETTINGS.includes(motion as MotionSetting)
  ) {
    return { status: 'corrupt', prefs: defaultPreferences() };
  }

  return {
    status: 'ok',
    prefs: {
      schemaVersion: PREFERENCES_VERSION,
      textSize: textSize as TextSize,
      motion: motion as MotionSetting,
    },
  };
}

/* ------------------------------------------------------------- the erase */

export interface ErasureProbe {
  key: string;
  /** The removal itself raised. */
  threw: boolean;
  /** What is in the key *after* the removal. Anything but `null` is a failure. */
  readBack: string | null;
}

export type ResetOutcome =
  | { ok: true; keys: string[] }
  | { ok: false; blocked: string[]; reason: 'storage-refused' | 'storage-readonly' };

/**
 * The erase is judged by reading the keys back, not by the absence of an
 * exception. A read-only profile accepts `removeItem` and changes nothing —
 * trusting the call is exactly how a build reports success over data that is
 * still sitting there.
 */
export function classifyErasure(probes: readonly ErasureProbe[]): ResetOutcome {
  const blocked = probes.filter((probe) => probe.threw || probe.readBack !== null);
  if (blocked.length === 0) return { ok: true, keys: probes.map((probe) => probe.key) };
  return {
    ok: false,
    blocked: blocked.map((probe) => probe.key),
    reason: blocked.some((probe) => probe.threw) ? 'storage-refused' : 'storage-readonly',
  };
}

/* ------------------------------------------------------------ the export */

export interface StorageEntry {
  key: string;
  raw: string | null;
}

export interface ExportBundle {
  app: 'tn-drive';
  /** Format of this envelope, not of the records inside it. */
  format: number;
  exportedAt: string;
  records: Record<string, unknown>;
}

export const EXPORT_FORMAT = 1;

/**
 * One file holding every record, exactly as stored. Each record keeps its own
 * `version`, so a restore runs the same migrations a page load would — the
 * export is a copy of the store, not a second schema to maintain.
 */
export function buildExportBundle(at: number, entries: readonly StorageEntry[]): ExportBundle {
  const records: Record<string, unknown> = {};
  for (const entry of entries) {
    if (entry.raw === null || entry.raw === '') continue;
    try {
      records[entry.key] = JSON.parse(entry.raw);
    } catch {
      // Never dropped: an unreadable record is still the learner's, and it is
      // the one they will most want a copy of.
      records[entry.key] = { unreadable: entry.raw };
    }
  }
  return { app: 'tn-drive', format: EXPORT_FORMAT, exportedAt: new Date(at).toISOString(), records };
}

export function exportFilename(at: number): string {
  return `tn-drive-progress-${new Date(at).toISOString().slice(0, 10)}.json`;
}

/* ----------------------------------------------------------- the meter */

export function storageBytes(entries: readonly StorageEntry[]): number {
  return entries.reduce((sum, entry) => sum + (entry.raw?.length ?? 0), 0);
}

/** KB below a megabyte, one decimal above it. Never bytes — nobody reads bytes. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${String(Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
