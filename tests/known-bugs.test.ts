/**
 * Regression tests for defects found during the production-readiness audit.
 *
 * Most were fixed and are asserted as normal `it` tests below. Any remaining
 * `it.fails` documents a known, deliberately-unfixed edge case — if it ever gets
 * fixed, the `it.fails` starts FAILING as a reminder to flip it back to `it`.
 */
import { describe, expect, it, vi } from 'vitest';
import { HttpClient } from '../src/core/http.js';
import { FlinksClient } from '../src/index.js';
import { FlinksError, FlinksTimeoutError } from '../src/core/errors.js';
import { toCamelCase } from '../src/core/case.js';

const json = (status: number, body: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const http = (fetchMock: ReturnType<typeof vi.fn>, timeoutMs?: number) =>
  new HttpClient({
    baseUrl: 'https://x.test',
    auth: { type: 'none' },
    maxRetries: 0,
    timeoutMs,
    fetch: fetchMock as unknown as typeof fetch,
  });

const client = (fetchMock: ReturnType<typeof vi.fn>) =>
  new FlinksClient({
    instance: 'toolbox',
    customerId: 'c',
    secretKey: 's',
    xApiKey: 'k',
    fetch: fetchMock as unknown as typeof fetch,
  });

describe('audit regressions (fixed)', () => {
  // A 200 whose body isn't valid JSON must raise, not silently return the raw
  // string cast to T. src/core/http.ts handleResponse.
  it('a non-JSON 200 body raises instead of returning a string', async () => {
    const c = http(vi.fn(async () => new Response('<html>oops', { status: 200 })));
    await expect(
      c.request({ method: 'GET', path: '/a', endpoint: 'e' }),
    ).rejects.toBeInstanceOf(FlinksError);
  });

  // An undefined path param throws before any fetch, rather than requesting the
  // literal path `/GetAccountsSummaryAsync/undefined`. src/core/params.ts.
  it('an undefined requestId throws and never fetches', () => {
    const fetchMock = vi.fn(async () => json(200, { HttpStatusCode: 200 }));
    const flinks = client(fetchMock);
    expect(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      flinks.connect.getAccountsSummaryAsync(undefined as any),
    ).toThrow(/required/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Path params are percent-encoded, so `/` and `?` can't break routing or
  // inject a query string. src/core/params.ts.
  it('path params are URL-encoded', async () => {
    const fetchMock = vi.fn(async () => json(200, { HttpStatusCode: 200 }));
    const flinks = client(fetchMock);
    await flinks.connect.getMfaQuestions('a/b?x=1');
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toContain('a%2Fb%3Fx%3D1');
  });

  // Leading acronyms camelCase cleanly (`HTTPStatusCode` → `httpStatusCode`,
  // `IBAN` → `iban`). src/core/case.ts.
  it('leading acronyms camelCase cleanly', () => {
    expect(toCamelCase({ HTTPStatusCode: 1 })).toEqual({ httpStatusCode: 1 });
    expect(toCamelCase({ IBAN: 'x' })).toEqual({ iban: 'x' });
  });

  // A request timeout surfaces as a typed FlinksTimeoutError, distinct from a
  // caller cancellation. src/core/http.ts + errors.ts.
  it('a timeout surfaces as a typed FlinksTimeoutError', async () => {
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise((_res, rej) => {
          init.signal?.addEventListener('abort', () =>
            rej(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    const c = http(fetchMock, 15);
    const err: unknown = await c
      .request({ method: 'GET', path: '/a', endpoint: 'e' })
      .catch((e) => e);
    expect(err).toBeInstanceOf(FlinksTimeoutError);
  });
});

describe('known edge cases (it.fails = still deliberately unfixed)', () => {
  // Camel/pascal key collision drops data — { LoginId, loginId } → 1 key. Left
  // as-is: the real Flinks API never sends both casings, and any resolution is
  // arbitrary. Documented rather than fixed.
  it.fails('colliding cased keys still collapse to one', () => {
    const out = toCamelCase({ LoginId: 'a', loginId: 'b' });
    expect(Object.keys(out as object)).toHaveLength(2);
  });
});
