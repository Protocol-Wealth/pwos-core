# HANDOFF — `pwos-core` (open-source repo)

Cross-repo wiring the parallel private-estate session must pick up. This file
tracks open work that crosses the public/private boundary, so it lives in the
public tree where both sessions can see it.

Branch: `feat/cfp-governance-hardening`
Most recent commit at last update: see `git log -3` on the branch.

---

## Tier 1 — governance hardening + README clarifications (CFP-substrate iteration)

**Status: shipped to the feature branch as of 2026-05-27, pending operator
go/no-go review before any push to `main` or any Tier-2 work begins.**

### What changed in this repo

- `CONTRIBUTING.md` — full rewrite. Removed references to nonexistent
  `.env.example`, `pnpm migrate`, `pnpm seed`, and `apps/web/`. Expanded the
  Package Layout section from the outdated 9-package list to the full 18
  packages currently in `packages/*`. Added an explicit SPDX-header section
  with the canonical two-line TS block, a Conventional Commits expectation,
  a hermetic-tests posture (no network / no live keys / no real client or
  vendor data), and a `pnpm changeset` step in the PR checklist.
- `SECURITY.md` — replaced the inherited `XBRL/SEC data integrity` in-scope
  line (a nexus-core capability, not a pwos-core one) with four lines naming
  the primitives this repo actually owns the security posture for:
  `@protocolwealthos/pii-guard` (4-layer pipeline), `@protocolwealthos/audit-log`
  (hash-chain tamper evidence), `@protocolwealthos/mcp-tools` (write-tool
  confirmation gate), and `@protocolwealthos/auth` + `@protocolwealthos/webhooks`
  (HS256 JWT + HMAC posture).
- `CODE_OF_CONDUCT.md` — fixed a project-name typo introduced when this file
  was first copied from `nexus-core` (`Nexus Core` → `PWOS Core`).
- `README.md` — added a `## What's Open vs Private` section between
  *Built on the Shoulders of Giants* and *Quick Start*, mirroring the same
  section in `nexus-core/README.md`. Public = the 18 published packages plus
  the canonical-pattern docs and the `apps/api/` reference scaffold. Private
  = the production orchestrator (in `pw-os-v2`, `pw-api`, `pw-portal-v2`),
  real client data, firm-internal wired vendor clients, production
  thresholds / kill-rule cutoffs / decay constants, and credentials.
- `README.md` — rewrote the Features "Inline Tool Orchestration — LLM
  autonomously selects and executes tools during chat (multi-turn, up to 5
  rounds)" line to remove the unqualified "autonomously" framing. New line
  distinguishes (a) advisor-IDE tool selection inside multi-turn chat from
  (b) client-facing actions, which are gated by the Confirmation Gate
  primitive and require explicit advisor sign-off before any write tool
  affects client state.
- `CHANGELOG.md` — `[Unreleased]` entry under "Changed" capturing all of
  the above.

### Cross-repo wiring required from the private-estate session

- **(governance-doc consistency check)** Open `shared/docs/compliance/opensource-policy.md`
  (private estate canonical) and verify that the license-posture statements,
  patent-posture statements (USPTO #64/034,215 + #64/034,229 + OIN
  membership), and the open/private boundary description still align with
  the new wording landed here. Specifically:
  - The new `## What's Open vs Private` block in pwos-core README sets a
    *settings vs shape* mapping principle ("shape is open, settings are
    private"). If the canonical policy doc uses a different framing,
    reconcile.
  - The rewrite of the "LLM autonomously selects" line in pwos-core README
    asserts that "the framework does not ship an unattended client-action
    mode." If any private-estate marketing copy, factsheet, or website
    page (`pwos.app/opensource`, `protocolwealthllc.com/security`,
    `pwos.app/disclosures`, the canonical `shared/docs/firm/` set) makes a
    stronger autonomy claim, those need to be reconciled too — the public
    README is now the load-bearing public statement.
  - `pwos-core/SECURITY.md` in-scope list now enumerates four primitive-level
    security postures by `@protocolwealthos/*` package name. If any private
    customer / vendor contract or SOC-2 narrative cites the old "XBRL/SEC
    data integrity" wording, update those references — that line was never
    correct for pwos-core.
- **(no production code wiring required for Tier 1)** This iteration is
  documentation-only; no package code or CI workflow changed, no new
  primitives shipped, no schema or interface introduced or modified. The
  private-estate consumer apps (`pw-os-v2`, `pw-api`, `pw-portal-v2`) do
  not need to bump any `@protocolwealthos/*` dependency for this work.

### Operator decision required before Tier 2

Tier 2 is the flagship-artifact set (HITL policy schema + fail-closed
evaluator, disclosure-card Zod schema + JSON Schema + validator,
provenance hash-chain utility with tamper-detection tests, eval-harness
v0 with five categories + deterministic runner). It is sketched in the
session brief but **not yet authorized**. This session will not begin
Tier 2 work until the operator explicitly says "go."

If Tier 2 is authorized, the private-estate wiring will expand
substantially. The wiring items expected to land in this HANDOFF after
Tier 2 are (preview, not committed):

- Wire `packages/shared/src/provenance/` hash-chain into the production
  immutable audit trail (the existing `ai_audit_log` Postgres surface in
  the private estate).
- Consume the `packages/shared/src/disclosure/` schema in the PWOS
  Compliance Center UI and at the public `/disclosures` route.
- Register the `packages/shared/src/hitl/` policy in the production tool
  orchestrator and enforce the client-facing gate at the write-tool
  boundary.
- Surface `nexus-core` `explanation` output (Tier-2 N2) in client-facing
  research rendering inside pw-os-v2 / pw-portal-v2.

These four items will only show up here as concrete wiring instructions
after the Tier-2 code lands on this branch. If Tier 2 is declined, this
HANDOFF stays Tier-1-only.

---

## Build + test status at last update

Captured in the checkpoint summary on this branch (see `pwos-core` repo
git log + the operator-facing checkpoint message). If the operator wants
to re-verify before approving the push to `main`, run from repo root:

```bash
pnpm install
pnpm -r build
pnpm -r typecheck
pnpm -r test
```

All three should be green; this iteration touched no code paths.
