/**
 * Live integration test against the Flinks Toolbox sandbox.
 *
 * These run against Flinks' **public** shared sandbox credentials by default, so
 * `bun run test:sandbox` works out of the box. Override any of them with env
 * vars to point at your own instance:
 *
 *   FLINKS_INSTANCE, FLINKS_CUSTOMER_ID, FLINKS_SECRET_KEY,
 *   FLINKS_X_API_KEY, FLINKS_USERNAME, FLINKS_PASSWORD, FLINKS_INSTITUTION
 *
 * Skipped from the default `bun run test` run (that stays offline); include this
 * file explicitly to run it: `vitest run tests/sandbox.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { FlinksClient } from '../src/index.js';

// Flinks' documented public Toolbox sandbox credentials.
const env = process.env;
const instance = env.FLINKS_INSTANCE ?? 'toolbox';
const customerId = env.FLINKS_CUSTOMER_ID ?? '43387ca6-0391-4c82-857d-70d95f087ecb';
const secretKey = env.FLINKS_SECRET_KEY ?? 'c4569c54-e167-4d34-8de6-f4113bc82414';
const xApiKey = env.FLINKS_X_API_KEY ?? '3d5266a8-b697-48d4-8de6-52e2e2662acc';
const username = env.FLINKS_USERNAME ?? 'greatday_nomfa';
const password = env.FLINKS_PASSWORD ?? 'Everyday';
const institution = env.FLINKS_INSTITUTION ?? 'FlinksCapital';

// Only run when explicitly asked (the sandbox is a network dependency).
const RUN = env.RUN_SANDBOX === '1' || env.VITEST_SANDBOX === '1';

describe.runIf(RUN)('Flinks Toolbox sandbox (live)', () => {
  const flinks = new FlinksClient({ instance, customerId, secretKey, xApiKey });

  it('runs the full flow in one call and returns accounts with transactions', async () => {
    const res = await flinks.getAccountDetails(
      { username, password, institution, mostRecentCached: false },
      { detail: { withTransactions: true }, poll: { intervalMs: 3_000, timeoutMs: 90_000 } },
    );
    expect(res.status).toBe('done');
    if (res.status !== 'done') return;
    expect(res.accounts.length).toBeGreaterThan(0);
    expect(res.accounts[0]!.balance.current).toBeTypeOf('number');
  }, 120_000);

  it('mints an authorize token from the secret key', async () => {
    const { token } = await flinks.authorize.generateAuthorizeToken();
    expect(token).toMatch(/[0-9a-f-]{36}/);
  });

  it('lists institutions', async () => {
    const res = await flinks.connect.getInstitutions();
    expect((res.count ?? res.data?.length ?? 0)).toBeGreaterThan(0);
  });
});
