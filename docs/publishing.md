# Publishing pwos-core packages to npm

This repo uses [Changesets](https://github.com/changesets/changesets) for
per-package versioning + the [changesets/action](https://github.com/changesets/action)
GitHub Action for automated releases.

The flow is:

1. A contributor opens a PR that includes one or more changeset files.
2. On merge to `main`, the release workflow opens (or updates) a single
   "Version Packages" PR that bumps versions + writes CHANGELOG entries.
3. When you merge that PR, the same workflow runs `changeset publish` and
   the new versions land on npm under the `@protocolwealthos` scope.

You don't push tags or run `npm publish` by hand.

---

## One-time setup (human steps)

### 1. Claim the `@protocolwealthos` scope on npm ✅ (already done)

Status as of 2026-04-13: both `@protocolwealthos` and `@protocolwealth`
orgs are registered under the Protocol Wealth npm account.

For reference, the one-time steps were:

1. Sign in at <https://www.npmjs.com/login> with the account that should
   own the scope (ideally a group inbox — easier to hand off than a
   personal account).
2. Verify the email on the account.
3. Enable 2FA: <https://www.npmjs.com/settings/~/profile> →
   **Two-factor authentication** → "Authorization and Publishing".
4. Create the org: <https://www.npmjs.com/org/create>
   - Org name: `protocolwealthos`
   - Plan: **Free** (lets you publish unlimited public packages — paid
     is only needed for private packages).

Org page: <https://www.npmjs.com/org/protocolwealthos>

### 2. Generate an Automation token

This token gets stored as a GitHub Actions secret. The CI workflow uses
it for the publish step. Use **Automation** type — it works with
2FA-required publishing, while a **Publish** token would force interactive
2FA on every publish.

1. <https://www.npmjs.com/settings/~/tokens>
2. **Generate New Token** → **Automation**
3. Token name: `pwos-core-ci`
4. Copy the token. **You only see it once** — paste it somewhere safe
   for the next step.

### 3. Add the token to GitHub Actions secrets ✅ (already done)

1. <https://github.com/Protocol-Wealth/pwos-core/settings/secrets/actions>
2. **New repository secret**
3. Name: `NPM_API_KEY`
4. Value: the automation token from step 2

Note on naming: the repo secret is `NPM_API_KEY` per the maintainer's
convention. The release workflow maps this into both `NODE_AUTH_TOKEN`
(the canonical env var `npm publish` reads automatically) and `NPM_TOKEN`
(for any tooling that checks the legacy name). Either way, one secret,
two env vars at publish time.

### 4. Verify Actions has write permission for PRs

Already configured at the workflow level (`permissions: contents: write,
pull-requests: write` in `.github/workflows/release.yml`), but the repo
also needs Actions enabled to write to PRs:

1. <https://github.com/Protocol-Wealth/pwos-core/settings/actions>
2. **Workflow permissions** section → ensure either
   - "Read and write permissions" is selected, OR
   - "Allow GitHub Actions to create and approve pull requests" is checked

That's it for setup — the rest is automated.

---

## Day-to-day workflow (contributor / Claude)

### When opening a PR that should ship to npm

After making code changes, run:

```bash
pnpm changeset
```

The CLI asks:
- Which packages changed? (space-bar to select)
- Major / minor / patch bump for each?
- A short summary (this becomes a line in the CHANGELOG)

The CLI writes a markdown file under `.changeset/`. Commit it with your
PR. Multiple changesets per PR are fine.

If a PR doesn't need to ship anything (docs, internal refactor, CI
config), no changeset is needed.

### When the "Version Packages" PR appears

The release workflow opens a PR titled "chore(release): version packages"
on every push to main that has pending changesets.

That PR:
- Bumps versions in each affected package's `package.json`
- Writes per-package `CHANGELOG.md` entries
- Removes the consumed changeset files

Review the PR. Merge when satisfied. The same workflow then runs
`changeset publish` and uploads the new versions to npm.

### After publish

- New versions appear under <https://www.npmjs.com/org/protocolwealthos>
- Consumers update via `pnpm add @protocolwealthos/pii-guard@latest` (or whatever
  package they need)
- Each release commit is tagged automatically (e.g., `@protocolwealthos/pii-guard@0.2.0`)

---

## Local publish (emergency only)

If the GitHub Actions release breaks and you need to publish manually:

```bash
pnpm install
pnpm build
pnpm changeset:version    # rewrites package.json versions + CHANGELOGs
git add -A && git commit -m "chore(release): version packages"
NPM_API_KEY=<token> pnpm changeset:publish
git push origin main --tags
```

Avoid this — the workflow path captures provenance metadata and is
auditable.

---

## Provenance

The release workflow sets `NPM_CONFIG_PROVENANCE=true` so each published
package carries a [npm provenance attestation](https://docs.npmjs.com/generating-provenance-statements).
This proves the tarball was built by the CI workflow on a specific
commit — useful for supply-chain trust.

Provenance requires the `id-token: write` permission on the workflow,
which is set in `release.yml`.

---

## Notes for AI agents

- Always run `pnpm changeset` after non-trivial code changes to a
  publishable package. Skipping this means changes won't ship.
- Don't bump version numbers in `package.json` directly — Changesets
  manages them.
- Don't run `npm publish` directly — the workflow handles it.
- The `restricted` access in `.changeset/config.json` was changed to
  `public` so packages publish under `@protocolwealthos` scope as public packages.
- All packages share `pnpm-lock.yaml` at the root; the release workflow
  uses `--frozen-lockfile` so any lockfile drift fails CI.
