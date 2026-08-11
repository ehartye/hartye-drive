import { describe, it, expect } from 'vitest';
import { masteryBand, masteryPercent, bandLabel, formatClock } from './mastery';

describe('masteryPercent', () => {
  it('rounds to a whole percent', () => {
    expect(masteryPercent(1, 3)).toBe(33);
    expect(masteryPercent(2, 3)).toBe(67);
  });

  it('reports 0 for an untouched topic rather than dividing by zero', () => {
    expect(masteryPercent(0, 0)).toBe(0);
  });

  it('clamps out-of-range input instead of trusting the caller', () => {
    expect(masteryPercent(5, 3)).toBe(100);
    expect(masteryPercent(-1, 3)).toBe(0);
  });
});

describe('masteryBand — the TopicMeter threshold contract (grounding §3)', () => {
  it('is guide green at 80 and above', () => {
    expect(masteryBand(80)).toBe('guide');
    expect(masteryBand(100)).toBe('guide');
  });

  it('is warning yellow from 50 through 79', () => {
    expect(masteryBand(50)).toBe('warn');
    expect(masteryBand(79)).toBe('warn');
  });

  it('is regulatory red below 50', () => {
    expect(masteryBand(49)).toBe('stop');
    expect(masteryBand(0)).toBe('stop');
  });

  it('treats the boundaries as inclusive-below, so 79.9 is not yet passing', () => {
    expect(masteryBand(79.9)).toBe('warn');
    expect(masteryBand(49.9)).toBe('stop');
  });
});

describe('bandLabel — colour is never the sole carrier (grounding §5)', () => {
  it('gives every band a word', () => {
    expect(bandLabel('guide')).toBe('Solid');
    expect(bandLabel('warn')).toBe('Review');
    expect(bandLabel('stop')).toBe('Weak');
  });
});

describe('formatClock', () => {
  it('formats as mm:ss with tabular-friendly padding', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(59)).toBe('00:59');
    expect(formatClock(600)).toBe('10:00');
    expect(formatClock(3599)).toBe('59:59');
  });

  it('rolls past an hour without losing minutes', () => {
    expect(formatClock(3600)).toBe('60:00');
  });

  it('never renders a negative clock', () => {
    expect(formatClock(-5)).toBe('00:00');
  });

  it('truncates fractional seconds rather than showing 60', () => {
    expect(formatClock(59.9)).toBe('00:59');
  });
});
