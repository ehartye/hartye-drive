/**
 * What the app can say about a saved record it has refused to read.
 *
 * When a payload is corrupt, or was written by a build that does not exist
 * here yet, the honest screen is not "something went wrong" — it is the two
 * version numbers, the size, the count and the date, so the learner can tell
 * whether the thing on their device is worth rescuing. Everything in this file
 * is best-effort by design: it runs precisely when the strict loader has
 * already given up, so it must never throw and never assume a shape.
 *
 * The exported diagnostic is a **local file**. Nothing here transmits anything;
 * it exists so a learner can keep a copy before pressing a destructive button.
 */

/** The `localStorage` ceiling browsers converge on. Used only for stating size. */
export const STORAGE_BUDGET_BYTES = 5 * 1024 * 1024;

export interface PayloadReport {
  key: string;
  present: boolean;
  bytes: number;
  /** Envelope version, `0` when unversioned, `null` when unreadable. */
  version: number | null;
  /** Attempts held in the payload, `null` when unreadable. */
  records: number | null;
  lastWrittenAt: number | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

function byteLength(raw: string): number {
  return new TextEncoder().encode(raw).length;
}

/** Reads what it can out of a payload the strict loader rejected. Never throws. */
export function inspectPayload(key: string, raw: string | null): PayloadReport {
  if (raw === null || raw === '') {
    return { key, present: false, bytes: 0, version: null, records: null, lastWrittenAt: null };
  }

  const base = { key, present: true, bytes: byteLength(raw) };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...base, version: null, records: null, lastWrittenAt: null };
  }

  if (!isRecord(parsed) || !isRecord(parsed.state)) {
    return { ...base, version: null, records: null, lastWrittenAt: null };
  }

  const state = parsed.state;
  const attempts = Array.isArray(state.attempts) ? state.attempts : null;
  const stamps = (attempts ?? [])
    .map((attempt) => (isRecord(attempt) && isNumber(attempt.at) ? attempt.at : 0))
    .filter((at) => at > 0);

  const lastWrittenAt = isNumber(state.lastStudiedAt)
    ? state.lastStudiedAt
    : stamps.length > 0
      ? Math.max(...stamps)
      : null;

  return {
    ...base,
    version: isNumber(parsed.version) ? parsed.version : 0,
    records: attempts ? attempts.length : null,
    lastWrittenAt,
  };
}

export interface DiagnosticInput {
  at: number;
  /** The highest schema version this build can read, per key. */
  readsUpTo: Readonly<Record<string, number>>;
  /** The raw payloads, exactly as they sit on the device. */
  payloads: Readonly<Record<string, string | null>>;
}

/**
 * The file the "export a diagnostic" button saves. It is deliberately the raw
 * payloads plus the version numbers — enough to recover the record by hand, and
 * containing nothing the app did not already have, because the app has no
 * account, no identifiers and no telemetry to put in it.
 */
export function buildDiagnostic({ at, readsUpTo, payloads }: DiagnosticInput): string {
  return JSON.stringify(
    {
      app: 'TN Drive — Tennessee Class D study app',
      note: 'Saved on this device only. Nothing was uploaded.',
      exportedAt: new Date(at).toISOString(),
      readsUpTo,
      keys: Object.entries(payloads).map(([key, raw]) => ({
        key,
        bytes: raw === null ? 0 : byteLength(raw),
        raw,
      })),
    },
    null,
    2,
  );
}

export function diagnosticFileName(at: number): string {
  const date = new Date(at);
  const stamp = `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return `tn-drive-diagnostic-${stamp}.json`;
}

/** "212 KB" · "3.1 MB". Sizes a phone would state, never raw byte counts. */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${String(Math.max(1, Math.round(bytes / 1024)))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
