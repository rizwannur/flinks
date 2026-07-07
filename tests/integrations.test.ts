import { describe, expect, it, vi } from 'vitest';
import { createFlinksHandler } from '../src/integrations/next.js';
import { createFlinksClient, FlinksClientError } from '../src/integrations/react.js';

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const rpc = (body: unknown) =>
  new Request('http://localhost/api/flinks', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('Next handler', () => {
  const fetchMock = vi.fn(async () => jsonResponse(200, { Data: [], Count: 0, HttpStatusCode: 200 }));
  const { POST } = createFlinksHandler({
    instance: 'toolbox',
    customerId: 'c',
    apiSecret: 's',
    allow: ['connect.getInstitutions'],
    fetch: fetchMock as unknown as typeof fetch,
  });

  it('runs an allowed method and returns its JSON', async () => {
    const res = await POST(rpc({ product: 'connect', method: 'getInstitutions', args: [] }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ count: 0 });
  });

  it('blocks a method not on the allowlist', async () => {
    const res = await POST(rpc({ product: 'connect', method: 'deleteCard', args: ['x'] }));
    expect(res.status).toBe(403);
  });

  it('rejects a malformed body', async () => {
    const res = await POST(rpc({ product: 'connect' }));
    expect(res.status).toBe(400);
  });
});

describe('browser client', () => {
  it('proxies calls to the endpoint and unwraps JSON', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { count: 3 }));
    vi.stubGlobal('fetch', fetchMock);
    const flinks = createFlinksClient('/api/flinks');

    const res = await flinks.connect.getInstitutions();
    expect(res).toEqual({ count: 3 });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/flinks');
    expect(JSON.parse(init.body as string)).toEqual({
      product: 'connect',
      method: 'getInstitutions',
      args: [],
    });
    vi.unstubAllGlobals();
  });

  it('throws FlinksClientError on a non-2xx', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(401, { message: 'no', flinksCode: 'UNAUTHORIZED' }));
    vi.stubGlobal('fetch', fetchMock);
    const flinks = createFlinksClient();

    await expect(flinks.connect.getInstitutions()).rejects.toBeInstanceOf(FlinksClientError);
    vi.unstubAllGlobals();
  });
});
