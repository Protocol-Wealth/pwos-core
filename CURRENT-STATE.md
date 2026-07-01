# pwos-core — Current State

> Adopter-facing snapshot of what's published and what's live. For the architecture + conventions read [`CLAUDE.md`](./CLAUDE.md); for forward work read [`ROADMAP.md`](./ROADMAP.md); for cross-repo wiring the private estate must pick up read [`HANDOFF.md`](./HANDOFF.md).
>
> **Last verified:** 2026-07-01.

## What's published

**20 package manifests are active under the `@protocolwealthos/*` scope** (Apache 2.0; USPTO patent-pending #64/034,215; OIN member). All are `0.x` — the pre-1.0 series signals an intentionally-unstable API where breaking changes are permitted in minor versions until `1.0`. Release publication is a maintainer-local `pnpm changeset:publish` process; CI opens/updates the Changesets version PR but does not publish to npm.

| Package | Version | Purpose |
|---|---|---|
| `audit-log` | 0.5.0 | Append-only log + SHA-256 hash chaining + 3 anomaly detectors + approver-separation |
| `pii-guard` | 0.4.0 | 4-layer PII scanner + streaming rehydrator + account-number masker |
| `compliance` | 0.4.0 | SEC 204-2 retention, Books & Records bundler, calendar, incidents, vendor-doc metadata |
| `crm` | 0.3.0 | Contacts / households / interactions / opportunities / tasks |
| `mcp-tools` | 0.3.0 | Tool registry + tier classification + filters + confirmation gate + tool-audit builder |
| `ai-guardrails` | 0.2.0 | Workspace (ZDR) assertion + model allowlist + prompt-cache + content-free audit row |
| `auth` | 0.2.0 | HS256 JWT session + role guard + Workspace-domain restriction + per-agent tokens |
| `cache-keys` | 0.2.0 | Namespace-enforced cache-key builder with PII-pattern rejection |
| `disclosure-card` | 0.3.0 | Machine-readable AI-system disclosure schema (Zod 4 + dep-free JSON Schema) — flagship adoptable standard |
| `planning-contract` | 0.3.0 | PII-free PlanningContract v1.1.0 ABI for the Roth-conversion + IRMAA planning capability: `PlanningContract` + `RothConversionAnalysis` types + JSON-Schema + MCP tool defs (mirrors the nexus-core engine) |
| `document-gen` | 0.2.0 | Document model + CSV + plain-text renderer + DocumentRenderer interface |
| `email-archive` | 0.2.0 | SEC 17a-4 archive primitives |
| `gcp-helpers` | 0.2.0 | Cloud Logging + Cloud SQL IAM picker + Secret Manager loader + frontend error shape |
| `holdings` | 0.2.0 | Account / Security / immutable HoldingEvent stream + materialized HoldingSnapshot |
| `ledger` | 0.2.0 | Append-only double-entry + sum-to-zero invariant + bailment-mode shadow ledger |
| `onchain-sdk` | 0.2.0 | Onchain data-shape primitives |
| `security-headers` | 0.2.0 | HSTS / strict CSP / X-Frame / X-Content-Type / Referrer-Policy / Permissions-Policy |
| `shared` | 0.2.0 | Cross-package types + two governance primitives (`hitl` fail-closed gate + `provenance` hash-chain) |
| `webhooks` | 0.2.0 | HMAC-SHA256 verify + dual-layer path-token + Basic Auth + idempotency |
| `workflow-engine` | 0.2.0 | Storage-agnostic durable-job runtime |

`apps/evals/` (eval harness v0) and `examples/rias-agent-substrate/` are private workspace projects — fork-to-use, not published. The old tracked `apps/api/src/services/pii/*` duplicate scaffold was removed because it was not a workspace package and had fallen behind `@protocolwealthos/pii-guard`.

## What shipped recently

- **Repo audit hardening (2026-07-01):**
  - Added PR CI for `build`, `typecheck`, `test`, `lint`, and `versions:check`.
  - Added a version-constant drift guard and synchronized exported `VERSION` constants with package manifests.
  - Removed stale tracked duplicate PII code under `apps/api/src/services/pii/*`; `@protocolwealthos/pii-guard` is the maintained implementation.
  - Hardened license scanning to fail closed instead of emitting an empty report after install/scan failures.

- **`@protocolwealthos/planning-contract` published + zod-4 migration (2026-06-03, #49/#51/#52/#54):**
  - **Package `planning-contract@0.3.0`** — the PII-free TypeScript ABI for the Roth-conversion + IRMAA planning capability (`PlanningContract` + `RothConversionAnalysis` types, `PLANNING_CONTRACT_JSON_SCHEMA`, and the MCP tool defs `analyze_roth_conversion` / `sequence_conversions` / `irmaa_headroom` + `registerPlanningTools`). Declarations only — the math lives in the nexus-core engine. Contract is `PLANNING_CONTRACT_VERSION = 1.1.0` (distinct from the npm package version 0.3.0).
  - **zod 3 → 4 migration (#51)** — `disclosure-card@0.3.0` now builds against `zod ^4.4.3` (`z.SafeParseReturnType` removed → schema-derived `ReturnType<typeof schema.safeParse>`; runtime behavior unchanged). `shared` was already zod-4-clean. This unblocked the Release "build all packages" step.
  - **Publish path (decided process):** `@protocolwealthos` packages publish via local `pnpm changeset:publish` after `npm login` (account `nickrygiel`) — CI intentionally stops at opening/updating the Changesets version PR. Use `pnpm`, not `npm`, so `workspace:^` deps rewrite.

- **CFP-substrate governance hardening (2026-05-27, via #43 + release #44 + docs #45):**
  - **Flagship governance primitives** added to `@protocolwealthos/shared`: `hitl` (fail-closed human-in-the-loop gate, two-class default policy), `disclosure` (the disclosure-card schema), `provenance` (SHA-256 hash-chained records with tamper-detection). `@protocolwealthos/disclosure-card` split into its own published package as the flagship adoptable-standard artifact (Zod + dep-free JSON Schema + `assertNoVerifyMarkers` pre-publish gate).
  - **`apps/evals/`** eval harness v0 — five categories (regulatory_hallucination, suitability, marketing_rule_leakage, pii_bypass, prompt_injection), 15 synthetic fixtures, provider-agnostic deterministic runner.
  - Governance-doc rewrites (CONTRIBUTING / SECURITY / CODE_OF_CONDUCT / README) — package list corrected to the full 19; autonomy wording reconciled ("the framework does not ship an unattended client-action mode"); `What's Open vs Private` section added.
  - `ai-guardrails` README clarified that the workspace assertion enforces the ZDR API-surface boundary (#45).

## Open / private boundary

**Open (this repo):** the 20 package manifests under `packages/*` — generic, storage-agnostic, framework-agnostic primitives (the *shape*) — plus canonical-pattern docs, the private eval harness, and integration examples. **Private (in `pw-os-v2` / `pw-api` / `pw-portal-v2`):** the production orchestrator, real client data, firm-wired vendor clients, production thresholds / kill-rule cutoffs / decay constants, and credentials (the *settings*). Principle: **shape is open, settings are private.**

## Build / test status

Green at last verification. Hermetic tests (no network, no live keys, no real client/vendor data); `pnpm versions:check`, `pnpm -r build`, `pnpm -r typecheck`, `pnpm -r test`, and `pnpm -r lint` all pass locally. PR CI now runs those gates plus SPDX/license workflows.

## Open items

- **Eval harness expansion:** more fixtures and a live-mode reference adapter are tracked in [#73](https://github.com/Protocol-Wealth/pwos-core/issues/73).
- **Adopter examples:** additional runnable examples are tracked in [#74](https://github.com/Protocol-Wealth/pwos-core/issues/74).
- **1.0 stabilization:** core package API stabilization planning is tracked in [#75](https://github.com/Protocol-Wealth/pwos-core/issues/75).
- **Cross-repo wiring:** private-estate feedback against the public governance/planning contracts is tracked in [#76](https://github.com/Protocol-Wealth/pwos-core/issues/76) and [`HANDOFF.md`](./HANDOFF.md) (provenance → `ai_audit_log`; disclosure-card → Compliance Center + `/disclosures`; hitl → tool orchestrator gate).
