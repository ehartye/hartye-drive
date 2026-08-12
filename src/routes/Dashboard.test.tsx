import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { STORAGE_KEY, serializeProgress } from '~/domain/persistence';
import { SETUP_STORAGE_KEY, completeSetup, emptySetup, serializeSetup } from '~/domain/setup';
import { emptyProgress, recordAttempt } from '~/domain/progress';
import type { StudyProgress } from '~/domain/progress';

/**
 * The dashboard's states, driven the way a critic drives them: by putting real
 * bytes in `localStorage` and letting the real stores read them. The stores are
 * module singletons that rehydrate on import, so every case resets the module
 * registry first — otherwise the second test in a file would be reading the
 * first one's record.
 */
async function mount(path = '/study') {
  vi.resetModules();
  const { routes } = await import('~/app/routes');
  return render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
}

function seedSetup(): void {
  localStorage.setItem(
    SETUP_STORAGE_KEY,
    serializeSetup(
      completeSetup(emptySetup(), { goal: 'class-d', testDate: '2026-09-12', at: Date.now() }),
    ),
  );
}

function answered(rows: [string, string, boolean][]): StudyProgress {
  const now = Date.now();
  return rows.reduce(
    (state, [id, topic, correct]) =>
      recordAttempt(state, {
        questionId: id,
        topic,
        area: 'rules-of-road',
        chosenIndex: 0,
        correct,
        at: now,
      }).state,
    emptyProgress(),
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('first run (matrix cell 1)', () => {
  it('asks the two questions that change what the app does, and promises the rest', async () => {
    await mount();
    expect(
      await screen.findByRole('heading', { level: 1, name: /Pass the.*knowledge test/s }),
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Class D knowledge test/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Signs refresher/ })).toBeInTheDocument();
    // The date is optional and is a DateField, never a raw <input type="date">.
    expect(screen.getByLabelText('Month')).toBeInTheDocument();
    expect(screen.getByLabelText('Day')).toBeInTheDocument();
    expect(screen.getByLabelText('Year')).toBeInTheDocument();
    expect(document.querySelector('input[type="date"]')).toBeNull();
    expect(screen.getByText('No account, ever')).toBeInTheDocument();
    expect(screen.getByText('Works with no signal')).toBeInTheDocument();
    expect(screen.getByText('Nothing leaves this phone')).toBeInTheDocument();
  });

  it('states a daily pace once a test date is given, and never schedules anything', async () => {
    const user = userEvent.setup();
    await mount();
    await screen.findByRole('heading', { level: 1 });

    const year = new Date().getFullYear() + 1;
    await user.type(screen.getByLabelText('Month'), '09');
    await user.type(screen.getByLabelText('Day'), '12');
    await user.type(screen.getByLabelText('Year'), String(year));

    expect(await screen.findByText(/questions a day/)).toBeInTheDocument();
  });

  it('hands over to the dashboard once answered, and remembers the answers', async () => {
    const user = userEvent.setup();
    await mount();
    await screen.findByRole('heading', { level: 1 });
    await user.click(screen.getByRole('button', { name: /Start studying/ }));

    expect(await screen.findByRole('heading', { level: 1, name: /first mile/i })).toBeInTheDocument();
    expect(localStorage.getItem(SETUP_STORAGE_KEY)).toContain('completedAt');
  });
});

describe('the dashboard, empty (matrix cell 2-empty)', () => {
  it('reads as an invitation, with the guide sign honestly zeroed', async () => {
    seedSetup();
    await mount();

    expect(await screen.findByRole('heading', { level: 1, name: /first mile/i })).toBeInTheDocument();

    const route = screen.getByRole('region', { name: /Route to your test/i });
    expect(within(route).getByText('Practice questions')).toBeInTheDocument();
    expect(within(route).getByText(/OF 506/)).toBeInTheDocument();

    expect(screen.getByRole('link', { name: /Answer your first question/ })).toHaveAttribute(
      'href',
      '/study/session',
    );
    // Structure survives with nothing measured: one topic per blueprint area.
    expect(screen.getAllByText(/questions · not measured/)).toHaveLength(4);
    expect(screen.getByText(/Today starts it/)).toBeInTheDocument();
  });
});

