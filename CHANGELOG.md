# Changelog

All notable changes to this project are documented here. This project follows
[Semantic Versioning](https://semver.org) and [Keep a Changelog](https://keepachangelog.com).

## [Unreleased]

## [0.1.0]

Initial release — a modern, fully-typed, zero-dependency Flinks API client for
Node.js and Bun.

### Added

- **Full product coverage**: Authorize, Connect, Enrich, Identity, Upload, Pay
  (e-Transfer / EFT / GEFT, V2 sessions + legacy V1), Outbound (Open Banking),
  Utilities, and Wealth (deprecated).
- **One-call flow**: `getAccountDetails()` / `getAccountSummary()` run
  authorize → MFA → 202-poll → data and return a typed `done | mfa` result.
- **Async helpers**: `getAccounts*AndWait()`, plus public `poll()` / `isPending()`.
- **Typed errors**: `FlinksError` with stable `flinksCode` + descriptions.
- **Webhooks**: constant-time HMAC verification (`handleFlinksWebhook`,
  `verifyFlinksWebhook`) and typed events.
- **Next.js & React**: `createFlinksHandler` (secure server route),
  `createFlinksClient` (typed browser client), `useFlinksConnect` (widget hook).
- Automatic authorize-token minting/caching; correct `flinks-auth-key` /
  `x-api-key` routing.
- Retry-safety: only idempotent GETs retry on 5xx/network; non-idempotent
  writes (payments) are never silently repeated.

[Unreleased]: https://github.com/rizwannur/flinks-node/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/rizwannur/flinks-node/releases/tag/v0.1.0
