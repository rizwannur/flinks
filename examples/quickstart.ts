/**
 * Run the full Flinks account-aggregation flow against your sandbox.
 *
 *   FLINKS_CUSTOMER_ID=... FLINKS_LOGIN_ID=... FLINKS_API_SECRET=... \
 *   bun run examples/quickstart.ts
 */
import { FlinksClient, FlinksError } from '../src/index.js';

const flinks = new FlinksClient({
  instance: process.env.FLINKS_INSTANCE ?? 'toolbox',
  customerId: process.env.FLINKS_CUSTOMER_ID!,
  apiSecret: process.env.FLINKS_API_SECRET,
});

try {
  // 1. Exchange a LoginId for a RequestId.
  const auth = await flinks.authorize.authorize({
    loginId: process.env.FLINKS_LOGIN_ID!,
    mostRecentCached: true,
  });
  console.log('Authorized →', auth.requestId);

  // 2. Fetch full account detail. Handles the 202 → poll flow for you.
  const detail = await flinks.connect.getAccountsDetailAndWait({
    requestId: auth.requestId,
    withTransactions: true,
  });

  for (const account of detail.accounts ?? []) {
    console.log(`• ${account.title} (${account.accountNumber}) — ${account.balance.current} ${account.currency}`);
  }
} catch (error) {
  if (error instanceof FlinksError) {
    console.error(`Flinks error [${error.flinksCode}]: ${error.description}`);
  } else {
    throw error;
  }
}
