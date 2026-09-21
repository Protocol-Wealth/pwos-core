# AGENTS.md — pwos-core

Engineering and regulatory standards for every agent are `~/projects/AGENTS.md`.
Where this file conflicts with that one, that one wins. This file is only what
is specific to this repository. It does not describe what is live.

## What this is

A pnpm workspace of TypeScript primitives published to npm under
`@protocolwealthos/*`. Packages are storage-agnostic, framework-agnostic, and
intentionally small. Consumers pick what they need.

The deployed app at [pwos.app](https://pwos.app) (source in `pw-os-v2`, a
separate repo) is the reference consumer. Do not port consumer-side code into
this repo — only generic, reusable primitives belong here.

```
pwos-core/
├── packages/
│   ├── ai-guardrails/      # Workspace assertion (ZDR) + model allowlist + prompt-cache + content-free audit row
│   ├── audit-log/          # Append-only log + SHA-256 hash chaining + 3 anomaly detectors + approver-separation
│   ├── auth/               # HS256 JWT session + role guard + Workspace-domain restriction + per-agent tokens
│   ├── cache-keys/         # Namespace-enforced cache-key builder with PII pattern rejection
│   ├── compliance/         # SEC 204-2 retention, Books & Records bundler, calendar, incidents, vendor-doc metadata
│   ├── crm/                # Contacts / households / interactions / opportunities / tasks + HouseholdProfile/Goal/Note
│   ├── document-gen/       # Document model + CSV + plain-text renderer + DocumentRenderer interface
│   ├── email-archive/      # SEC 17a-4 archive primitives
│   ├── gcp-helpers/        # Cloud Logging + Cloud SQL IAM picker + Secret Manager loader + frontend error shape
│   ├── holdings/           # Account / Security / immutable HoldingEvent stream + materialized HoldingSnapshot
│   ├── ledger/             # Append-only double-entry + sum-to-zero invariant + bailment-mode shadow ledger
│   ├── mcp-tools/          # Tool registry + tier classification + filters + confirm gate + tool-audit builder
│   ├── onchain-accounting-contract/ # PII-free Nexus accounting v0.2.0 ABI + runtime/JSON schemas + tool defs
│   ├── onchain-sdk/        # Typed client + models for on-chain portfolio services
│   ├── pii-guard/          # 4-layer PII scanner + streaming rehydrator + account-number masker
│   ├── security-headers/   # HSTS / strict CSP / X-Frame / X-Content-Type / Referrer-Policy / Permissions-Policy
│   ├── disclosure-card/    # Machine-readable AI-system disclosure schema (Zod 4 + dep-free JSON Schema); published to npm
│   ├── planning-contract/  # PII-free Roth/IRMAA planning ABI: PlanningContract + RothConversionAnalysis types + JSON-Schema + MCP tool defs (mirrors nexus-core); published to npm
│   ├── shared/             # Cross-package types + two governance primitives (hitl + provenance); published to npm
│   ├── webhooks/           # HMAC-SHA256 verify + dual-layer path-token + Basic Auth + idempotency
│   └── workflow-engine/    # Storage-agnostic durable-job runtime
├── apps/evals/             # Private deterministic eval harness workspace
├── examples/               # Integration examples
├── docs/
│   ├── attribution.md                  # Per-capability provenance
│   ├── gcp-reference-architecture.md   # Generic GCP posture for regulated workloads
│   └── publishing.md                   # Release flow
├── .changeset/             # Queued releases
└── .github/                # CI + release workflows
```

| Layer | Choice |
|-------|--------|
| Language | TypeScript, strict mode, ESM-only |
| Test runner | vitest (per-package) |
| Monorepo | pnpm 9 workspaces (`packageManager` field pinned) |
| Release | Changesets version PR + maintainer local publish |
| CI | GitHub Actions PR CI, SPDX/license checks, version-PR workflow |
| License | Apache 2.0 |

## Commands

Current quick checks:

```bash
pnpm versions:check
pnpm -r build
pnpm -r typecheck
pnpm -r test
pnpm -r lint
```

```bash
pnpm install
pnpm changeset          # queue a release entry
pnpm changeset status   # see what's pending
pnpm lint:publish       # publishConfig must resolve to dist/, not src/
```

Per-package:

```bash
pnpm --filter @protocolwealthos/<name> test
pnpm --filter @protocolwealthos/<name> build
pnpm --filter @protocolwealthos/<name> typecheck
```

## Release flow

1. Land a feature on `main` with a changeset file under `.changeset/`. Use
   `minor` for additive APIs, `patch` for fixes, `major` for breaking changes.
2. The Changesets GitHub Action opens a "Version Packages" PR aggregating
   queued changesets.
3. Merging that PR bumps versions and updates per-package CHANGELOGs.
4. The maintainer publishes locally with `pnpm changeset:publish` after
   `npm login`. The CI workflow intentionally does not publish.

