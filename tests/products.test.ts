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
    payClientId: 'pcid',
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

describe('pay V2 sessions', () => {
  it('createEftSession sets type=EFT and guarantee disabled, with Bearer auth', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(json(200, { access_token: 'ptok', token_type: 'Bearer', expires_in: 299 }))
      .mockResolvedValueOnce(json(201, { sessionId: 'sess-1', referenceId: 'ref' }));
    const flinks = client(f as unknown as typeof fetch);

    await flinks.pay.authorize({ username: 'u', password: 'p' });
    const res = await flinks.pay.createEftSession({ amount: 50, payor: { firstName: 'A' } });
    expect(res.sessionId).toBe('sess-1');

    const [url, init] = lastCall(f);
    expect(url).toBe('https://www.flinks.com/api/v2/sessions');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer ptok');
    const body = JSON.parse(init.body as string);
    expect(body.type).toBe('EFT');
    expect(body.options.guarantee.enable).toBe(false);
  });

  it('createGuaranteedEftSession enables the guarantee', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(json(200, { access_token: 't', token_type: 'Bearer', expires_in: 1 }))
      .mockResolvedValueOnce(json(201, { sessionId: 's' }));
    const flinks = client(f as unknown as typeof fetch);
    await flinks.pay.authorize({ username: 'u', password: 'p' });
    await flinks.pay.createGuaranteedEftSession({ amount: 10 });
    expect(JSON.parse(lastCall(f)[1].body as string).options.guarantee.enable).toBe(true);
  });

  it('V1 EFT uses the x-client-id header and wraps the body in an array', async () => {
    const f = vi.fn(async () => json(200, { schedules: [] }));
    const flinks = client(f as unknown as typeof fetch);
    await flinks.pay.createEftTransactionV1({
      transactionCode: 700,
      amount: 5,
      paymentDirection: 'DEBIT',
      currency: 'CAD',
      scheduleInfo: { paymentFrequency: 'OneTime', startDate: '2026-08-01' },
    });
    const [url, init] = lastCall(f);
    expect(url).toBe('https://www.flinks.com/api/v1/transactions');
    expect((init.headers as Record<string, string>)['x-client-id']).toBe('pcid');
    expect(Array.isArray(JSON.parse(init.body as string))).toBe(true);
  });
});
