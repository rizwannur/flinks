import { describe, expect, it, vi } from 'vitest';
import { FlinksClient, FlinksError } from '../src/index.js';

/** Build a client whose fetch is a controllable mock. */
const makeClient = (impl: typeof fetch) =>
  new FlinksClient({
    instance: 'toolbox',
    customerId: 'cust-123',
    apiSecret: 'secret-key',
    maxRetries: 1,
    fetch: impl,
  });

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('FlinksClient wiring', () => {
  it('builds the right URL, auth header, and PascalCase body for authorize', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { HttpStatusCode: 200, RequestId: 'req-1' }));
    const flinks = makeClient(fetchMock as unknown as typeof fetch);

    const res = await flinks.authorize.authorize({ loginId: 'login-9' });

    expect(res.requestId).toBe('req-1');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      'https://toolbox-api.private.fin.ag/v3/cust-123/BankingServices/Authorize',
    );
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['flinks-auth-key']).toBe('secret-key');
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({
      LoginId: 'login-9',
      MostRecentCached: true,
      Language: 'en',
      Save: true,
    });
  });

  it('camelCases nested account responses', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, {
        HttpStatusCode: 200,
        RequestId: 'r',
        Accounts: [{ AccountNumber: '001', Balance: { Available: 100, Current: 100, Limit: null } }],
      }),
    );
    const flinks = makeClient(fetchMock as unknown as typeof fetch);

    const res = await flinks.connect.getAccountsDetail({ requestId: 'r' });
    expect(res.accounts?.[0]?.accountNumber).toBe('001');
    expect(res.accounts?.[0]?.balance.available).toBe(100);
  });

  it('throws a FlinksError with the parsed code on 4xx', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(401, { HttpStatusCode: 401, FlinksCode: 'INVALID_LOGIN', Message: 'nope' }),
    );
    const flinks = makeClient(fetchMock as unknown as typeof fetch);

    await expect(flinks.connect.getAccountsSummary({ requestId: 'r' })).rejects.toMatchObject({
      name: 'FlinksError',
      flinksCode: 'INVALID_LOGIN',
      httpStatusCode: 401,
    });
  });

  it('retries once on 503 then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(503, {}))
      .mockResolvedValueOnce(jsonResponse(200, { HttpStatusCode: 200, Data: [], Count: 0 }));
    const flinks = makeClient(fetchMock as unknown as typeof fetch);

    const res = await flinks.connect.getInstitutions();
    expect(res.count).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry a FlinksError (4xx)', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(400, { FlinksCode: 'INVALID_REQUEST' }));
    const flinks = makeClient(fetchMock as unknown as typeof fetch);

    await expect(flinks.connect.getInstitutions()).rejects.toBeInstanceOf(FlinksError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses Bearer auth + snake_case for the outbound token call', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, { access_token: 'tok', token_type: 'Bearer', expires_in: 299 }),
    );
    const flinks = makeClient(fetchMock as unknown as typeof fetch);

    const res = await flinks.outbound.token({
      grantType: 'client_credentials',
      clientId: 'id',
      clientSecret: 'sec',
    });
    expect(res.accessToken).toBe('tok');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://ob.flinksapp.com/api/v1/token');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      grant_type: 'client_credentials',
      client_id: 'id',
      client_secret: 'sec',
    });
    // token is stored for subsequent authenticated calls
    const fetch2 = vi.fn(async () => jsonResponse(200, []));
    // @ts-expect-error swap the mock to inspect the next call's auth header
    flinks.outbound['http']['fetchImpl'] = fetch2;
    await flinks.outbound.listDataProviders('CA');
    const [, init2] = fetch2.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init2.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer tok');
  });
});
