# pwos-core — open-source compliance primitives for advisor platforms

> Repo: `Protocol-Wealth/pwos-core` · License: Apache 2.0 · Patent Pending: USPTO #64/034,215 · OIN member.
> Open-source extraction of the [Protocol Wealth Operating System](https://pwos.app); nothing in this repo is client-specific or proprietary to PW.

## What This Is

A pnpm + Turborepo-style monorepo of TypeScript primitives published to npm under `@protocolwealthos/*`. The packages are storage-agnostic, framework-agnostic, and intentionally small — each ships its own README, CHANGELOG, and tests. Consumers pick what they need.

The deployed app at [pwos.app](https://pwos.app) (source in `pw-os-v2`, separate repo) is the reference consumer. **Do not port consumer-side code into this repo** — only generic, reusable primitives belong here.

## Repo Structure

```
pwos-core/
├── packages/
│   ├── pii-guard/         # 4-layer PII scanner + streaming rehydrator
│   ├── audit-log/         # Append-only log with SHA-256 hash chaining
│   ├── mcp-tools/         # Tool registry + tier classification + filters + confirm gate + tool-audit builder
│   ├── compliance/        # SEC 204-2 retention, Books & Records bundler, calendar, incidents
│   ├── workflow-engine/   # Storage-agnostic durable-job runtime
│   ├── document-gen/      # Document model + CSV + plain-text renderer + DocumentRenderer interface
│   ├── onchain-sdk/       # Typed client for on-chain portfolio services
│   ├── crm/               # Contacts / households / interactions / opportunities / tasks
│   ├── email-archive/     # SEC 17a-4 archive primitives
│   └── shared/            # Internal cross-package types (NOT published)
├── apps/api/              # Reference scaffold (NOT published)
├── examples/              # Integration examples
├── docs/
│   ├── attribution.md     # Per-capability provenance
│   └── publishing.md      # Release flow
├── .changeset/            # Queued releases
└── .github/               # CI + release workflows
```

## Tech Stack

| Layer | Choice |
|-------|--------|
| Language | TypeScript 5.6+, strict mode, ESM-only |
| Test runner | vitest 2.1 (per-package) |
| Monorepo | pnpm 9 workspaces (`packageManager` field pinned) |
| Release | Changesets (`@changesets/cli` + `@changesets/changelog-github`) |
| CI | GitHub Actions (release + provenance via `NPM_API_KEY` secret) |
| License | Apache 2.0 + USPTO 64/034,215 defensive patent + OIN |

## Development

```bash
pnpm install
pnpm -r build           # tsc per package → dist/
pnpm -r test            # vitest run per package
pnpm -r typecheck       # tsc --noEmit per package
pnpm changeset          # queue a release entry
pnpm changeset status   # see what's pending
```

Per-package:

```bash
pnpm --filter @protocolwealthos/<name> test
pnpm --filter @protocolwealthos/<name> build
```

## Release Flow

1. Land a feature on `main` with a changeset file under `.changeset/`. Use `minor` for additive APIs, `patch` for fixes, `major` for breaking changes.
2. The Changesets GitHub Action opens a "Version Packages" PR aggregating queued changesets.
3. Merging that PR bumps versions, updates per-package CHANGELOGs, and publishes to npm with provenance.

See [`docs/publishing.md`](docs/publishing.md) for the full flow.

## Conventions

- **No client-specific code.** If something only makes sense for Protocol Wealth, it belongs in `pw-os-v2`, not here.
- **Storage-agnostic by default.** Packages expose pure functions or interfaces; storage implementations are caller-supplied.
- **Frame-agnostic by default.** No Hono / Express / React baked in. Adapters live at the edge of consumer apps.
- **TypeScript strict.** No `any` without a comment explaining why. Zod for runtime validation at boundaries only.
- **One concept per file.** `camelCase.ts` modules.
- **Tests live in `packages/<pkg>/__tests__/`.** Match source file names (`scanner.ts` → `scanner.test.ts`).
- **Each package self-documents.** Every export gets a JSDoc block; the package's `index.ts` is the single source of truth for the public API.
- **SPDX header on every source file** (`// SPDX-License-Identifier: Apache-2.0` + copyright line).
- **Conventional commits** + DCO sign-off (`git commit -s`).

## Adding a Package

1. Create `packages/<name>/` with `package.json`, `tsconfig.json`, `src/index.ts`, `__tests__/`.
2. Mirror an existing package's `package.json` shape — note the `publishConfig` block that swaps `src/` for `dist/` at publish time.
3. Add it to `pnpm-workspace.yaml` (already covered by the `packages/*` glob).
4. Wire dev-deps: `typescript ^5.6.0`, `vitest ^2.1.0`, plus `@types/node ^22.0.0` if you import from `node:*`.
5. Land a changeset describing the new package.

## Adding a Module to an Existing Package

1. Create `packages/<pkg>/src/<module>.ts`. Keep it focused: one concept, ≤ ~250 LOC.
2. Add a JSDoc header block explaining the WHY, not the WHAT.
3. Re-export from `packages/<pkg>/src/index.ts`.
4. Add `packages/<pkg>/__tests__/<module>.test.ts` covering happy path + key edge cases.
5. `pnpm --filter @protocolwealthos/<pkg> test typecheck build` — all three must pass.
6. Drop a changeset under `.changeset/` describing the new exports.

## Boundaries

- No PII / secrets in tests, fixtures, examples, or commit messages.
- No vendor-specific keys. Tests must be hermetic — no network calls.
- No code from AGPL-licensed reference projects (Twenty CRM, Ghostfolio, Wealthfolio, Sure, Firefly III) is copied — patterns only. See [`docs/attribution.md`](docs/attribution.md).
- No `--no-verify` on commits. No skipped hooks.

## Cross-Repo Notes

- `pw-os-v2` (separate repo) is the production consumer running on Cloud Run. When extracting a primitive from there into here, generalize the API — drop framework coupling, drop PW-specific identifiers, expose hooks for caller-specific behavior.
- `pw-portal-v2` (separate repo) is the client-facing surface. Its patterns (passkey, magic-link, advisor-PIN flow) are well-served by existing libs and are NOT planned for extraction.
- The `_reference/` tree (in the parent `pw/` directory) holds historical sources for cross-checking; do not commit anything from it here.
