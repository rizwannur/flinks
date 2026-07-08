# Changelog

All notable changes to this project are documented here. This project follows
[Semantic Versioning](https://semver.org) and [Keep a Changelog](https://keepachangelog.com).

## [Unreleased]

## [0.1.0]

Initial release — a modern, fully-typed, zero-dependency Flinks API client for
Node.js and Bun.

### Added

- **Full product coverage**: Authorize, Connect, Enrich, Identity, Upload,
  Outbound (Open Banking), Utilities, and Wealth (deprecated).
- **Pay (experimental)**: the documented v1 flow — `authorize` →
  `initiateSession` → `createPaymentRequest` → poll `getPaymentRequest`. Runs on
  a client-provisioned host you must set via `hosts.pay`.
- **Hardening**: data calls fail fast with a clear message when `xApiKey` is
  missing (no more silent 401s); non-JSON `2xx` bodies raise instead of
  corrupting caller data; path params are validated and percent-encoded;
  request timeouts surface as a typed `FlinksTimeoutError`; requests accept a
  caller `AbortSignal`; acronym-heavy response keys camelCase cleanly
  (`IBAN` → `iban`).
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

[Unreleased]: https://github.com/rizwannur/flinks/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/rizwannur/flinks/releases/tag/v0.1.0
