# Contributing

Thanks for helping improve `@rizwannur/flinks-node` — a community, unofficial
Flinks client. Contributions of all sizes are welcome: bug fixes, new endpoints,
docs, and tests.

## Getting started

```bash
git clone https://github.com/rizwannur/flinks-node
cd flinks-node
bun install
```

Common tasks:

| Command | What it does |
| --- | --- |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run build` | bundle to `dist/` (ESM + CJS + `.d.ts`) |
| `bun run test` | offline unit tests (no network) |
| `bun run test:sandbox` | live tests against Flinks' public Toolbox sandbox |
| `bun run format` | Prettier |

## Project layout

```
src/
├── core/        HTTP, errors, key-casing, polling, webhooks, auth
├── products/    one folder per Flinks product (authorize, connect, enrich, …)
├── integrations/ next.ts + react.tsx
├── types/       shared types
└── client.ts    composes the product namespaces
```

Guiding principle: **every file has one job.** Core is infrastructure; each
product folder owns its endpoints and types.

## Adding or changing an endpoint

1. Check the behavior against the [Flinks docs](https://docs.flinks.com). If you
   can, verify it live against the Toolbox sandbox (see `tests/sandbox.test.ts`).
2. Add the method to the relevant `products/<product>/` file, with a short
   JSDoc comment explaining what it does.
3. Add an offline test (mock `fetch`) covering the URL, method, auth header, and
   request/response shape. See `tests/client.test.ts` for the pattern.
4. Keep request bodies camelCase — the HTTP layer converts casing per host.
   Never PascalCase data that isn't a field name (e.g. MFA answer keys).

## Ground rules

- **Never** silently retry a non-idempotent write (payments). The HTTP layer
  only retries idempotent GETs on 5xx/network — keep it that way.
- No new runtime dependencies without discussion — this library is zero-dep.
- Match the surrounding style; run `bun run format` before committing.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org)
  (`feat:`, `fix:`, `docs:`, `chore:`, …).

## Pull requests

1. Branch off `main`.
2. Make sure `bun run typecheck`, `bun run build`, and `bun run test` all pass —
   CI runs the same checks.
3. Update `CHANGELOG.md` under `## [Unreleased]` and the README if behavior
   changed.
4. Open the PR with a clear description of what and why.

## Reporting bugs

Open an issue with a minimal reproduction, the method you called, and the full
`FlinksError` (`flinksCode`, `httpStatusCode`, `description`) if there was one.
Never paste real production credentials — use the public sandbox values.

## License

By contributing, you agree your contributions are licensed under the project's
[MIT License](./LICENSE).
