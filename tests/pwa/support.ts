import { readFileSync } from 'node:fs';
import { expect } from '@playwright/test';
import type { Page, Response } from '@playwright/test';

/**
 * Shared instrumentation for the production-build suite (`executable-floor.md`
 * X16–X23). Everything here is measurement, not assertion — each spec decides
 * what its numbers have to be.
 */

/* ------------------------------------------------------------ the question bank */

const bank = JSON.parse(
  readFileSync(new URL('../../src/content/questions.json', import.meta.url), 'utf8'),
) as { questions: { id: string; correctIndex: number }[] };

/** Keyed answers, so a spec can sit a real exam from the outside. */
export const CORRECT = new Map(bank.questions.map((q) => [q.id, q.correctIndex]));

/* -------------------------------------------------------------- service worker */

/**
 * The first visit a learner ever makes: one load, on the network, and nothing
 * else. It returns when the worker is activated **and** its precache is fully
 * written — the moment the app is genuinely on the device.
 *
 * Both conditions are needed. `registration.active.state === 'activated'` on
 * its own is observably reachable a beat before Cache Storage lists the
 * entries, and going offline in that window is a test flake rather than a
 * product defect.
 */
export async function primeServiceWorker(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration();
          return registration?.active?.state ?? 'none';
        }),
      { timeout: 60_000, message: 'the service worker never reached "activated"' },
    )
    .toBe('activated');

  // The build precaches 30-odd entries; a partial cache is not "installed",
  // and going offline against one is a test flake rather than a defect.
  await expect
    .poll(async () => (await precachedUrls(page)).length, {
      timeout: 60_000,
      message: 'the precache never filled',
    })
    .toBeGreaterThanOrEqual(30);
}

/** What the worker actually precached, read out of the running registration. */
export async function precachedUrls(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const names = await caches.keys();
    const urls: string[] = [];
    for (const name of names) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) urls.push(new URL(request.url).pathname);
    }
    return urls;
  });
}

/* -------------------------------------------------------------------- network */

export interface NetworkLog {
  /** Requests the browser could not complete. Offline, this is the failure set. */
  failed: string[];
  /**
   * Responses that did **not** come from the service worker — i.e. the ones
   * that genuinely went out to the network (X18).
   *
   * Only page-originated traffic is counted. The browser's own periodic
   * re-fetch of `sw.js` is not something the app issues and is not observable
   * on the page, which is the right boundary: X18 is about the app phoning
   * home, not about the browser maintaining its own registration.
   */
  fromNetwork: string[];
  /** Everything the page asked for, service worker or not. */
  all: string[];
  reset: () => void;
}

export function watchNetwork(page: Page): NetworkLog {
  const log: NetworkLog = {
    failed: [],
    fromNetwork: [],
    all: [],
    reset: () => {
      log.failed.length = 0;
      log.fromNetwork.length = 0;
      log.all.length = 0;
    },
  };

  page.on('requestfailed', (request) => {
    log.failed.push(`${request.method()} ${request.url()} — ${request.failure()?.errorText ?? ''}`);
  });
  page.on('response', (response: Response) => {
    const url = response.url();
    if (!/^https?:/.test(url)) return;
    log.all.push(url);
    if (!response.fromServiceWorker()) log.fromNetwork.push(url);
  });

  return log;
}

/* -------------------------------------------------------------------- console */

/** Every console error or warning, plus uncaught page errors (X22). */
export function watchConsole(page: Page): string[] {
  const noise: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      noise.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    noise.push(`pageerror: ${error.message}`);
  });
  return noise;
}

/* ----------------------------------------------------------------- exam driver */

/** Answers the exam question on screen and moves on. */
export async function answerExam(page: Page, correct: boolean): Promise<void> {
  const qid = (await page.locator('[data-qid]').getAttribute('data-qid')) ?? '';
  const right = CORRECT.get(qid) ?? 0;
  const options = await page.locator('.choice').count();
  const index = correct ? right : (right + 1) % options;
  await page.locator('.choice').nth(index).click();
  await expect(page.locator('.choice').nth(index)).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /Next question|Finish the exam/ }).click();
}
