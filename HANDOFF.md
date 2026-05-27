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

## Tier 2 — flagship reference modules (CFP-substrate iteration)

**Status: shipped to the feature branch as of 2026-05-27.** Operator
authorized Tier 2 immediately after the Tier-1 checkpoint.

### What landed in this repo (Tier 2)

Four self-contained reference modules. None depend on any other
`@protocolwealthos/*` package; none import private/production code from
elsewhere in the PW estate. `packages/shared/` — previously dead
unbuilt code — was bootstrapped into a real workspace package
(`@protocolwealthos/shared`, `private: true`) with `zod ^3.23.0` as
its single runtime dep. `apps/evals/` was added as a workspace package
(`@protocolwealthos-apps/evals`, `private: true`).

- **`packages/shared/src/hitl/`** — P4: fail-closed HITL gate.
  Two-class default policy (`client_facing_deliverable: mandatory`,
  `internal_research: optional`). Pure synchronous evaluator. Schema +
  evaluator + types + index, plus a dedicated tests file with a
  `describe("evaluateHitl — fail-closed invariant")` block that exercises
  the fail-closed property against `n` unknown-class variants, an empty
  policy, and a partial policy.
- **`packages/shared/src/disclosure/`** — P5: disclosure-card schema.
  Required-field shape from the brief (systemName, version, operator
  {firm, crd}, generatedAt, model {provider, name, version},
  inferenceJurisdiction, dataRetention {input/output retention days,
  trainingUse}, humanOversight {tier, clientFacingRequiresApproval,
  scope}, piiHandling {mode, layerCount}, knownLimitations[],
  regulatoryBasis[], auditTrail {rule: "SEC 204-2", tamperEvident}).
  Zod schema + hand-rolled JSON Schema (Draft 2020-12, zero extra deps)
  + validator (`parseDisclosureCard`, `safeParseDisclosureCard`,
  `assertNoVerifyMarkers`) + example instance + tests including a sync
  check between the JSON Schema's top-level `required[]` and the Zod
  schema's keys.
- **`packages/shared/src/provenance/`** — P6: SHA-256 hash-chained
  provenance records. `NewProvenanceRecord` (caller-supplied unhashed
  shape) + `ProvenanceRecord` (chained, hashed) +
  `ProvenanceRedactionSummary` + `ProvenanceApprover` + `chainRecord` +
  `chainAll` + `verifyChain` returning `{ valid, badIndex?, badId?, reason? }`.
  Eight TAMPER DETECTION tests cover edited content, edited deep field,
  edited prevHash, edited hash, deleted middle record, inserted record,
  reordered chain — each scenario produces a non-`valid` result pointing
  at the first divergent record.
- **`apps/evals/`** — P7: eval harness v0. Five categories
  (`regulatory_hallucination`, `suitability`, `marketing_rule_leakage`,
  `pii_bypass`, `prompt_injection`); 15 synthetic JSON fixtures (3 per
  category); deterministic offline runner that loads + validates every
  fixture but does NOT call any model. Live mode opt-in via
  `runEvals({ live: true, modelInvoke })`. Adopters supply
  `modelInvoke`; the harness is provider-agnostic. Documented in
  `apps/evals/README.md` (how to add a fixture). Bundles a
  `apps/evals/src/cli.ts` for `pnpm --filter @protocolwealthos-apps/evals
  evals:offline` / `evals:list`.

Side-effect: `packages/shared/src/index.ts` was rewritten to re-export
the new modules under `hitl` / `disclosure` / `provenance` namespaces
(in addition to the previously existing flat exports from `constants` /
`types` / `validators`). The package.json declares subpath exports so
`import { evaluateHitl } from "@protocolwealthos/shared/hitl"` also works.

### Cross-repo wiring required from the private-estate session (Tier 2)

Each item is a CONCRETE wiring task. Specific file/area + expected
interface.

1. **Wire `@protocolwealthos/shared/provenance` into the production
   immutable audit trail.**
   - **Where in private estate:** `pw-os-v2/apps/api/src/lib/audit/`
     (the existing `audit_log` / `ai_audit_log` write path).
   - **What to do:** every AI generation that lands in
     `ai_audit_log` should also produce a `ProvenanceRecord` (via
     `chainRecord(record, prevHash)`), with the previous record's hash
     fetched from the most recent prior row in `ai_audit_log` for that
     stream key. The new `prev_hash` + `hash` columns should be added to
     `ai_audit_log` (or a sibling table) so `verifyChain` can replay any
     time window.
   - **Open question for the private session:** should the chain be
     scoped per-(tenant, stream) or global across the tenant? Default to
     per-stream and revisit if exam workflow needs different shape.

