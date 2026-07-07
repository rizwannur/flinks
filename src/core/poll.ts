/**
 * The Flinks async pattern in one place.
 *
 * The heavy Connect/Enrich endpoints answer `202` with `OPERATION_PENDING`
 * while the bank is still being scraped. The documented recipe is: poll the
 * matching `*Async` endpoint every 10 seconds, giving up after 30 minutes.
 * `poll` implements exactly that so callers never hand-roll a retry loop.
 */

import type { FlinksResponseBase } from '../types/index.js';

export interface PollOptions {
  /** Delay between polls, in ms. Default 10_000 (Flinks' recommendation). */
  intervalMs?: number;
  /** Give up after this long, in ms. Default 1_800_000 (30 minutes). */
  timeoutMs?: number;
  /** Abort the wait early. */
  signal?: AbortSignal;
}

/** True while Flinks is still processing the request (HTTP 202). */
export const isPending = (response: Partial<FlinksResponseBase>): boolean =>
  response?.httpStatusCode === 202 || response?.flinksCode === 'OPERATION_PENDING';

const wait = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('Polling aborted'));
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new Error('Polling aborted'));
      },
      { once: true },
    );
  });

/**
 * Repeatedly invoke `fetchResult` until it stops returning a pending (202)
 * response, or the timeout elapses. Returns the first non-pending result.
 */
export async function poll<T extends Partial<FlinksResponseBase>>(
  fetchResult: () => Promise<T>,
  options: PollOptions = {},
): Promise<T> {
  const intervalMs = options.intervalMs ?? 10_000;
  const timeoutMs = options.timeoutMs ?? 1_800_000;
  const deadline = Date.now() + timeoutMs;

  let result = await fetchResult();
  while (isPending(result)) {
    if (Date.now() >= deadline) {
      throw new Error(
        `Flinks request still pending after ${Math.round(timeoutMs / 1000)}s — gave up polling.`,
      );
    }
    await wait(intervalMs, options.signal);
    result = await fetchResult();
  }
  return result;
}
