import { describe, expect, it, vi } from 'vitest';
import { FlinksClient } from '../src/index.js';
import { toCamelCase, toPascalCase } from '../src/core/case.js';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const client = (fetchMock: ReturnType<typeof vi.fn>) =>
  new FlinksClient({
    instance: 'toolbox',
    customerId: 'c',
    secretKey: 's',
    xApiKey: 'k',
    fetch: fetchMock as unknown as typeof fetch,
  });

describe('edge inputs — case transforms', () => {
  it('handles unicode string values and keys', () => {
    const out = toCamelCase({ Name: 'Ærø Café 東京', Amount: '1‮00' });
    expect(out).toEqual({ name: 'Ærø Café 東京', amount: '1‮00' });
  });

  it('handles a large array without stack issues', () => {
    const big = { Items: Array.from({ length: 5000 }, (_, i) => ({ AccountId: String(i) })) };
    const out = toCamelCase(big) as { items: { accountId: string }[] };
    expect(out.items).toHaveLength(5000);
    expect(out.items[4999]!.accountId).toBe('4999');
  });

  it('preserves boundary numbers exactly', () => {
    const nums = {
      Zero: 0,
      Neg: -1,
      Max: Number.MAX_SAFE_INTEGER,
      Float: 1234.5678,
      Big: 9007199254740993, // beyond MAX_SAFE_INTEGER
    };
    expect(toPascalCase(toCamelCase(nums))).toEqual(nums);
  });

  it('handles empty string keys and values', () => {
    expect(toCamelCase({ '': '' })).toEqual({ '': '' });
  });
});

describe('edge inputs — client roundtrip through fetch', () => {
  it('serializes a large + unicode request body and camelCases the response', async () => {
    const fetchMock = vi.fn(async () => json(200, { HttpStatusCode: 200, RequestId: 'r', Note: '日本語' }));
    const flinks = client(fetchMock);
    await flinks.connect.getAccountsSummary({
      requestId: 'r',
      // @ts-expect-error extra unicode field for the stress test
      note: 'Ærø 東京 🚀',
    });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({ RequestId: 'r', Note: 'Ærø 東京 🚀' });
  });
});
