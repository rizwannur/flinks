/**
 * Live integration test against a real Flinks sandbox.
 *
 * Skipped unless the required env vars are set, so `bun run test` stays offline
 * and deterministic. To run it against your own toolbox/sandbox credentials:
 *
 *   FLINKS_INSTANCE=toolbox \
 *   FLINKS_CUSTOMER_ID=<your customer GUID> \
 *   FLINKS_API_SECRET=<your API secret> \
 *   FLINKS_LOGIN_ID=<a sandbox LoginId> \
 *   bun run test tests/sandbox.test.ts
 */
import { describe, expect, it } from 'vitest';
import { FlinksClient } from '../src/index.js';

const { FLINKS_INSTANCE, FLINKS_CUSTOMER_ID, FLINKS_API_SECRET, FLINKS_LOGIN_ID } =
  process.env;

const hasCreds = Boolean(FLINKS_CUSTOMER_ID && FLINKS_LOGIN_ID);

describe.skipIf(!hasCreds)('Flinks sandbox (live)', () => {
  const flinks = new FlinksClient({
    instance: FLINKS_INSTANCE ?? 'toolbox',
    customerId: FLINKS_CUSTOMER_ID!,
    apiSecret: FLINKS_API_SECRET,
  });

  it('authorizes a cached LoginId and fetches account details', async () => {
    const auth = await flinks.authorize.authorize({
      loginId: FLINKS_LOGIN_ID!,
      mostRecentCached: true,
    });
    expect(auth.requestId).toBeTruthy();

    const detail = await flinks.connect.getAccountsDetailAndWait(
      { requestId: auth.requestId },
      { intervalMs: 5_000, timeoutMs: 120_000 },
    );
    expect(detail.httpStatusCode).toBe(200);
    expect(Array.isArray(detail.accounts)).toBe(true);
  }, 130_000);

  it('lists institutions', async () => {
    const institutions = await flinks.connect.getInstitutions();
    expect(institutions.count).toBeGreaterThanOrEqual(0);
  });
});
