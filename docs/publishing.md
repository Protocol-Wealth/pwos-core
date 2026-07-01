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
npm login
pnpm install --frozen-lockfile
pnpm versions:check
pnpm -r build
pnpm changeset:publish
git push origin main --tags
```

Use `pnpm`, not `npm publish`, so workspace protocol dependencies rewrite
correctly for published packages.

## Contributor Notes

- Run `pnpm changeset` after any non-trivial code change to a publishable
  package.
- Do not edit package versions directly; the Changesets version PR owns that.
- Do not publish from CI or add `NPM_API_KEY` publish steps back to the release
  workflow.
- Docs-only, CI-only, and private workspace changes usually do not need a
  changeset.
- All packages share the root `pnpm-lock.yaml`; CI uses `--frozen-lockfile`.
