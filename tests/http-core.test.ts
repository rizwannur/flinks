import { describe, expect, it, vi } from 'vitest';
import { HttpClient, type HttpMethod } from '../src/core/http.js';
import { FlinksError } from '../src/core/errors.js';

const makeClient = (
  fetchImpl: typeof fetch,
  extra: Partial<{ timeoutMs: number; maxRetries: number }> = {},
) =>
  new HttpClient({
    baseUrl: 'https://x.test',
    auth: { type: 'none' },
    maxRetries: 1,
    ...extra,
    fetch: fetchImpl,
  });

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

const req = (method: HttpMethod, over: Partial<Parameters<HttpClient['request']>[0]> = {}) =>
  ({ method, path: '/a', endpoint: 'ep', ...over }) as Parameters<HttpClient['request']>[0];

describe('http core — success bodies', () => {
  it('returns undefined for an empty 204 response', async () => {
    const c = makeClient(vi.fn(async () => json(204, undefined)) as unknown as typeof fetch);
    await expect(c.request(req('GET'))).resolves.toBeUndefined();
  });

  it('camelCases a JSON success body', async () => {
    const c = makeClient(
      vi.fn(async () => json(200, { RequestId: 'r', Nested: { AccountId: '1' } })) as unknown as typeof fetch,
    );
    await expect(c.request(req('GET'))).resolves.toEqual({ requestId: 'r', nested: { accountId: '1' } });
  });

  it('returns the raw body verbatim when transformResponse is false', async () => {
    const c = makeClient(vi.fn(async () => json(200, { RequestId: 'r' })) as unknown as typeof fetch);
    await expect(c.request(req('GET', { transformResponse: false }))).resolves.toEqual({ RequestId: 'r' });
  });

  it('raises on a non-JSON 200 body instead of returning a raw string', async () => {
    // A truncated / HTML 200 (proxy error page, gateway hiccup) must throw rather
    // than become a string cast to T, which would silently corrupt caller data.
    const c = makeClient(
      vi.fn(async () => new Response('<html>truncated', { status: 200 })) as unknown as typeof fetch,
    );
    const err: unknown = await c.request(req('GET')).catch((e) => e);
    expect(err).toBeInstanceOf(FlinksError);
    expect((err as FlinksError).flinksMessage).toMatch(/non-JSON/i);
  });
});

describe('http core — error bodies', () => {
  it('maps a 4xx JSON body to a FlinksError with code + status + message', async () => {
    const c = makeClient(
      vi.fn(async () =>
        json(401, { HttpStatusCode: 401, FlinksCode: 'INVALID_LOGIN', Message: 'nope' }),
      ) as unknown as typeof fetch,
    );
    await expect(c.request(req('POST', { body: { a: 1 } }))).rejects.toMatchObject({
      name: 'FlinksError',
      httpStatusCode: 401,
      flinksCode: 'INVALID_LOGIN',
      flinksMessage: 'nope',
    });
  });

  it('uses the HTTP status when the error body omits HttpStatusCode', async () => {
    const c = makeClient(
      vi.fn(async () => json(403, { FlinksCode: 'UNAUTHORIZED' })) as unknown as typeof fetch,
    );
    await expect(c.request(req('POST', { body: {} }))).rejects.toMatchObject({ httpStatusCode: 403 });
  });

  it('folds a non-JSON error body into flinksMessage', async () => {
    const c = makeClient(
      vi.fn(async () => new Response('<html>bad gateway</html>', { status: 502 })) as unknown as typeof fetch,
    );
    // POST is not retried on 5xx, so this surfaces immediately.
    await expect(c.request(req('POST', { body: {} }))).rejects.toMatchObject({
      httpStatusCode: 502,
      flinksMessage: '<html>bad gateway</html>',
    });
  });

  it('preserves the full raw body (incl. RequestId) on the error', async () => {
    const c = makeClient(
      vi.fn(async () =>
        json(400, { HttpStatusCode: 400, FlinksCode: 'INVALID_REQUEST', RequestId: 'req-77' }),
      ) as unknown as typeof fetch,
    );
    const err: unknown = await c.request(req('POST', { body: {} })).catch((e) => e);
    expect(err).toBeInstanceOf(FlinksError);
    expect((err as FlinksError).body.RequestId).toBe('req-77');
  });
});

