import { describe, it, expect } from 'vitest';
import {
  STORAGE_BUDGET_BYTES,
  buildDiagnostic,
  diagnosticFileName,
  formatBytes,
  inspectPayload,
} from './diagnostics';

const AT = new Date(2026, 7, 9, 21, 14, 0).getTime();

describe('inspecting a payload that could not be read', () => {
  it('reports an absent key as absent rather than as damage', () => {
    const report = inspectPayload('tn-drive:progress', null);
    expect(report).toMatchObject({ present: false, bytes: 0, version: null, records: null });
  });

  it('reads the version, the record count and the last write out of a good payload', () => {
    const raw = JSON.stringify({
      version: 7,
      state: { attempts: [{ at: AT - 1000 }, { at: AT }], lastStudiedAt: AT },
    });
    const report = inspectPayload('tn-drive:progress', raw);
    expect(report.present).toBe(true);
    expect(report.version).toBe(7);
    expect(report.records).toBe(2);
    expect(report.lastWrittenAt).toBe(AT);
    expect(report.bytes).toBe(raw.length);
  });

  it('still measures a payload it cannot parse — size is the one fact left', () => {
    const report = inspectPayload('tn-drive:progress', '{"garbage":true');
    expect(report.present).toBe(true);
    expect(report.bytes).toBeGreaterThan(0);
    expect(report.version).toBeNull();
    expect(report.records).toBeNull();
    expect(report.lastWrittenAt).toBeNull();
  });

  it('treats an unversioned envelope as version 0, the way the loader does', () => {
    const report = inspectPayload('tn-drive:exams', JSON.stringify({ state: { attempts: [] } }));
    expect(report.version).toBe(0);
    expect(report.records).toBe(0);
  });

  it('ignores an attempt with no usable timestamp instead of inventing one', () => {
    const raw = JSON.stringify({ version: 1, state: { attempts: ['nonsense', { at: 'soon' }] } });
    const report = inspectPayload('tn-drive:progress', raw);
    expect(report.records).toBe(2);
    expect(report.lastWrittenAt).toBeNull();
  });

  it('does not guess at a shape it does not recognise', () => {
    const report = inspectPayload('tn-drive:progress', JSON.stringify([1, 2, 3]));
    expect(report.version).toBeNull();
    expect(report.records).toBeNull();
  });

  it('falls back to the newest attempt when there is no last-written stamp', () => {
    const raw = JSON.stringify({ version: 1, state: { attempts: [{ at: 10 }, { at: 40 }] } });
    expect(inspectPayload('tn-drive:progress', raw).lastWrittenAt).toBe(40);
  });
});

describe('the diagnostic file', () => {
  it('carries the payloads and the version the app can read, and nothing else', () => {
    const json = buildDiagnostic({
      at: AT,
      readsUpTo: { 'tn-drive:progress': 1 },
      payloads: { 'tn-drive:progress': '{"version":7}' },
    });
    const parsed = JSON.parse(json) as {
      app: string;
      exportedAt: string;
      readsUpTo: Record<string, number>;
      keys: { key: string; bytes: number; raw: string }[];
    };
    expect(parsed.app).toContain('TN Drive');
    expect(parsed.exportedAt).toBe(new Date(AT).toISOString());
    expect(parsed.readsUpTo['tn-drive:progress']).toBe(1);
    expect(parsed.keys[0]?.key).toBe('tn-drive:progress');
    expect(parsed.keys[0]?.raw).toBe('{"version":7}');
    expect(JSON.stringify(parsed)).not.toContain('probe');
  });

  it('records an absent key as absent rather than dropping it from the file', () => {
    const parsed = JSON.parse(
      buildDiagnostic({ at: AT, readsUpTo: {}, payloads: { 'tn-drive:exams': null } }),
    ) as { keys: { key: string; bytes: number; raw: string | null }[] };
    expect(parsed.keys[0]).toEqual({ key: 'tn-drive:exams', bytes: 0, raw: null });
  });

  it('is named per day, so two exports do not overwrite each other silently', () => {
    expect(diagnosticFileName(AT)).toBe('tn-drive-diagnostic-2026-08-09.json');
  });
});

describe('sizes, stated the way a phone states them', () => {
  it('rounds honestly at each step', () => {
    expect(formatBytes(0)).toBe('0 KB');
    expect(formatBytes(512)).toBe('1 KB');
    expect(formatBytes(217_088)).toBe('212 KB');
    expect(formatBytes(3_250_586)).toBe('3.1 MB');
  });

  it('knows the quota it is measuring against', () => {
    expect(formatBytes(STORAGE_BUDGET_BYTES)).toBe('5.0 MB');
  });
});
