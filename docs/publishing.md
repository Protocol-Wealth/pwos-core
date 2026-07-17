# Publishing pwos-core packages to npm

This repo uses [Changesets](https://github.com/changesets/changesets) for
per-package versioning. The GitHub workflow is **version-PR only**: it opens or
updates the "Version Packages" PR when changesets are pending, but it does not
publish to npm.

Publication is maintainer-local by decision. The maintainer signs in with npm
locally, merges the version PR, then runs the local publish command.

## Day-to-day Flow

1. A contributor opens a PR with one or more `.changeset/*.md` files when a
   publishable package changes.
2. PR CI runs build, typecheck, tests, lint, SPDX, license, and version-drift
   checks.
3. After the PR merges to `main`, `.github/workflows/release.yml` opens or
   updates the "Version Packages" PR.
4. The maintainer reviews and merges the version PR.
5. The maintainer publishes locally.

## Local Publish Command

```bash
nvm install 22
nvm use 22
corepack enable
corepack prepare pnpm@9.0.0 --activate
npm login
pnpm install --frozen-lockfile
pnpm versions:check
pnpm -r build
pnpm changeset:publish
git push origin main --tags
```

Use `pnpm`, not `npm publish`, so workspace protocol dependencies rewrite
correctly for published packages.

Publication is pinned to Node 22.x, npm 10.x, and pnpm 9.x. npm 12 changes the
JSON shape returned by `npm info --json`, which causes Changesets 2.x to
misclassify already-published workspace versions, and it rejects pnpm's
`--no-git-checks` handoff. `pnpm changeset:publish` runs a fail-fast preflight
that fetches `origin/main` and requires a clean local `main` at the same commit.

## Contributor Notes

- Run `pnpm changeset` after any non-trivial code change to a publishable
  package.
- Do not edit package versions directly; the Changesets version PR owns that.
- Do not publish from CI or add `NPM_API_KEY` publish steps back to the release
  workflow.
- Docs-only, CI-only, and private workspace changes usually do not need a
  changeset.
- All packages share the root `pnpm-lock.yaml`; CI uses `--frozen-lockfile`.
