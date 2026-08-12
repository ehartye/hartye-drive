import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UpdatePrompt } from './UpdatePrompt';

describe('UpdatePrompt', () => {
  it('says nothing when no build is waiting', () => {
    render(<UpdatePrompt waiting={false} examInProgress={false} onUpdate={() => undefined} />);
    expect(screen.queryByText('A newer version is ready')).not.toBeInTheDocument();
  });

  it('offers the waiting build, and only acts when the learner asks', async () => {
    const onUpdate = vi.fn();
    render(<UpdatePrompt waiting examInProgress={false} onUpdate={onUpdate} />);

    expect(screen.getByText('A newer version is ready')).toBeInTheDocument();
    // Polite, not assertive: nothing here interrupts a screen reader mid-sentence.
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    expect(onUpdate).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Update now' }));
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('stays silent while an exam attempt is on the device (practices F4)', () => {
    render(<UpdatePrompt waiting examInProgress onUpdate={() => undefined} />);
    expect(screen.queryByText('A newer version is ready')).not.toBeInTheDocument();
  });

  it('respects a dismissal for the rest of the visit', async () => {
    render(<UpdatePrompt waiting examInProgress={false} onUpdate={() => undefined} />);
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('A newer version is ready')).not.toBeInTheDocument();
  });
});
