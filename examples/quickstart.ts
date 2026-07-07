/**
 * The whole flow in one call, against Flinks' public Toolbox sandbox.
 *
 *   bun run examples/quickstart.ts
 *
 * Override any credential with env vars (FLINKS_CUSTOMER_ID, FLINKS_SECRET_KEY,
 * FLINKS_X_API_KEY, FLINKS_USERNAME, FLINKS_PASSWORD) to hit your own instance.
 */
import { FlinksClient, FlinksError } from '../src/index.js';

const flinks = new FlinksClient({
  instance: process.env.FLINKS_INSTANCE ?? 'toolbox',
  customerId: process.env.FLINKS_CUSTOMER_ID ?? '43387ca6-0391-4c82-857d-70d95f087ecb',
  secretKey: process.env.FLINKS_SECRET_KEY ?? 'c4569c54-e167-4d34-8de6-f4113bc82414',
  xApiKey: process.env.FLINKS_X_API_KEY ?? '3d5266a8-b697-48d4-8de6-52e2e2662acc',
});

try {
  // One call: authorize (mints token) → handle MFA → poll → full detail.
  let result = await flinks.getAccountDetails(
    {
      username: process.env.FLINKS_USERNAME ?? 'greatday_nomfa',
      password: process.env.FLINKS_PASSWORD ?? 'Everyday',
      institution: 'FlinksCapital',
      mostRecentCached: false,
    },
    { detail: { withTransactions: true } },
  );

  // If the bank challenges the login, answer and continue the same flow.
  while (result.status === 'mfa') {
    console.log('MFA:', result.challenges.map((c) => c.prompt).join(', '));
    const answers = Object.fromEntries(result.challenges.map((c) => [c.prompt, ['your answer']]));
    result = await result.answer(answers);
  }

  console.log(`\n${result.accounts.length} accounts:`);
  for (const a of result.accounts) {
    console.log(`  • ${a.title}: ${a.balance.current} ${a.currency} (${a.transactions?.length ?? 0} tx)`);
  }
} catch (error) {
  if (error instanceof FlinksError) {
    console.error(`Flinks error [${error.flinksCode}]: ${error.description}`);
  } else {
    throw error;
  }
}
