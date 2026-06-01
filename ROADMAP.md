# pwos-core — Roadmap

> Forward work for the open-source primitive set. For what's published *now* read [`CURRENT-STATE.md`](./CURRENT-STATE.md); for cross-repo wiring the private estate owes read [`HANDOFF.md`](./HANDOFF.md). Living document — items move to CHANGELOG entries as they ship.
>
> **Last verified:** 2026-06-01.

## Done

- **19 packages published** to npm under `@protocolwealthos/*` with provenance (Apache 2.0 / OIN / patent-pending).
- **Flagship governance primitives** — `disclosure-card` (Zod + dep-free JSON Schema adoptable standard), `@protocolwealthos/shared` `hitl` (fail-closed gate) + `provenance` (hash-chain) — published 2026-05-27.
- **`apps/evals/`** eval harness v0 (5 categories, deterministic offline runner, provider-agnostic).
- Governance-doc hardening + autonomy-wording reconciliation (#43–#45).

## Next

| Item | Notes |
|---|---|
| **`zod` v3 → v4 migration** | Dependabot #47 is a major bump; zod 4 has breaking changes. Migrate every zod-importing package together (disclosure-card, mcp-tools, compliance, …) behind one changeset rather than per-package, to avoid a split peer-dep surface for adopters. |
| **Toward 1.0 API stability** | The `0.x` series signals an unstable API. Stabilize the highest-adoption packages first (`disclosure-card`, `pii-guard`, `audit-log`, `shared/hitl`) toward `1.0` once their interfaces have baked through real adopter use. |
| **`apps/evals` expansion** | More fixtures per category + a live-mode reference adapter; this is the credibility surface for the AI-safety claims. |
| **Continued primitive extraction** | As the private estate (`pw-os-v2` / `pw-api`) generalizes a reusable pattern, extract the *shape* here (drop framework coupling + PW identifiers). New packages land with a changeset + per-package README + hermetic tests. |
| **Adopter ergonomics** | Per-package README + `examples/` coverage for the newer packages; an adoption guide for `disclosure-card` (Friday-CFP-standard surface) is in `packages/shared/src/disclosure/README.md`. |

## Cross-repo wiring (private estate consumes; tracked in HANDOFF.md)

These are NOT pwos-core changes — they are the work the private reference consumer (`pw-os-v2` / `pw-api` / `pw-portal-v2`) must do against the published primitives: wire `provenance` into the `ai_audit_log` hash-chain; consume `disclosure-card` in the Compliance Center UI + at `/disclosures` (publish PW's own card — dogfooding); register the `hitl` gate in the production tool orchestrator. Full instructions in [`HANDOFF.md`](./HANDOFF.md).

## Out of scope (by design)

- **No client-specific code** — anything PW-only belongs in `pw-os-v2`, not here.
- **No production orchestrator** — the wired, credentialed, threshold-bearing application lives in the private estate. This repo ships the *shape*; the *settings* stay private.
- **No math engine** — quantitative/analytical logic lives in the sibling `nexus-core` (Python) per the v0.5.0 boundary decision (math in nexus-core; data shapes + audit/compliance hooks in pwos-core).
