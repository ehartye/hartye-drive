import { describe, expect, it } from 'vitest';
import {
  PREFERENCES_VERSION,
  buildExportBundle,
  classifyErasure,
  defaultPreferences,
  exportFilename,
  formatBytes,
  loadPreferences,
  motionLabel,
  serializePreferences,
  storageBytes,
  textSizeLabel,
  textSizeScale,
} from './settings';

describe('preferences', () => {
  it('default to the device’s own settings, changing nothing the learner did not ask for', () => {
    expect(defaultPreferences()).toEqual({
      schemaVersion: PREFERENCES_VERSION,
      textSize: 'standard',
      motion: 'system',
    });
  });

  it('round-trip through storage', () => {
    const prefs = { ...defaultPreferences(), textSize: 'larger' as const, motion: 'reduced' as const };
    const result = loadPreferences(serializePreferences(prefs));
    expect(result).toEqual({ status: 'ok', prefs });
  });

  it('read an absent key as “nothing chosen yet”, not as an error', () => {
    expect(loadPreferences(null).status).toBe('empty');
    expect(loadPreferences('').status).toBe('empty');
    expect(loadPreferences(null).prefs).toEqual(defaultPreferences());
  });

  it('fall back to the defaults on a payload that cannot be trusted', () => {
    for (const raw of ['{{{', '"a string"', '{"state":{"textSize":"enormous"}}', '{"version":1}']) {
      const result = loadPreferences(raw);
      expect(result.prefs).toEqual(defaultPreferences());
      expect(result.status).toBe('corrupt');
    }
  });

  it('refuse a payload written by a newer build rather than guessing at its shape', () => {
    const raw = JSON.stringify({ version: PREFERENCES_VERSION + 1, state: { textSize: 'large' } });
    expect(loadPreferences(raw).status).toBe('future');
    expect(loadPreferences(raw).prefs).toEqual(defaultPreferences());
  });

  it('name every setting in words, because a control with no reading is not a setting', () => {
    expect(textSizeLabel('standard')).toBe('Standard');
    expect(textSizeLabel('large')).toBe('Large');
    expect(textSizeLabel('larger')).toBe('Larger');
    expect(motionLabel('system')).toContain('device');
    expect(motionLabel('reduced')).toContain('Reduced');
  });

  it('scale reading text without ever shrinking it below the browser default', () => {
    expect(textSizeScale('standard')).toBe(1);
    expect(textSizeScale('large')).toBeGreaterThan(1);
    expect(textSizeScale('larger')).toBeGreaterThan(textSizeScale('large'));
  });
});

describe('classifyErasure', () => {
  it('is a success when every key is gone', () => {
    expect(
      classifyErasure([
        { key: 'a', threw: false, readBack: null },
        { key: 'b', threw: false, readBack: null },
      ]),
    ).toEqual({ ok: true, keys: ['a', 'b'] });
  });

  it('is a success when there was nothing to erase', () => {
    expect(classifyErasure([])).toEqual({ ok: true, keys: [] });
  });

  it('fails loudly when the browser refused the write', () => {
    const outcome = classifyErasure([
      { key: 'a', threw: false, readBack: null },
      { key: 'b', threw: true, readBack: '{"state":{}}' },
    ]);
    expect(outcome).toEqual({ ok: false, blocked: ['b'], reason: 'storage-refused' });
  });

  it('fails when the write was accepted but the data is still there', () => {
    // A read-only profile can swallow `removeItem` without error. Trusting the
    // absence of an exception is exactly how a build claims to have erased
    // something it did not.
    const outcome = classifyErasure([{ key: 'a', threw: false, readBack: '{"state":{}}' }]);
    expect(outcome).toEqual({ ok: false, blocked: ['a'], reason: 'storage-readonly' });
  });

  it('reports a refusal ahead of a silent survival when both happen', () => {
    const outcome = classifyErasure([
      { key: 'a', threw: false, readBack: 'still here' },
      { key: 'b', threw: true, readBack: null },
    ]);
    expect(outcome).toMatchObject({ ok: false, reason: 'storage-refused' });
    expect(outcome).toMatchObject({ blocked: ['a', 'b'] });
  });
});

describe('the export bundle', () => {
  const AT = Date.UTC(2026, 7, 11, 16, 12, 0);

  it('carries every record it was handed, parsed, under a versioned envelope', () => {
    const bundle = buildExportBundle(AT, [
      { key: 'tn-drive:progress', raw: '{"state":{"sessionsCompleted":3}}' },
      { key: 'tn-drive:exams', raw: null },
    ]);
    expect(bundle.app).toBe('tn-drive');
    expect(bundle.exportedAt).toBe(new Date(AT).toISOString());
    expect(bundle.records['tn-drive:progress']).toEqual({ state: { sessionsCompleted: 3 } });
    expect('tn-drive:exams' in bundle.records).toBe(false);
  });

  it('exports an unreadable payload as-is rather than dropping it', () => {
    const bundle = buildExportBundle(AT, [{ key: 'tn-drive:progress', raw: 'not json' }]);
    expect(bundle.records['tn-drive:progress']).toEqual({ unreadable: 'not json' });
  });

  it('names the file by the day it was taken', () => {
    expect(exportFilename(AT)).toBe('tn-drive-progress-2026-08-11.json');
  });
});

describe('the storage meter', () => {
  it('counts the bytes actually held, and nothing for an absent key', () => {
    expect(
      storageBytes([
        { key: 'a', raw: '12345' },
        { key: 'b', raw: null },
      ]),
    ).toBe(5);
  });

  it('reads bytes the way a person would', () => {
    expect(formatBytes(0)).toBe('0 KB');
    expect(formatBytes(900)).toBe('1 KB');
    expect(formatBytes(41_000)).toBe('40 KB');
    expect(formatBytes(2_500_000)).toBe('2.4 MB');
  });
});
