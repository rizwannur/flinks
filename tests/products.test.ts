import { describe, expect, it, vi } from 'vitest';
import { FlinksClient } from '../src/index.js';

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const client = (impl: typeof fetch) =>
  new FlinksClient({
    instance: 'toolbox',
    customerId: 'c',
    secretKey: 's',
    xApiKey: 'k',
    hosts: { pay: 'https://pay.example.com' },
    fetch: impl,
  });

const lastCall = (m: ReturnType<typeof vi.fn>) =>
  m.mock.calls.at(-1) as unknown as [string, RequestInit];

describe('enrich paths', () => {
  it('categorization uses the /categorization/login/.../requestid/... path', async () => {
    const f = vi.fn(async () => json(200, { HttpStatusCode: 200 }));
    await client(f as unknown as typeof fetch).enrich.getCategorization({ loginId: 'L', requestId: 'R' });
    expect(lastCall(f)[0]).toBe(
      'https://toolbox-api.private.fin.ag/v3/c/categorization/login/L/requestid/R',
    );
  });

  it('income attributes use the insight path', async () => {
    const f = vi.fn(async () => json(200, { HttpStatusCode: 200 }));
    await client(f as unknown as typeof fetch).enrich.getIncomeAttributes({ loginId: 'L', requestId: 'R' });
    expect(lastCall(f)[0]).toContain('/insight/login/L/attributes/R/GetIncomeAttributes');
  });
});

describe('identity', () => {
  it('fieldMatch posts to /BankingServices/FieldMatch with x-api-key', async () => {
    const f = vi.fn(async () => json(200, { overallMatch: true, overallMatchRate: 0.9 }));
    const res = await client(f as unknown as typeof fetch).identity.fieldMatch({
      firstName: 'A',
      lastName: 'B',
      threshold: '0.5',
    });
    expect(res.overallMatch).toBe(true);
    const [url, init] = lastCall(f);
    expect(url).toBe('https://toolbox-api.private.fin.ag/v3/c/BankingServices/FieldMatch');
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('k');
  });
});

describe('pay (v1 sessions → payment requests)', () => {
  it('initiateSession posts to /api/v1/sessions/initiate with the BearerToken header', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(json(200, { access_token: 'ptok', token_type: 'Bearer', expires_in: 299 }))
      .mockResolvedValueOnce(json(201, { sessionId: 'sess-1', referenceId: 'ref' }));
    const flinks = client(f as unknown as typeof fetch);

    await flinks.pay.authorize({ username: 'u', password: 'p' });
    const res = await flinks.pay.initiateSession({
      referenceId: 'ref',
      amount: '50.00',
      customerName: 'A B',
      customerEmail: 'a@b.co',
    });
    expect(res.sessionId).toBe('sess-1');

    const [url, init] = lastCall(f);
    expect(url).toBe('https://pay.example.com/api/v1/sessions/initiate');
    expect((init.headers as Record<string, string>)['BearerToken']).toBe('ptok');
    const body = JSON.parse(init.body as string);
    expect(body.amount).toBe('50.00'); // sent verbatim (camelCase), not PascalCased
    expect(body.customerEmail).toBe('a@b.co');
  });

  it('createPaymentRequest activates a session and getPaymentRequest polls it', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(json(200, { access_token: 't', token_type: 'Bearer', expires_in: 1 }))
      .mockResolvedValueOnce(json(201, { requestId: 'rq-1' }))
      .mockResolvedValueOnce(json(200, { requestId: 'rq-1', status: 'Completed' }));
    const flinks = client(f as unknown as typeof fetch);
    await flinks.pay.authorize({ username: 'u', password: 'p' });

    const created = await flinks.pay.createPaymentRequest('sess-1');
    expect(created.requestId).toBe('rq-1');
    expect(lastCall(f)[0]).toBe('https://pay.example.com/api/v1/paymentrequests');

    const status = await flinks.pay.getPaymentRequest('rq-1');
    expect(status.status).toBe('Completed');
    expect(lastCall(f)[0]).toBe('https://pay.example.com/api/v1/paymentrequests/rq-1');
  });

  it('throws a clear error if used before authorize()', async () => {
    const f = vi.fn(async () => json(200, {}));
    const flinks = client(f as unknown as typeof fetch);
    expect(() =>
      flinks.pay.initiateSession({
        referenceId: 'r',
        amount: '1',
        customerName: 'n',
        customerEmail: 'e@x.co',
      }),
    ).toThrow(/no access token/i);
    expect(f).not.toHaveBeenCalled();
  });
});
