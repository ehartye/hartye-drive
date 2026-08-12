import { describe, expect, it } from 'vitest';
import { shouldOfferUpdate, updateOfferState } from './update';

const inputs = (over: Partial<Parameters<typeof shouldOfferUpdate>[0]> = {}) => ({
  waiting: false,
  examInProgress: false,
  dismissed: false,
  ...over,
});

describe('shouldOfferUpdate', () => {
  it('offers nothing when no build is waiting', () => {
    expect(shouldOfferUpdate(inputs())).toBe(false);
    expect(updateOfferState(inputs())).toBe('none');
  });

  it('offers a waiting build on a quiet screen', () => {
    expect(shouldOfferUpdate(inputs({ waiting: true }))).toBe(true);
    expect(updateOfferState(inputs({ waiting: true }))).toBe('offered');
  });

  it('never interrupts an exam in progress (practices F4)', () => {
    expect(shouldOfferUpdate(inputs({ waiting: true, examInProgress: true }))).toBe(false);
    expect(updateOfferState(inputs({ waiting: true, examInProgress: true }))).toBe('deferred');
  });

  it('re-offers the same build once the exam is over', () => {
    expect(shouldOfferUpdate(inputs({ waiting: true, examInProgress: false }))).toBe(true);
  });

  it('respects a dismissal, and reports it as a dismissal rather than absence', () => {
    expect(shouldOfferUpdate(inputs({ waiting: true, dismissed: true }))).toBe(false);
    expect(updateOfferState(inputs({ waiting: true, dismissed: true }))).toBe('dismissed');
  });

  it('treats an exam as the stronger reason to stay quiet', () => {
    expect(updateOfferState(inputs({ waiting: true, examInProgress: true, dismissed: true }))).toBe(
      'deferred',
    );
  });
});
