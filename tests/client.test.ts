import { describe, expect, it, vi } from 'vitest';
import { FlinksClient, FlinksError } from '../src/index.js';

/** Build a client whose fetch is a controllable mock. */
const makeClient = (impl: typeof fetch) =>
  new FlinksClient({
    instance: 'toolbox',
    customerId: 'cust-123',
    secretKey: 'secret-key',
    xApiKey: 'x-api-key-123',
    maxRetries: 1,
    fetch: impl,
  });

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('FlinksClient wiring', () => {
  it('mints a token with the secret key, then authorizes with that token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { HttpStatusCode: 200, Token: 'tok-abc' }))
      .mockResolvedValueOnce(jsonResponse(200, { HttpStatusCode: 200, RequestId: 'req-1' }));
    const flinks = makeClient(fetchMock as unknown as typeof fetch);

    const res = await flinks.authorize.authorize({ loginId: 'login-9' });
    expect(res.requestId).toBe('req-1');

    // 1st call: GenerateAuthorizeToken with the secret key.
    const [genUrl, genInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(genUrl).toContain('/BankingServices/GenerateAuthorizeToken');
    expect((genInit.headers as Record<string, string>)['flinks-auth-key']).toBe('secret-key');

    // 2nd call: Authorize with the minted token + PascalCase body.
    const [authUrl, authInit] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(authUrl).toBe('https://toolbox-api.private.fin.ag/v3/cust-123/BankingServices/Authorize');
    expect((authInit.headers as Record<string, string>)['flinks-auth-key']).toBe('tok-abc');
    expect(JSON.parse(authInit.body as string)).toMatchObject({
      LoginId: 'login-9',
      MostRecentCached: true,
      Language: 'en',
      Save: true,
    });
  });

  it('sends the x-api-key header on data endpoints', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { HttpStatusCode: 200, Accounts: [] }));
    const flinks = makeClient(fetchMock as unknown as typeof fetch);

    await flinks.connect.getAccountsSummary({ requestId: 'r' });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('x-api-key-123');
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

  it('does NOT retry a non-idempotent POST on 503 (no double side effects)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(503, {}))
      .mockResolvedValueOnce(jsonResponse(200, { HttpStatusCode: 200 }));
    const flinks = makeClient(fetchMock as unknown as typeof fetch);

    // getAccountsSummary is a POST — a 503 must surface, not silently retry.
    await expect(flinks.connect.getAccountsSummary({ requestId: 'r' })).rejects.toBeInstanceOf(
      FlinksError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does retry a POST on 429 (never processed, so safe)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(429, {}))
      .mockResolvedValueOnce(jsonResponse(200, { HttpStatusCode: 200, Accounts: [] }));
    const flinks = makeClient(fetchMock as unknown as typeof fetch);

    await flinks.connect.getAccountsSummary({ requestId: 'r' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry a FlinksError (4xx)', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(400, { FlinksCode: 'INVALID_REQUEST' }));
    const flinks = makeClient(fetchMock as unknown as typeof fetch);

    await expect(flinks.connect.getInstitutions()).rejects.toBeInstanceOf(FlinksError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('getAccountDetails runs authorize → detail in one call', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { HttpStatusCode: 200, Token: 'tok' }))
      .mockResolvedValueOnce(jsonResponse(200, { HttpStatusCode: 200, RequestId: 'r1' }))
      .mockResolvedValueOnce(
        jsonResponse(200, { HttpStatusCode: 200, RequestId: 'r1', Accounts: [{ Title: 'Chequing' }] }),
      );
    const flinks = makeClient(fetchMock as unknown as typeof fetch);

    const res = await flinks.getAccountDetails({ loginId: 'l1' });
    expect(res.status).toBe('done');
    if (res.status === 'done') {
      expect(res.accounts).toHaveLength(1);
      expect(res.accounts[0]!.title).toBe('Chequing');
    }
  });

  it('getAccountDetails surfaces MFA and resumes via answer()', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { HttpStatusCode: 200, Token: 'tok' }))
      .mockResolvedValueOnce(
        jsonResponse(203, {
          HttpStatusCode: 203,
          RequestId: 'r1',
          SecurityChallenges: [{ Prompt: 'Best country?', Type: 'QuestionAndAnswer' }],
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { HttpStatusCode: 200, RequestId: 'r1' }))
      .mockResolvedValueOnce(
        jsonResponse(200, { HttpStatusCode: 200, RequestId: 'r1', Accounts: [{ Title: 'Chequing' }] }),
      );
    const flinks = makeClient(fetchMock as unknown as typeof fetch);

    const first = await flinks.getAccountDetails({ username: 'Greatday', password: 'Everyday' });
    expect(first.status).toBe('mfa');
    if (first.status !== 'mfa') return;
    expect(first.challenges[0]!.prompt).toBe('Best country?');

    const second = await first.answer({ 'Best country?': ['Canada'] });
    expect(second.status).toBe('done');

    // The MFA answer keys must reach Flinks verbatim (not PascalCased).
    const answerCall = fetchMock.mock.calls[2] as unknown as [string, RequestInit];
    const sentBody = JSON.parse(answerCall[1].body as string);
    expect(sentBody.SecurityResponses).toEqual({ 'Best country?': ['Canada'] });
    expect(sentBody.RequestId).toBe('r1');
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
