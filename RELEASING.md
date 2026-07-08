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
3. `npm publish --access public` (add `--provenance` once the repo is public),
4. creates a GitHub Release with auto-generated notes.

Update `CHANGELOG.md` before releasing.

> The repo is currently **private**, so npm publishes without provenance —
> repo visibility and npm publishing are independent. When you flip the repo
> to public, enable **provenance** (a signed attestation linking the tarball
> to this repo and the CI run that built it): add `--provenance` to the
> publish step and uncomment `id-token: write` in the release workflow.
