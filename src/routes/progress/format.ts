/**
 * Dates and durations as a learner would say them.
 *
 * Locale is pinned to `en-US`: the test is administered in English by the State
 * of Tennessee, internationalization is a ratified exclusion, and an unpinned
 * locale would make every screenshot and every assertion depend on the machine
 * running it.
 */

const DAY_MS = 86_400_000;

const startOfDay = (at: number): number => {
  const date = new Date(at);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

/** `26 May` — the axis label and the month divider. */
export function formatDay(at: number): string {
  return new Date(at).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

/** `August 2026` — the history's month headings. */
export function formatMonth(at: number): string {
  return new Date(at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/** Sortable and stable, so month grouping never depends on the display string. */
export function monthKey(at: number): string {
  const date = new Date(at);
  return `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

const time = (at: number): string =>
  new Date(at)
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    .toLowerCase();

/**
 * `Today, 4:12 pm` · `Yesterday, 9:34 pm` · `28 Jul, 6:02 pm`. Today and
 * yesterday are named rather than dated, because that is how the learner holds
 * them — everything older gets its date back.
 */
export function formatWhen(at: number, now: number): string {
  const days = Math.round((startOfDay(now) - startOfDay(at)) / DAY_MS);
  if (days === 0) return `Today, ${time(at)}`;
  if (days === 1) return `Yesterday, ${time(at)}`;
  return `${formatDay(at)}, ${time(at)}`;
}

/** `6:20` — a sitting's length. Hours only appear when there are hours. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
  return `${hours > 0 ? `${String(hours)}:` : ''}${mm}:${String(seconds).padStart(2, '0')}`;
}

/** `1 July 2022` — the manual's own currency date, written out. */
export function formatFullDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
