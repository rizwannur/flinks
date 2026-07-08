<div align="center">

<h1>
  <br>
  🏦&nbsp; flinks
  <br>
</h1>

### The modern, fully-typed [Flinks](https://flinks.com) API client for Node.js &amp; Bun

**Every product. Every endpoint. Zero runtime dependencies.**

<br>

[![npm](https://img.shields.io/badge/npm-%40rizwannur%2Fflinks-CB3837?style=for-the-badge&logo=npm&logoColor=white)](https://www.npmjs.com/package/@rizwannur/flinks)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](#)
[![Runtime](https://img.shields.io/badge/Node_18+_·_Bun-000000?style=for-the-badge&logo=bun&logoColor=white)](#)

[![CI](https://img.shields.io/github/actions/workflow/status/rizwannur/flinks/ci.yml?style=flat-square&label=CI&logo=github)](https://github.com/rizwannur/flinks/actions/workflows/ci.yml)
![Dependencies](https://img.shields.io/badge/dependencies-0-2EA043?style=flat-square)
![Bundle](https://img.shields.io/badge/ESM_+_CJS-tree--shakeable-8957E5?style=flat-square)
![Tests](https://img.shields.io/badge/tests-44_passing-2EA043?style=flat-square&logo=vitest&logoColor=white)
![Coverage](https://img.shields.io/badge/products-9%2F9-0969DA?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-0969DA?style=flat-square)

</div>

> [!NOTE]
> **Community project — not affiliated with, endorsed by, or maintained by Flinks.**
> "Flinks" is a trademark of its owner; this is an independent, unofficial client.

---

## ✨ Why this exists

The Flinks REST API is powerful but sprawling — **seven products across three hosts**,
three auth schemes, PascalCase here and snake_case there, and an async 202-then-poll
dance on every heavy endpoint. `flinks` hides all of that behind **one typed
client** so you write less code and hit fewer edge cases.

|  |  |
| --- | --- |
| 🧩 **Complete coverage** | Connect · Authorize · Enrich · Identity · Upload · Pay · Open Banking · Utilities |
| ⏳ **Async, solved** | `getAccountDetails()` runs authorize → MFA → 202-poll → data in **one call** |
| 🔤 **Idiomatic casing** | you speak camelCase; PascalCase/snake_case on the wire is handled |
| 🛡️ **Typed errors** | every failure is a `FlinksError` with a stable `flinksCode` + plain-English description |
| 🔁 **Safe & resilient** | backoff retries on 429/5xx — **never** silently retries a payment POST |
| 🔐 **Webhooks built in** | constant-time HMAC verify + typed events |
| ⚛️ **Next.js & React** | secure server route + typed browser client + Connect-widget hook |
| 🪶 **Tiny & fast** | native `fetch`, **zero** dependencies, tree-shakeable ESM + CJS |

## 📦 Install

```bash
bun add @rizwannur/flinks        # or: npm i @rizwannur/flinks  ·  pnpm add @rizwannur/flinks
```

Requires Node 18+ or Bun (anything with a global `fetch`).

## 🚀 Try it right now (public sandbox)

Flinks publishes a shared Toolbox sandbox. This exact snippet runs as-is:

```ts
import { FlinksClient } from '@rizwannur/flinks';

const flinks = new FlinksClient({
  instance: 'toolbox',
  customerId: '43387ca6-0391-4c82-857d-70d95f087ecb',
  secretKey: 'c4569c54-e167-4d34-8de6-f4113bc82414', // mints authorize tokens
  xApiKey: '3d5266a8-b697-48d4-8de6-52e2e2662acc',   // data endpoints
});

// The entire flow — authorize, MFA, poll, fetch — in ONE call:
const result = await flinks.getAccountDetails(
  { username: 'greatday_nomfa', password: 'Everyday', institution: 'FlinksCapital' },
  { detail: { withTransactions: true } },
);

if (result.status === 'done') {
  for (const a of result.accounts) {
    console.log(a.title, a.balance.current, a.currency, `${a.transactions?.length ?? 0} tx`);
  }
}
```

`bun run examples/quickstart.ts` runs it; `bun run test:sandbox` runs the live suite.

## ⚡ Quickstart (your account)

```ts
const flinks = new FlinksClient({
  instance: 'toolbox',            // toolbox | sandbox | production
  customerId: 'your-customer-guid',
  secretKey: 'your-secret-key',   // flinks-auth-key on GenerateAuthorizeToken
  xApiKey: 'your-x-api-key',      // x-api-key on data endpoints
});
```

### One call, or step by step

The one-call helper handles the authorize token, the 202→poll wait, and the 203
MFA branch for you:

```ts
let res = await flinks.getAccountDetails({ loginId }); // from Flinks Connect
while (res.status === 'mfa') {
  const answers = await askUser(res.challenges);        // { [prompt]: [answer] }
  res = await res.answer(answers);
}
console.log(res.accounts);
```

Prefer the raw endpoints? They're all still there:

```ts
const auth = await flinks.authorize.authorize({ loginId });   // token minted for you
const detail = await flinks.connect.getAccountsDetailAndWait({ // 202→poll handled
  requestId: auth.requestId,
  withTransactions: true,
});
```

### How auth works (so you're never confused)

Flinks uses two keys, and this library routes each to the right place automatically:

| Key | Header | Used on |
| --- | --- | --- |
| **Secret key** | `flinks-auth-key` | `GenerateAuthorizeToken` (mints authorize tokens) |
| Authorize token | `flinks-auth-key` | `Authorize` (minted + cached for you) |
| **x-api-key** | `x-api-key` | all data endpoints (accounts, statements, enrich) |
| HMAC secret | — | verifying inbound webhooks |

## ⚛️ Next.js & React — the whole integration in ~15 lines

Your API secret must never touch the browser. This library gives you a secure
server route and a typed browser client that talks to it — so your React code
calls Flinks methods directly, and the secret stays on the server.

**1. Server route** (`app/api/flinks/route.ts`):

```ts
import { createFlinksHandler } from '@rizwannur/flinks/next';

export const { POST } = createFlinksHandler({
  instance: 'toolbox',
  customerId: process.env.FLINKS_CUSTOMER_ID!,
  secretKey: process.env.FLINKS_SECRET_KEY!,
  xApiKey: process.env.FLINKS_X_API_KEY!,
  // Only these methods are reachable from the browser:
  allow: ['authorize.authorize', 'connect.getAccountsDetailAndWait'],
});
```

**2. Browser client** — same methods, same types, zero fetch boilerplate:

```ts
'use client';
import { createFlinksClient } from '@rizwannur/flinks/react';

const flinks = createFlinksClient(); // POSTs to /api/flinks

const detail = await flinks.connect.getAccountsDetailAndWait({ requestId });
//    ^ fully typed — autocomplete and return types, in the browser
```

**3. Let users link their bank** with the Connect widget hook. Mint the authorize
token on your server (never ship the secret key), pass it to the widget, and
receive the `loginId` when the user finishes:

```tsx
'use client';
import { useFlinksConnect } from '@rizwannur/flinks/react';

export function LinkBank({ authorizeToken }: { authorizeToken: string }) {
  const { iframeUrl } = useFlinksConnect({
    instance: 'toolbox',
    authorizeToken,      // from GenerateAuthorizeToken on your server
    demo: true,          // sandbox only — shows the Flinks Capital test bank
    onSuccess: ({ loginId }) => {
      // POST loginId to your API → flinks.getAccountDetails({ loginId })
    },
  });
  return <iframe src={iframeUrl} width="100%" height={600} />;
}
```

The full loop: **server** mints the token (`generateAuthorizeToken`) → **widget**
links the bank and returns a `loginId` → **server** calls `getAccountDetails({ loginId })`.

> The `/next` handler uses only web-standard `Request`/`Response`, so the same
> one-liner works in Remix, Hono, Bun.serve, and edge runtimes too.

## ⏳ The async flow, done right

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
import { poll, isPending } from '@rizwannur/flinks';

const first = await flinks.connect.getAccountsDetail({ requestId });
const done = isPending(first)
  ? await poll(() => flinks.connect.getAccountsDetailAsync(requestId))
  : first;
```

## 🔐 Handling MFA

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

## 🛡️ Typed errors

```ts
import { FlinksError } from '@rizwannur/flinks';

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

## 🪝 Webhooks

**Registering:** Flinks has no self-serve webhook API. You enable webhooks by
opening a [Flinks Support](https://help.flinks.com/support/home) ticket with your
**webhook URL** and **instance**; Flinks configures the callback server-side.
Delivery: any non-`200` response is a failure, retried up to 10× at 30-min
intervals — so verify fast and return `200`.

**Receiving:** verify the HMAC-SHA256 signature (sent in the
`flinks-authenticity-key` header) and get a typed, camelCased event:

```ts
import { handleFlinksWebhook } from '@rizwannur/flinks';

export async function POST(req: Request) {
  const raw = await req.text(); // exact bytes — never re-serialize
  let event;
  try {
    event = handleFlinksWebhook(raw, req.headers, process.env.FLINKS_HMAC_SECRET!);
  } catch {
    return new Response('bad signature', { status: 403 });
  }

  switch (event.responseType) {
    case 'GetAccountsDetail': /* full account payload ready */ break;
    case 'KYC':              /* holder identity fetched */    break;
    case 'PayEvent':         /* payment status update */       break;
    case 'UploadFraudAlert': /* fraud detected */              break;
  }
  return new Response('ok'); // must be 200 or Flinks retries
}
```

Verification is constant-time, so signatures can't be brute-forced by timing.
Your custom `Tag` and the Flinks `loginId` come through on the event for
correlating to your own records.

## 🧩 Product coverage

Every namespace hangs off the one client:

| Namespace          | Covers |
| ------------------ | ------ |
| `flinks.authorize` | `generateAuthorizeToken`, `authorize` (incl. MFA) |
| `flinks.connect`   | accounts summary & detail (sync, async, and `*AndWait`), statements, MFA questions, delete card, institutions, routing-number lookup, scheduled/nightly refresh |
| `flinks.enrich`    | income, credit-risk, lending, user-analysis & business attributes, request-specific attributes, categorization, prepayment optimization, attribute libraries, categories |
| `flinks.identity`  | `fieldMatch` — verify name/address/email/phone against bank-verified data |
| `flinks.upload`    | attribute upload, categorization, fraud analysis |
| `flinks.pay` ⚠️     | `authorize` → `initiateSession` → `createPaymentRequest` → poll `getPaymentRequest` (Interac e-Transfer / EFT). **Experimental** — Pay runs on a client-provisioned host you must set via `hosts.pay`; see note below |
| `flinks.outbound`  | Open Banking — token, providers, recipients, registrations, revoke |
| `flinks.utilities` | data-sharing `authSecret` grant / disable / enable |
| `flinks.wealth`    | investments (get/delete) — **deprecated, retires 2026-04-30** |

Plus the top-level `getAccountDetails` / `getAccountSummary` one-call helpers, and
webhook verification (`flinks.webhooks.handle` or the standalone `handleFlinksWebhook`).

> ⚠️ **Flinks Pay is experimental.** It follows the published Pay OpenAPI spec but
> could not be verified against a live sandbox, and Flinks serves Pay from a
> **client-provisioned host** that is delivered to you at onboarding (there is no
> public default). You must supply it explicitly:
> `new FlinksClient({ hosts: { pay: 'https://your-pay-host' }, ... })`.
> All other products run against the standard Flinks hosts out of the box.

## ⚙️ Configuration

```ts
new FlinksClient({
  instance: 'toolbox',      // required — sets the API host
  customerId: '...',        // required — your Flinks customer GUID
  secretKey: '...',         // mints authorize tokens (flinks-auth-key)
  xApiKey: '...',           // data-endpoint auth (x-api-key)
  hmacSecret: '...',        // verify inbound webhooks
  authorizeToken: '...',    // optional — reuse a token instead of minting
  timeoutMs: 60_000,        // per-request timeout (default 60s)
  maxRetries: 2,            // transient-failure retries (default 2)
  fetch: customFetch,       // inject your own fetch (testing, proxies)
  hosts: { ... },           // override base hosts (self-hosted / testing)
});
```

## 🧪 Test against your sandbox

The default `bun run test` suite is fully offline. The live suite hits Flinks'
public sandbox with no setup:

```bash
bun run test:sandbox        # runs against the public Toolbox sandbox
```

Point it at your own instance by overriding env vars:

```bash
FLINKS_INSTANCE=toolbox \
FLINKS_CUSTOMER_ID=your-customer-guid \
FLINKS_SECRET_KEY=your-secret-key \
FLINKS_X_API_KEY=your-x-api-key \
bun run test:sandbox
```

## 🛠️ Development

```bash
bun install
bun run typecheck   # tsc --noEmit
bun run test        # vitest (offline)
bun run build       # tsup → dist (ESM + CJS + d.ts)
```

## 🤝 Contributing

Bug fixes, new endpoints, and docs are all welcome — see
[CONTRIBUTING.md](./CONTRIBUTING.md). CI must pass (`typecheck` · `build` · `test`).

## 📄 License

[MIT](./LICENSE) © Rafey. Community project — not affiliated with Flinks.