See [`docs/publishing.md`](docs/publishing.md) for the full flow.

## Deploy and CI

- PR CI (`.github/workflows/ci.yml`): `pnpm versions:check`, `pnpm -r build`,
  `pnpm -r typecheck`, `pnpm -r test`, `pnpm -r lint`.
- SPDX headers (`.github/workflows/spdx-headers.yml`) and license compliance
  (`.github/workflows/license-compliance.yml`).
- Version-PR only on `main` (`.github/workflows/release.yml`). Publication is
  maintainer-local; do not add npm publish steps to CI.

## Conventions

- **No client-specific code.** If something only makes sense for Protocol
  Wealth, it belongs in `pw-os-v2`, not here.
- **Storage-agnostic by default.** Packages expose pure functions or
  interfaces; storage implementations are caller-supplied.
- **Framework-agnostic by default.** No Hono / Express / React baked in.
  Adapters live at the edge of consumer apps.
- **TypeScript strict.** No `any` without a comment explaining why. Zod for
  runtime validation at boundaries only.
- **One concept per file.** `camelCase.ts` modules.
- **Tests live in `packages/<pkg>/__tests__/`.** Match source file names
  (`scanner.ts` → `scanner.test.ts`).
- **Each package self-documents.** Every export gets a JSDoc block; the
  package's `index.ts` is the single source of truth for the public API.
- **SPDX header on every source file** (`// SPDX-License-Identifier: Apache-2.0`
  + copyright line).
- **Conventional commits** + DCO sign-off (`git commit -s`).

### Adding a package

1. Create `packages/<name>/` with `package.json`, `tsconfig.json`,
   `src/index.ts`, `__tests__/`.
2. Mirror an existing package's `package.json` shape — including the
   `publishConfig` block that swaps `src/` for `dist/` at publish time
   (enforced by `pnpm lint:publish` in CI), the `prepack` copy step
   (`node ../../scripts/copy-license-notice.mjs && pnpm run build`), and
   `"LICENSE"` + `"NOTICE"` in `files`. Every new subpath export you add must
   have a matching `dist/` entry under `publishConfig.exports` or the
   publish-shape check fails.
3. Add it to `pnpm-workspace.yaml` (already covered by the `packages/*` glob).
4. Wire dev-deps by mirroring an existing package (`typescript`, `vitest`, plus
   `@types/node` if you import from `node:*`).
5. Land a changeset describing the new package.

### Adding a module to an existing package

1. Create `packages/<pkg>/src/<module>.ts`. Keep it focused: one concept,
   ≤ ~250 LOC.
2. Add a JSDoc header block explaining the WHY, not the WHAT.
3. Re-export from `packages/<pkg>/src/index.ts`.
4. Add `packages/<pkg>/__tests__/<module>.test.ts` covering happy path + key
   edge cases.
5. `pnpm --filter @protocolwealthos/<pkg> test`, then `typecheck`, then
   `build` — all three must pass.
6. Drop a changeset under `.changeset/` describing the new exports.

## Boundaries

Do not add consumer-app code, firm-specific settings, real client data, vendor
credentials, or production thresholds to this repo. Those belong in the private
PW estate; `pwos-core` owns reusable package shapes and generic primitives.

- No PII / secrets in tests, fixtures, examples, or commit messages.
- No vendor-specific keys. Tests must be hermetic — no network calls.
- No code from AGPL-licensed reference projects (Twenty CRM, Ghostfolio,
  Wealthfolio, Sure, Firefly III, OpenBB, OpenFisca, PolicyEngine) is copied —
  patterns only. Clean-room re-derivation when an architectural pattern is
  genuinely useful (e.g. `@protocolwealthos/ledger` is inspired by Beancount's
  GPL-2 data model; `@protocolwealthos/holdings` is inspired by Sure's AGPL
  holdings-as-events pattern). See [`docs/attribution.md`](docs/attribution.md).
- GPL-2 / GPL-3 / AGPL code may be **read for architectural patterns** but
  every byte committed here must be original Apache-2.0 work. Schema-as-facts
  is not copyrightable; specific code expression is. When in doubt, re-derive
  with our own vocabulary.
- No `--no-verify` on commits. No skipped hooks.

`pw-os-v2`, `pw-portal-v2`, `pw-api`, `pw-infrastructure`, `pw-onchain` are
separate consumer / runtime repos. When extracting a primitive from one of them
into here, generalize the API — drop framework coupling, drop PW-specific
identifiers, expose hooks for caller-specific behavior.

`nexus-core` (sibling repo) is the Python analytical surface. Math lives in
nexus-core; data shapes + audit/compliance hooks live in pwos-core. Keep that
split.

## Things that have bitten

- A new subpath export without a matching `dist/` entry under
  `publishConfig.exports` fails `pnpm lint:publish`.
- CI must not publish. Maintainer-local `pnpm changeset:publish` is the
  publish path; putting npm credentials back on the release workflow is a
  regression.
