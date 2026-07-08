# Releasing

CI runs on every push/PR to `main` (typecheck · build · test). Publishing is
automated from version tags.

## One-time setup

1. **Create an npm token** (Automation type) at npmjs.com → Access Tokens.
2. Add it to the repo: **Settings → Secrets and variables → Actions → New
   repository secret**, name it `NPM_TOKEN`.

That's the only secret required. Provenance uses GitHub's built-in OIDC token.

## Cut a release

```bash
bun run release:patch   # 0.1.0 -> 0.1.1   (or release:minor / release:major)
```

This bumps `package.json`, commits, tags `vX.Y.Z`, and pushes the tag. The
`Release` workflow then:

1. typechecks, tests, and builds,
2. verifies the tag matches `package.json`,
3. `npm publish --access public --provenance`,
4. creates a GitHub Release with auto-generated notes.

Update `CHANGELOG.md` before releasing.

> The repo is public, so npm publishes with **provenance** — a signed
> attestation linking the published tarball to this repo and the exact CI
> run that built it. Provenance requires `id-token: write` in the workflow.