describe('http core — retry policy', () => {
  it('retries a GET on 503 then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(503, {}))
      .mockResolvedValueOnce(json(200, { Ok: true }));
    const c = makeClient(fetchMock as unknown as typeof fetch);
    await expect(c.request(req('GET'))).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries any method on 429 (never processed → safe)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(429, {}))
      .mockResolvedValueOnce(json(200, { Ok: true }));
    const c = makeClient(fetchMock as unknown as typeof fetch);
    await expect(c.request(req('POST', { body: {} }))).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries any method on 408', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(408, {}))
      .mockResolvedValueOnce(json(200, { Ok: true }));
    const c = makeClient(fetchMock as unknown as typeof fetch);
    await expect(c.request(req('POST', { body: {} }))).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry a POST on 503 (avoids duplicate side effects)', async () => {
    const fetchMock = vi.fn(async () => json(503, {}));
    const c = makeClient(fetchMock as unknown as typeof fetch);
    await expect(c.request(req('POST', { body: {} }))).rejects.toBeInstanceOf(FlinksError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry any 4xx', async () => {
    const fetchMock = vi.fn(async () => json(400, { FlinksCode: 'INVALID_REQUEST' }));
    const c = makeClient(fetchMock as unknown as typeof fetch);
    await expect(c.request(req('GET'))).rejects.toBeInstanceOf(FlinksError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('exhausts retries and throws the final FlinksError when 503 persists on a GET', async () => {
    const fetchMock = vi.fn(async () => json(503, { FlinksCode: 'AGGREGATION_ERROR' }));
    const c = makeClient(fetchMock as unknown as typeof fetch, { maxRetries: 2 });
    await expect(c.request(req('GET'))).rejects.toBeInstanceOf(FlinksError);
    expect(fetchMock).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('honors the Retry-After header (seconds) for backoff', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(429, {}, { 'retry-after': '1' }))
      .mockResolvedValueOnce(json(200, { Ok: true }));
    const c = makeClient(fetchMock as unknown as typeof fetch);
    const t = Date.now();
    await c.request(req('GET'));
    expect(Date.now() - t).toBeGreaterThanOrEqual(900);
  });
});

describe('http core — transport errors & timeouts', () => {
  it('retries a GET on a network error then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('network down'))
      .mockResolvedValueOnce(json(200, { Ok: true }));
    const c = makeClient(fetchMock as unknown as typeof fetch);
    await expect(c.request(req('GET'))).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry a POST on a network error (may have landed server-side)', async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError('network down');
    });
    const c = makeClient(fetchMock as unknown as typeof fetch);
    await expect(c.request(req('POST', { body: {} }))).rejects.toThrow('network down');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('aborts a hung request after timeoutMs', async () => {
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise((_res, rej) => {
          init.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')));
        }),
    );
    const c = makeClient(fetchMock as unknown as typeof fetch, { timeoutMs: 20 });
    // Surfaces as a typed FlinksTimeoutError, distinct from a caller cancellation.
    await expect(c.request(req('POST', { body: {} }))).rejects.toMatchObject({
      name: 'FlinksTimeoutError',
    });
  });
});

describe('http core — request construction', () => {
  it('PascalCases the JSON body by default and sets Content-Type', async () => {
    const fetchMock = vi.fn(async () => json(200, {}));
    const c = makeClient(fetchMock as unknown as typeof fetch);
    await c.request(req('POST', { body: { loginId: 'x', mostRecentCached: true } }));
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ LoginId: 'x', MostRecentCached: true });
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('sends the body verbatim when transformRequest is false', async () => {
    const fetchMock = vi.fn(async () => json(200, {}));
    const c = makeClient(fetchMock as unknown as typeof fetch);
    await c.request(req('POST', { body: { 'Weird Key': 1 }, transformRequest: false }));
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ 'Weird Key': 1 });
  });

  it('form bodies are url-encoded and not case-transformed', async () => {
    const fetchMock = vi.fn(async () => json(200, {}));
    const c = makeClient(fetchMock as unknown as typeof fetch);
    await c.request(req('POST', { form: { grant_type: 'client_credentials', clientId: 'x' } }));
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Content-Type']).toBe(
      'application/x-www-form-urlencoded',
    );
    expect(init.body).toBe('grant_type=client_credentials&clientId=x');
  });

  it('drops undefined query params and stringifies the rest', async () => {
    const fetchMock = vi.fn(async () => json(200, {}));
    const c = makeClient(fetchMock as unknown as typeof fetch);
    await c.request(req('GET', { query: { a: 1, b: undefined, c: true } }));
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe('https://x.test/a?a=1&c=true');
  });

  it('merges per-request headers and auth override over defaults', async () => {
    const fetchMock = vi.fn(async () => json(200, {}));
    const c = makeClient(fetchMock as unknown as typeof fetch);
    await c.request(req('GET', { headers: { 'X-Trace': 't1' }, auth: { type: 'bearer', token: 'tok' } }));
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const h = init.headers as Record<string, string>;
    expect(h['X-Trace']).toBe('t1');
    expect(h['Authorization']).toBe('Bearer tok');
  });
});

describe('http core — construction guards', () => {
  it('throws when no fetch is available', () => {
    const original = globalThis.fetch;
    // @ts-expect-error force-remove global fetch
    globalThis.fetch = undefined;
    try {
      expect(() => new HttpClient({ baseUrl: 'https://x.test', auth: { type: 'none' } })).toThrow(
        /No global fetch/,
      );
    } finally {
      globalThis.fetch = original;
    }
  });

  it('strips a trailing slash from the base URL', async () => {
    const fetchMock = vi.fn(async () => json(200, {}));
    const c = new HttpClient({
      baseUrl: 'https://x.test/',
      auth: { type: 'none' },
      fetch: fetchMock as unknown as typeof fetch,
    });
    await c.request(req('GET', { path: '/a' }));
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe('https://x.test/a');
  });
});