2. **Consume `@protocolwealthos/shared/disclosure` in the PWOS Compliance
   Center UI + at `/disclosures`.**
   - **Where in private estate:**
     - UI: `pw-os-v2/apps/web/src/routes/admin/compliance/disclosure-cards.tsx`
       (new route under the existing Compliance Hub Phase B/C surface).
     - Public route: `pw-os-v2/apps/api/src/routes/disclosures.ts` (serve
       the JSON shape directly + serve the hand-rolled JSON Schema at a
       sibling `/disclosures/schema` for adopters / examiners).
   - **What to do:** import `parseDisclosureCard`,
     `assertNoVerifyMarkers`, and `DISCLOSURE_CARD_JSON_SCHEMA` from
     `@protocolwealthos/shared/disclosure`. Persist the
     CCO-edited disclosure-card JSON in a new `compliance.disclosure_card`
     table (one row per published version; append-only). Pre-publish CI
     gate calls `assertNoVerifyMarkers` on the staged row.
   - **Required complementary work:** the disclosure-card values
     themselves are CCO-authored, not auto-generated. The UI surface
     should let the CCO edit + preview + diff before publish. Auto-fill
     fields where the value is unambiguous (firm + CRD from
     `pw-shared` brand config, `auditTrail.rule` always
     `"SEC 204-2"`); leave fields where the value depends on operator
     judgment (regulatory basis, known limitations) as required manual
     input.

3. **Register `@protocolwealthos/shared/hitl` in the production tool
   orchestrator and enforce the client-facing gate.**
   - **Where in private estate:** `pw-os-v2/apps/api/src/lib/tools/`
     (the existing chat-tool dispatcher and the `confirmation-gate.ts`
     / `route-confirm.ts` pair).
   - **What to do:** every chat-tool definition gains a static
     `action_class: ActionClass` field. The dispatcher runs `evaluateHitl`
     before tool execution; when `requiresApproval: true`, the dispatcher
     routes to the existing confirmation-gate flow rather than executing.
     Default policy from `DEFAULT_POLICY`; per-tool overrides via the
     existing tool-tier classification surface.
   - **Boundary:** the HITL gate is the SECOND layer of defense, not the
     only one. The existing 4-tier classification + the existing
     confirmation-gate primitive both stay. HITL adds the
     ACTION-CLASS-based gate above those.

4. **Surface `nexus-core`'s `explanation` output in client-facing
   research rendering.**
   - **Where in private estate:**
     - Narrative-pipeline consumer in `pw-api` and `pw-os-v2`'s research
       rendering paths.
   - **What to do:** read `score_result.explanation.checks_failed`,
     `score_result.explanation.confidence_tier`, and
     `score_result.explanation.regime_signal_contributions` instead of
     re-deriving from the raw `score_result.checks` list. The
     sanitized contract avoids any accidental leak of production
     threshold values into client-facing copy.
   - **Note:** the new `explanation` object on nexus-core's
     `ScoreResult` is sanitized BY CONSTRUCTION (no threshold values,
     no raw signal values). Consumers should NOT pull from
     `score_result.checks[*].threshold` for client-facing output;
     keep that surface internal.

5. **Adopt the `as_of` parameter on every reproducible-replay code
   path.** (Tier-2 N3 spillover into pwos-core wiring.)
   - **Where in private estate:** any place that re-derives a regime or
     a score from historical data — e.g. CCO retrospective reviews,
     audit-trail replay for SEC exams.
   - **What to do:** thread `as_of: date` through to
     `RegimeEngine.classify(as_of=...)` and
     `ScoringFramework.score(ctx, as_of=...)`. The result objects now
     echo `as_of` back on the result, and downstream provenance records
     should include `as_of` in the hashed content so the chain is
     reproducible.

### Open governance question for the operator (Tier 2)

`packages/shared/` is currently `"private": true` in package.json. The
existing convention (per `CLAUDE.md`) is that `shared/` is NOT published.
But the HITL gate, disclosure card, and provenance utility are
intentionally adopter-consumable reference primitives — publishing them
under `@protocolwealthos/shared` (or splitting into three
`@protocolwealthos/{hitl,disclosure,provenance}` packages) would let
adopters `pnpm add` rather than fork.

Decision deferred to the operator. Two reasonable answers:

- **Keep private, ship via fork.** Matches existing convention. Adopters
  who want these primitives copy the source into their fork. Pro: zero
  versioning obligation, no `@protocolwealthos/shared` npm publish step.
  Con: less discoverable; no SemVer contract.
- **Promote to published.** Flip `"private": false`, add the
  `publishConfig` block + a changeset, publish at `0.1.0`. Pro: adopter
  ergonomics. Con: a new npm publish surface to maintain + a new
  versioning lane for governance primitives that will likely move
  faster than the rest of the surface in v0.

Either way, the modules' CODE is unchanged.

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