describe('the dashboard, populated (matrix cell 2)', () => {
  it('derives readiness, weak topics and the streak from the real record', async () => {
    seedSetup();
    const progress = answered([
      ['rot-001', 'right-of-way', true],
      ['rot-002', 'right-of-way', false],
      ['rot-003', 'right-of-way', false],
      ['rot-004', 'right-of-way', false],
      ...(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((n) => [
        `spd-${n}`,
        'speed-limits',
        true,
      ]) as [string, string, boolean][]),
    ]);
    localStorage.setItem(STORAGE_KEY, serializeProgress(progress));
    await mount();

    // 9 of 12 right = 75%: the same figure `overallAccuracy` reports.
    expect(await screen.findByText(/Readiness 75 percent/)).toBeInTheDocument();
    expect(document.querySelector('.speedplate strong')?.textContent).toBe('75');

    // right-of-way is 1 of 4; speed-limits is 4 of 4 and must not be listed.
    const weak = document.querySelectorAll('.weakrow');
    expect(weak).toHaveLength(1);
    expect(weak[0]?.textContent).toContain('Right-of-way');
    expect(weak[0]?.textContent).toContain('1 of 4 correct');
    expect(weak[0]?.getAttribute('href')).toContain('/study/session?q=');

    expect(screen.getByRole('link', { name: /Continue studying/ })).toBeInTheDocument();
    expect(screen.getByText(/1 topic is still holding you back/)).toBeInTheDocument();
    expect(screen.getByText(/longest run yet/)).toBeInTheDocument();
  });

  it('withholds the mock-exam recommendation below the readiness gate, without locking it', async () => {
    seedSetup();
    localStorage.setItem(
      STORAGE_KEY,
      serializeProgress(
        answered([
          ['rot-001', 'right-of-way', true],
          ['rot-002', 'right-of-way', false],
        ]),
      ),
    );
    await mount();

    expect(await screen.findByText(/Not yet recommended/)).toBeInTheDocument();
    // Withheld, never blocked: the way in is still a real link.
    expect(screen.getByRole('link', { name: /Take it anyway/ })).toHaveAttribute('href', '/exam');
  });
});

describe('the dashboard, saved record unreadable (matrix cell 2-error)', () => {
  it('lands on a recoverable screen for garbage, and does not overwrite the file (X19)', async () => {
    seedSetup();
    localStorage.setItem(STORAGE_KEY, '{"garbage":true');
    await mount();

    expect(
      await screen.findByRole('heading', { level: 1, name: /can’t be read|can't be read/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export a diagnostic file/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Study without saving/ })).toBeInTheDocument();
    // The promise the screen makes in words, kept in code.
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{"garbage":true');
  });

  it('refuses to guess at a future schema version, and says which one it found (X20)', async () => {
    seedSetup();
    const payload = JSON.stringify({ version: 99, state: { attempts: [{ at: 1 }, { at: 2 }] } });
    localStorage.setItem(STORAGE_KEY, payload);
    await mount();

    await screen.findByRole('heading', { level: 1, name: /can’t be read|can't be read/ });
    expect(screen.getByText('schema 99')).toBeInTheDocument();
    expect(screen.getByText(/newer version of TN Drive/)).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(payload);
  });

  it('gates the destructive reset, then clears the file and starts clean', async () => {
    const user = userEvent.setup();
    seedSetup();
    localStorage.setItem(STORAGE_KEY, '{"garbage":true');
    await mount();
    await screen.findByRole('heading', { level: 1, name: /can’t be read|can't be read/ });

    const reset = screen.getByRole('button', { name: /Reset saved progress/ });
    expect(reset).toHaveAttribute('aria-disabled', 'true');
    await user.click(reset);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{"garbage":true');

    await user.click(screen.getByRole('checkbox'));
    await user.click(reset);
    expect(localStorage.getItem(STORAGE_KEY)).not.toBe('{"garbage":true');
    expect(await screen.findByRole('heading', { level: 1, name: /first mile/i })).toBeInTheDocument();
  });
});

describe('storage blocked on first run (matrix cell 1-error, X21)', () => {
  it('offers session-only mode, says what it costs, and is never a dead end', async () => {
    const user = userEvent.setup();
    const setItem = Storage.prototype.setItem.bind(localStorage);
    Storage.prototype.setItem = () => {
      throw new DOMException('QuotaExceededError');
    };
    try {
      await mount();
      expect(
        await screen.findByRole('heading', { level: 1, name: /won’t let the app save|won't let the app save/ }),
      ).toBeInTheDocument();
      expect(screen.getByText('Session-only mode drops')).toBeInTheDocument();
      expect(screen.getByText('Everything else still works')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Check storage again/ })).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /Continue in session-only mode/ }));
      expect(await screen.findByRole('heading', { level: 1, name: /first mile/i })).toBeInTheDocument();
      expect(screen.getByText(/Session-only mode/)).toBeInTheDocument();
    } finally {
      Storage.prototype.setItem = setItem;
    }
  });
});
