<div align="center">

# @rafey/flinks

**A modern, fully-typed [Flinks](https://flinks.com) API client for Node.js & Bun.**

Every product. Every endpoint. Zero runtime dependencies.

[![Types](https://img.shields.io/badge/types-included-3178c6?logo=typescript&logoColor=white)](#)
[![Runtime](https://img.shields.io/badge/runtime-Node%2018%2B%20%7C%20Bun-000?logo=bun&logoColor=white)](#)
[![Deps](https://img.shields.io/badge/dependencies-0-success)](#)
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

</div>

---

## Why this exists

The Flinks REST API is powerful but sprawling — seven products across three hosts,
three auth schemes, PascalCase here and snake_case there, and an async 202-then-poll
dance on every heavy endpoint. This library hides all of that behind one typed client
so you write **less code** and hit **fewer edge cases**.

- 🧩 **Complete coverage** — Connect, Authorize, Enrich, Upload, Pay, Open Banking, and data-sharing utilities.
- 🔤 **Idiomatic casing** — you speak camelCase; the wire format is handled for you.
- ⏳ **Async, solved** — `getAccountsDetailAndWait()` runs the whole 202 → poll → 200 flow in one call.
- 🛡️ **Typed errors** — every failure is a `FlinksError` with a stable `flinksCode` and a plain-English description.
- 🔁 **Resilient** — automatic retries with backoff on 429/5xx, request timeouts, constant-time webhook verification.
- 🪶 **Tiny & fast** — native `fetch`, zero dependencies, tree-shakeable ESM + CJS.

## Install

```bash
bun add @rafey/flinks
# or: npm install @rafey/flinks
```

Requires Node 18+ or Bun (anything with a global `fetch`).

## Quickstart

```ts
import { FlinksClient } from '@rafey/flinks';

const flinks = new FlinksClient({
  instance: 'toolbox',           // toolbox | sandbox | production
  customerId: 'your-customer-guid',
  apiSecret: 'your-api-secret',
});

// 1. Exchange a LoginId (from Flinks Connect) for a RequestId.
const auth = await flinks.authorize.authorize({ loginId });

// 2. Fetch full account detail — the 202 → poll flow is handled for you.
const detail = await flinks.connect.getAccountsDetailAndWait({
  requestId: auth.requestId,
  withTransactions: true,
});

for (const account of detail.accounts ?? []) {
  console.log(account.title, account.balance.current, account.currency);
}
```

## The async flow, done right

Heavy Flinks endpoints reply `202 OPERATION_PENDING` while the bank is being read,
and expect you to poll a companion endpoint every 10 seconds for up to 30 minutes.
You never have to write that loop:

```ts
// One call. Polls internally until the data is ready (or times out).
const summary = await flinks.connect.getAccountsSummaryAndWait(
  { requestId },
  { intervalMs: 10_000, timeoutMs: 30 * 60_000 }, // defaults shown
);
```

Prefer to drive it yourself? The low-level pieces are all public:

```ts
import { poll, isPending } from '@rafey/flinks';

const first = await flinks.connect.getAccountsDetail({ requestId });
const done = isPending(first)
  ? await poll(() => flinks.connect.getAccountsDetailAsync(requestId))
  : first;
```

## Handling MFA

When a bank challenges the login, `authorize()` returns `httpStatusCode: 203` with
`securityChallenges`. Answer them by calling `authorize()` again with the same
`requestId`:

```ts
let res = await flinks.authorize.authorize({ loginId });

while (res.httpStatusCode === 203) {
  const answers = await promptUser(res.securityChallenges!); // your UI
  res = await flinks.authorize.authorize({
    requestId: res.requestId,
    securityResponses: answers,
  });
}
```

## Typed errors

```ts
import { FlinksError } from '@rafey/flinks';

try {
  await flinks.connect.getAccountsSummary({ requestId });
} catch (err) {
  if (err instanceof FlinksError) {
    err.flinksCode;        // 'INVALID_LOGIN'
    err.httpStatusCode;    // 401
    err.description;       // 'The provided LoginId, username, or password is invalid.'
  }
}
```

## Verifying webhooks

```ts
import { isWebhookValid } from '@rafey/flinks';

// rawBody must be the exact bytes received, not the parsed object.
if (!isWebhookValid(rawBody, req.headers['x-flinks-signature'], verificationKey)) {
  return res.status(401).end();
}
```

Comparison is constant-time, so signatures can't be brute-forced by timing.

## Product coverage

Every namespace hangs off the one client:

| Namespace          | Covers |
| ------------------ | ------ |
| `flinks.authorize` | `generateAuthorizeToken`, `authorize` (incl. MFA) |
| `flinks.connect`   | accounts summary & detail (sync, async, and `*AndWait`), statements, MFA questions, delete card, institutions, routing-number lookup, scheduled/nightly refresh |
| `flinks.enrich`    | income, credit-risk, lending, user-analysis, categorization, and all-attributes |
| `flinks.upload`    | attribute upload, categorization, fraud analysis |
| `flinks.pay`       | Flinks Pay session authorize |
| `flinks.outbound`  | Open Banking — token, providers, recipients, registrations, revoke |
| `flinks.utilities` | data-sharing `authSecret` grant & disable |

## Configuration

```ts
new FlinksClient({
  instance: 'toolbox',      // required — sets the API host
  customerId: '...',        // required — your Flinks customer GUID
  apiSecret: '...',         // default auth for BankingServices / Enrich / Upload
  timeoutMs: 60_000,        // per-request timeout (default 60s)
  maxRetries: 2,            // transient-failure retries (default 2)
  fetch: customFetch,       // inject your own fetch (testing, proxies)
  hosts: { ... },           // override base hosts (self-hosted / testing)
});
```

## Test against your sandbox

The suite runs fully offline. To exercise the real flow against your own
toolbox/sandbox credentials, set env vars and run the sandbox test:

```bash
FLINKS_INSTANCE=toolbox \
FLINKS_CUSTOMER_ID=your-customer-guid \
FLINKS_API_SECRET=your-api-secret \
FLINKS_LOGIN_ID=a-sandbox-login-id \
bun run test:sandbox
```

Or run the end-to-end example:

```bash
FLINKS_CUSTOMER_ID=... FLINKS_LOGIN_ID=... FLINKS_API_SECRET=... \
bun run examples/quickstart.ts
```

## Development

```bash
bun install
bun run typecheck   # tsc --noEmit
bun run test        # vitest (offline)
bun run build       # tsup → dist (ESM + CJS + d.ts)
```

## License

MIT © Rafey
