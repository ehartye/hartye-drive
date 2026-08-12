/**
 * The dashboard's plumbing: loading the content pack, watching the connection,
 * and the platform question behind the install offer.
 *
 * Nothing here decides a number. Readiness, weakness, streaks and the route to
 * the test are all `src/domain/dashboard.ts`, so they are tested without a DOM;
 * this file only fetches, listens and formats.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { BlueprintArea } from '~/content';
import { useSettingsStore } from '~/store/settings';
import { STORAGE_KEY } from '~/domain/persistence';
import { EXAM_STORAGE_KEY } from '~/domain/exam-history';
import { SETUP_STORAGE_KEY } from '~/domain/setup';
import { SIGN_STORAGE_KEY } from '~/domain/sign-progress';

/* ------------------------------------------------------------ content pack */

export interface DrillQuestion {
  id: string;
  topic: string;
  area: BlueprintArea;
  signs?: readonly string[];
}

export interface TopicRef {
  id: string;
  area: BlueprintArea;
  label: string;
}

export interface ContentSummary {
  /** Every question, reduced to what the dashboard actually needs. */
  questions: DrillQuestion[];
  bankSize: number;
  officialCount: number;
  topicCounts: Readonly<Record<string, number>>;
  signCount: number;
  /** Registry ids, so the sign trainer record can be summarised over them. */
  signIds: string[];
  /** The taxonomy, carried alongside the bank so labels never need a second read. */
  topics: TopicRef[];
}

export type ContentState =
  | { status: 'loading' }
  | { status: 'ready'; content: ContentSummary }
  | { status: 'error'; detail: string };

/**
 * The bank and the sign registry, as their own chunks (they are excluded from
 * the initial JS budget on purpose — `src/content/index.ts`). Locally this
 * resolves in a few milliseconds, which is exactly why the skeleton below it
 * must not flash; the dashboard renders it only until this settles.
 */
export function useContent(): ContentState {
  const [state, setState] = useState<ContentState>({ status: 'loading' });

  useEffect(() => {
    let live = true;
    // The whole content module is imported dynamically — including the small
    // static JSON it carries — so `src/app/routes.tsx` stays loadable in plain
    // Node, which is what keeps the route-derived sweeps working. See the note
    // in `src/app/route-paths.ts`: a JSON import without `with { type: 'json' }`
    // anywhere the route table reaches breaks the e2e suite, not the app.
    import('~/content')
      .then(async (content) => {
        const [bank, registry] = await Promise.all([
          content.loadQuestionBank(),
          content.loadSignRegistry(),
        ]);
        return { bank, registry, topics: content.topics };
      })
      .then(({ bank, registry, topics }) => {
        if (!live) return;
        setState({
          status: 'ready',
          content: {
            questions: bank.questions.map((question) => ({
              id: question.id,
              topic: question.topic,
              area: question.area,
              ...(question.signs ? { signs: question.signs } : {}),
            })),
            bankSize: bank.counts.total,
            officialCount: bank.counts.official,
            topicCounts: bank.counts.byTopic,
            signCount: registry.signs.length,
            signIds: registry.signs.map((sign) => sign.id),
            topics: topics.map((topic) => ({ id: topic.id, area: topic.area, label: topic.label })),
          },
        });
      })
      .catch((error: unknown) => {
        if (!live) return;
        setState({
          status: 'error',
          detail:
            error instanceof Error ? error.message : 'The content pack could not be read.',
        });
      });
    return () => {
      live = false;
    };
  }, []);

  return state;
}

/* ------------------------------------------------------------- connection */

/** `navigator.onLine`, kept current. The badge and the offline strip read it. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const up = () => {
      setOnline(true);
    };
    const down = () => {
      setOnline(false);
    };
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  return online;
}

/* ---------------------------------------------------------- install offer */

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const isInstallPromptEvent = (event: Event): event is InstallPromptEvent =>
  'prompt' in event && typeof (event as InstallPromptEvent).prompt === 'function';

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  // iOS Safari's own flag, which is not in lib.dom.
  const legacy: unknown = (navigator as unknown as Record<string, unknown>).standalone;
  return legacy === true;
}

function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
  return iOS && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

/**
 * `none` · `prompt` (a browser handed us a real install event) · `ios` (Safari
 * fires no such event and exposes no install API, so the honest affordance is
 * the three taps, not a button that cannot work — grounding §1).
 */
export type InstallOffer = 'none' | 'prompt' | 'ios';

export interface InstallState {
  offer: InstallOffer;
  install: () => void;
  dismiss: () => void;
}

/**
 * The captured prompt is module state, not component state.
 *
 * `beforeinstallprompt` fires **once**, early, and only ever once — so a hook
 * that starts listening when its component mounts sees it only if that
 * component happened to be on screen at the time. With the affordance on two
 * surfaces (the dashboard and settings) that made the offer appear or vanish
 * depending on which screen the learner opened first. Captured once at module
 * load and published to every subscriber, both screens agree.
 */
let captured: InstallPromptEvent | null = null;
let installedAlready = false;
const watchers = new Set<() => void>();

const notify = (): void => {
  for (const watcher of watchers) watcher();
};

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (raw: Event) => {
    // Holding the event is what lets the app choose the moment (practices F6).
    raw.preventDefault();
    if (!isInstallPromptEvent(raw)) return;
    captured = raw;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    installedAlready = true;
    captured = null;
    notify();
  });
}

function subscribeToInstall(onChange: () => void): () => void {
  watchers.add(onChange);
  return () => {
    watchers.delete(onChange);
  };
}

/** A primitive, so `useSyncExternalStore` never sees a new object each read. */
function platformOffer(): InstallOffer {
  if (installedAlready || isStandalone()) return 'none';
  if (captured) return 'prompt';
  return isIosSafari() ? 'ios' : 'none';
}

export function useInstallOffer(): InstallState {
  const platform = useSyncExternalStore(subscribeToInstall, platformOffer, () => 'none' as const);
  const dismissed = useSettingsStore((s) => s.prefs.installDismissed);
  const setDismissed = useSettingsStore((s) => s.setInstallDismissed);

  return {
    offer: dismissed ? 'none' : platform,
    install: () => {
      if (!captured) return;
      void captured.prompt();
      setDismissed(true);
    },
    dismiss: () => {
      setDismissed(true);
    },
  };
}

/* --------------------------------------------------------- raw payloads */

/** Every key the app owns. Read only for the diagnostic export. */
export const OWNED_KEYS = [
  STORAGE_KEY,
  EXAM_STORAGE_KEY,
  SIGN_STORAGE_KEY,
  SETUP_STORAGE_KEY,
] as const;

/** Never throws: the whole point is that it runs when storage is misbehaving. */
export function readRaw(key: string): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------- formatting */

const DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const TIME = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

/** `Sep 12, 2026` from an ISO day, in the learner's own calendar. */
export function formatDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return DATE.format(new Date(y ?? 0, (m ?? 1) - 1, d ?? 1));
}

/** `Sep 12, 2026 · 21:14` from an epoch stamp. */
export function formatStamp(at: number): string {
  const date = new Date(at);
  return `${DATE.format(date)} · ${TIME.format(date)}`;
}

/** `test Sep 12` for the app bar's context line, or the goal on its own. */
export function contextLine(goalLabel: string, testDate: string | null, suffix?: string): string {
  const parts = [goalLabel];
  if (testDate) parts.push(`test ${formatDay(testDate).replace(/, \d{4}$/, '')}`);
  if (suffix) parts.push(suffix);
  return parts.join(' · ');
}
