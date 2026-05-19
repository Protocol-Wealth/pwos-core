# Canonical Patterns

This document catalogs the canonical patterns extracted from the Protocol Wealth estate that pwos-core's primitive packages compose against. Each pattern lives as an ADR or design doc in the PW estate's `shared/` repo (private, but the canonicals here reference the public-readable architecture); the pwos-core packages are the npm-published, framework-agnostic implementation surface.

**Purpose:** When an adopter pulls `@protocolwealthos/pii-guard` or `@protocolwealthos/audit-log` into their own RIA / FINRA / family-office stack, the package gives them the primitives. The *pattern* — how the primitives compose at production scale, where the trust boundaries sit, what fails closed vs fails soft — lives here.

**Tier convention:** Patterns are tiered by maturity. **CANONICAL** = ACCEPTED ADR + first production consumer landed. **REVISION** = canonical pattern with one or more codified revisions from production experience. **EMERGING** = pattern in active codification with at least one production consumer.

---

## 1. PII_TAGS canonical map + prompt-construction exclusion middleware

**Status:** REVISION 3 (`shared/architecture/decisions/ADR-PII-tagging.md`)

**One-line:** Schema-level `pii.{high, medium, low}` tagging at ingestion + structural exclusion at prompt-construction; replaces the disciplinary "developer remembers to scrub" pattern with a fail-closed middleware boundary.

**Why the pattern exists:** PW's defensible narrative to regulators and partners is **"PII never sent to any LLM"** — stronger than "PII scrubbed before going to a cloud LLM" because the latter depends on every prompt-construction site doing the right thing. Schema-level tagging at ingestion + a single middleware boundary at prompt construction makes the property structural.

**Tag taxonomy:**

- `pii.high` — direct identifiers, regulated NPI, account-control credentials. Fail-closed at prompt construction; excluded from any LLM-bound payload unless an explicit `pii_waiver` token authorizes the specific field path.
- `pii.medium` — quasi-identifiers and financial context. Pass-through to LLM context by default; logged at audit when surfaced.
- `pii.low` — non-identifying public context. Pass-through; not logged at field level.

**pwos-core packages that compose against this pattern:**

- `@protocolwealthos/pii-guard` — 4-layer scanner (regex + NER + financial recognizers + allow-list) as the inbound/audit pipeline backstop; sits behind the schema tags as defense-in-depth
- `@protocolwealthos/ai-guardrails` — `assertWorkspace()` (ZDR fail-fast) + `markCacheable()` (Anthropic prompt-cache markers with PII boundary check) + `buildAuditRow()` (content-free audit-row builder)
- `@protocolwealthos/audit-log` — emits `pii.field.excluded` + `pii.waiver.consumed` + `pii.medium.included` rows at the middleware boundary

**Independent PII egress canary backstop:** Three-byte-identical-copy pattern — middleware at the centralized pw-api layer + re-implemented byte-identical canaries at every Anthropic-SDK egress site (pw-os-v2 + pw-portal-v2). Deliberately not a shared module so the layers cannot share a bug. See pattern #6 below.

**Adoption notes:** Add the `pii_tags JSONB` column to your ingestion tables in your first migration; wire the prompt-construction middleware at every LLM call site (single boundary; not per-call); reserve the `pii_waiver` shape for explicit time-bounded operator overrides.

**Canonical reference:** `shared/architecture/decisions/ADR-PII-tagging.md` R3.

---

## 2. Sentinel-row reconciliation for WORM / immutable-row tables

**Status:** REVISION 3 (`shared/architecture/decisions/ADR-gcs-worm-audit-mirror.md`)

**One-line:** Canonical retry shape for WORM-mirrored or BEFORE-UPDATE-immutable tables — retry emits a NEW row referencing the failed row's ID; never UPDATEs the failed row; recursion guard prevents infinite loops.

**Why the pattern exists:** SEC Rule 17a-4 storage substrate is fundamentally immutable — bucket-level retention lock on GCS is cryptographically irreversible for the retention window. Postgres rows mirroring to WORM storage cannot be UPDATEd on transient mirror failure without violating the immutability invariant. The sentinel-row pattern preserves the invariant: every retry is a new append-only row that audit-trails the recovery itself.

**Mechanics:**

1. Failed write to immutable table → emit a sentinel row referencing the failed row by ID
2. Sentinel row carries the action verb suffix `*.retry_mirror` (or equivalent) so retention queries can filter
3. Recursion guard at the sentinel-row writer: if `attempt > MAX_RETRIES`, surface to operator via the standard incident-response surface
4. Reconciliation cron sweeps unresolved sentinel chains nightly; SLA tracking from first-failure-row timestamp

**pwos-core packages that compose against this pattern:**

- `@protocolwealthos/audit-log` — `AuditLogger` + `AuditStore` interface + hash chain; the sentinel-row shape is implementation-agnostic and works against any append-only store
- `@protocolwealthos/compliance` — SEC 204-2 retention calculator + Books-and-Records bundler honor sentinel-row chains as part of chain-of-custody

**Use this for:** `audit_log` itself (live in PW production), `kyc_verifications` / `kyc_sessions` (Component 2 lands day-one with this), `risk_tolerance_*` (Component 3 lands day-one), `signed_document_archive` (Component 4 ships day-one), any future WORM-mirrored or BEFORE-UPDATE-immutable table.

**Canonical reference:** `shared/architecture/decisions/ADR-gcs-worm-audit-mirror.md` R3.

---

## 3. Track B' webhook-receiver primitive

**Status:** CANONICAL (`shared/architecture/decisions/ADR-webhook-receiver-primitive.md` ACCEPTED 2026-05-19)

**One-line:** Single canonical `/v1/webhooks/:vendor` route + six-stage pipeline (verify → dedup → parse → process → audit → DLQ) + per-vendor handler interface; adopts the svix-webhooks pattern in PW-native TypeScript without taking on the operational cost of a Rust service.

**Six-stage pipeline:**

1. **Signature verification** (fail-closed; HMAC-SHA256 hex / base64 / base64url depending on vendor)
2. **Idempotency-key dedup** (vendor-supplied delivery ID; short-circuit on duplicate)
3. **Zod-typed payload parsing** (per-vendor schema)
4. **Per-vendor `process()` execution** (the business-logic boundary)
5. **Canonical `audit_log` write** (uniform shape across vendors; inherits WORM mirror)
6. **Dead-letter capture on failure** (DLQ row + alert; retry semantics per vendor)

**Per-vendor handler interface:**

```ts
interface VendorWebhookHandler {
  verify(rawPayload: string, headers: HeadersInit, secret: string): Promise<boolean>;
  parse(rawPayload: string): VendorEvent;  // Zod-typed
  process(event: VendorEvent): Promise<void>;
}
```

**pwos-core packages that compose against this pattern:**

- `@protocolwealthos/webhooks` — `verifyHmacSha256()` + `verifyTimestampedHmacSha256()` (replay-window) + `verifyDualLayer()` (path-token + Basic Auth for vendors that don't body-sign) + `IdempotencyStore` interface
- `@protocolwealthos/audit-log` — uniform `audit_log` event-shape for every vendor delivery + processing event
- `@protocolwealthos/workflow-engine` — DLQ + retry primitives for the dead-letter path

**First production consumer:** Veriff handler (Component 2 KYC; 2026-05-18). Component 4 e-signature substrate adds Anvil handler as second consumer. Component 5 custodian-data adds Quiltt handler. Future custodian webhooks (Altruist v2 API, Schwab if access granted) consume the same primitive.

**Canonical reference:** `shared/architecture/decisions/ADR-webhook-receiver-primitive.md` ACCEPTED.

---

## 4. Multi-agent dispatch infrastructure

**Status:** EMERGING — production-validated; 18 codified ritual items + 5 candidates queued for next-iteration close

**One-line:** Coordination protocol for multi-agent code generation at production cadence — fresh-CLI-per-task discipline, Phase 1.5 STOP escalation via AskUserQuestion, sentinel-validation Phase 4, archive-after-CI-success Phase 6, §17 SELF-FIX BOUNDARY, three-strikes rule.

**Core discipline elements:**

- **Fresh CLI per dispatch** — never reuse a session that completed a prior task; context contamination is real
- **CWD discipline** — every Bash invocation prefixed with `cd <absolute-path> &&` (WSL resets CWD between tool calls)
- **Phase 1.5 STOP** — when baseline phase surfaces a premise-invalidating constraint, escalate via AskUserQuestion (~30s decision latency observed across 5+ production dispatches)
- **§17 SELF-FIX BOUNDARY** — worker self-fixes scoped pitfalls in-flight (constraint violations, enum mismatches) without escalating; surfaces out-of-scope bugs for separate fix
- **Phase 4 sentinel-validation** — ESLint sentinel rule + runtime sentinel test catch substitution drift before merge
- **Phase 6 archive-after-CI-success** — `gh pr view <PR#> --json state,statusCheckRollup` polling before archiving as completed
- **Three-strikes rule** — first attempt ships if tests green; second attempt restates hypothesis + gets confirmation; third attempt requires explicit operator direction

**Operator-cost calibration:** Recent sprint (2026-05-18 Component 3 risk-tolerance): 12 PRs landed in 1h 45min wall-clock end-to-end with ~10 operator messages = ~1.2 substantive surfaces per operator-coordination touchpoint.

**Reference:** `shared/dispatch/shared/worker-launch-ritual.md` (18 items; codification cadence ~1 ritual addition per substantive iteration close).

**Note for adopters:** This pattern is operational rather than code-level; pwos-core does not yet publish a dispatch-infrastructure npm package. The ritual document is the canonical; future extraction to an `@protocolwealthos/dispatch-protocol` package is queued as a roadmap item.

---

## 5. Design tokens v1.0 (warm-light parity)

**Status:** CANONICAL v1.0 (`shared/docs/firm/design-system.md`)

**One-line:** Unified design + UX system for advisor + client surfaces (pwos.app + pwportal.app); warm off-white canvas, dark navy type, minimal borders, generous whitespace, calm-confidence tone.

**Token surface (excerpt):**

- Backgrounds — `--color-bg-page: #F5F2EE` (warm off-white), `--color-bg-surface: #FDFCFA`, `--color-bg-elevated: #FFFFFF`
- Type — `--color-text-primary: #1B2B3A` (dark navy-slate), `--color-text-secondary: #5A6A78`, `--color-text-tertiary: #9AA5AF`
- Borders — `rgba(27, 43, 58, 0.10)` subtle, `rgba(27, 43, 58, 0.18)` default

**Design heuristic when in doubt:** lighter, calmer, more whitespace. Avoid the gamified-fintech (Robinhood), dense-terminal (Bloomberg), aggressive-navy-orange (typical fintech) idioms.

**Banned words from any UI/marketing copy:** `powerful`, `seamless`, `robust`, `leverage` (per design-system §2 voice-and-tone canonical).

**Consumable artifacts referenced in the v1.0 canonical:**

- `shared/brand/design-tokens.css` — CSS custom-properties file mirroring §1 tokens; importable directly OR via npm package
- `shared/brand/tailwind-preset.js` — Tailwind v4 preset wrapping §1 tokens for both apps' Tailwind configs

**Adopter posture:** RIAs deploying their own instance of pwos-core can either consume the design-tokens.css directly or override with their own brand tokens — the system is designed to make tone consistent at the structural level (whitespace, hierarchy, surface elevation) while letting color + type be brand-customized.

**Canonical reference:** `shared/docs/firm/design-system.md` v1.0.

---

## 6. PII egress canary (three-byte-identical-copy pattern)

**Status:** CANONICAL — production at every Anthropic-SDK egress site in the PW estate

**One-line:** Three independent copies of identical PII-detection logic at distinct trust layers — middleware at pw-api + re-implemented canaries at every Anthropic-SDK egress site (pw-os-v2 + pw-portal-v2). Deliberately not a shared module so the layers cannot share a bug.

**Why "deliberately not shared":** A shared module would mean a single regex pattern change propagates to all three layers simultaneously — which sounds like a feature, but means a bug in the shared module is a bug at all three layers. The three-byte-identical-copy pattern is the inverse: when a pattern change is needed, it lands in three PRs against three repos with explicit drift-checking CI (`scripts/check-pii-tags-drift.sh`).

**Where this pattern matters most:** Outbound LLM API calls (Anthropic SDK) where the PII boundary is the last line of defense between the firm's data substrate and a third-party AI provider. Even with ZDR workspace enforcement upstream, the canary is the per-call structural verification.

**pwos-core packages that compose against this pattern:**

- `@protocolwealthos/pii-guard` — the canary primitive; intentionally embed copies (not import shared) at each egress site
- `@protocolwealthos/ai-guardrails` — `assertWorkspace()` ZDR fail-fast + `buildAuditRow()` content-free audit-row builder

**Subtle gotcha (codified 2026-05-16):** The canary's email-block fundamentally conflicts with routes whose payload-shape is intentionally identifier-bearing (sender-email classification). Audit prompt-shape first before wrapping; the pattern is suitable for outbound-broadcast surfaces, not for inbound-classifier surfaces with identifier-bearing fixtures. See memory anchor `canary-vs-classifier-route-conflict` in the PW estate for the codified scope.

**Canonical reference:** `shared/strategy/CURRENT-STATE.md` AI surface section; production loci at `pw-os-v2/apps/api/src/lib/claude-client.ts` + `pw-portal-v2/apps/api/src/lib/anthropic-client.ts`.

---

## 7. Three-tier agent memory architecture (per-client / per-advisor / per-firm)

**Status:** EMERGING (`shared/architecture/decisions/ADR-three-tier-agent-memory.md` DRAFT 2026-05-19; promotion to ACCEPTED gated on first production consumer landing — Component 7 Week 3 pwos.app/agents v0.1)

**One-line:** Three distinct memory scopes for AI agents in an RIA context — per-client (existing client_profile + audit_log principal-chain queries; no new schema), per-advisor (new `advisor_memory` table; advisor_id-RLS), per-firm (derived from version-controlled compliance + ADR substrate; no Postgres table). Composed in fixed order at agent-session time; every read writes audit-trail-eligible records.

**Why the pattern exists:** Vendors that launch AI agents don't give RIAs a memory architecture — they give RIAs an opaque vendor-side state surface. The substrate posture is that memory belongs to the RIA, scoped per-client / per-advisor / per-firm, with each tier having distinct retention, access, and audit requirements. Without canonical three-tier substrate, every agent-facing surface reinvents the per-scope enforcement at the application layer — exactly the disciplinary anti-pattern that ADR-PII-tagging.md and ADR-webhook-receiver-primitive.md are built to avoid.

**Tier breakdown:**

| Tier | Data-model home | RBAC | Retention |
|---|---|---|---|
| Per-client | Existing `client_profile` + `audit_log` principal-chain queries (no new schema) | Postgres RLS on `client_id` + principal-chain authorization | 7-year post-relationship per 17 CFR §240.17a-4 |
| Per-advisor | NEW `advisor_memory` table (advisor_id + memory_key + JSONB value) | Postgres RLS on `advisor_id` | 7-year post-departure per 17 CFR §240.17a-4 |
| Per-firm | Derived from version-controlled markdown (`shared/` git history) | Read-only by construction | Git-history unbounded |

**Composition order at agent-session time:** firm (broadest, read-only) → advisor (advisor scope) → client (most-scoped, principal-chain-authorized). Four audit rows per composition (`agent.context.chain_established` + per-tier `_memory_read` rows referencing the anchor row id). The composition is what makes per-scope enforcement structural rather than disciplinary.

**pwos-core packages that compose against this pattern:**

- `@protocolwealthos/audit-log` — principal-chain queries derive per-client decision history + chain-established audit-row anchor + `source_audit_id` back-reference for per-advisor memory entries
- `@protocolwealthos/pii-guard` — 4-layer PII scanner at the memory-read boundary; same exclusion logic as ADR-PII-tagging.md for prompt construction
- `@protocolwealthos/ai-guardrails` — `buildAuditRow()` content-free audit-row builder for the agent's own LLM-call records

**Reference implementation:** [`examples/rias-agent-substrate/`](../examples/rias-agent-substrate/) — storage-agnostic TypeScript composing the three tiers; in-memory implementations for testing + exploration; production consumers swap in Postgres-backed stores with the same contracts.

**Adopter posture:** Three concrete steps to adopt — (1) add the `advisor_memory` migration with advisor_id-RLS; (2) implement the per-tier `MemoryStore` interfaces against your Postgres connection; (3) implement `FirmMemorySource.read()` as a build-time derivation step from your `shared/`-equivalent substrate. The composition contract is what's canonical; storage implementation is yours.

**Adopter-facing companion doc:** [`docs/three-tier-agent-memory-architecture.md`](./three-tier-agent-memory-architecture.md) — public-readable architecture explainer with mermaid diagrams + tier-by-tier substrate enforcement + adopter playbook.

**Canonical reference:** `shared/architecture/decisions/ADR-three-tier-agent-memory.md` DRAFT (consumer-side, private). Promotes to ACCEPTED on first production consumer landing.

---

## Cross-pattern references

The seven patterns above are not independent — they compose:

- **Patterns 1 + 6** form the PII defense-in-depth: schema tags at ingestion (#1) + structural exclusion middleware (#1) + three-layer egress canary (#6).
- **Patterns 2 + 3** form the audit-trail substrate: WORM-mirrored audit_log with sentinel-row reconciliation (#2) carries every webhook delivery + processing event from the canonical receiver primitive (#3).
- **Patterns 1 + 2 + 7** form the agent-memory substrate: PII tagging (#1) at the memory-read boundary + audit-log principal-chain queries (#2) as the per-client memory backbone + three-tier composition (#7) as the substrate-architecture overlay.
- **Pattern 4** is the operational layer that ships the others — multi-agent dispatch landed Components 2 + 3 + 4 in three consecutive iterations against the substrate from patterns 1 + 2 + 3; Component 7 implementation extends to pattern 7.
- **Pattern 5** is the user-facing visible layer — the substrate from 1-4 + 6 + 7 is what makes the calm-confidence tone of pattern 5 substantiated rather than performative.

---

## Roadmap — additional patterns queued for extraction

Codification candidates from recent iteration closes (not yet authored as ADRs or published in pwos-core):

- **Adam-CCO 17-pick batched routing canonical** — single REVIEW PR carrying multiple cross-component CCO picks; ~33 min Adam turnaround validated; ~10x operator efficiency vs per-pick routing
- **START-IMMEDIATELY subagent pattern** — Agent subagent with explicit lead-in evades the 600s watchdog kill for substantive doc-authoring class; 3x validated
- **Edit-before-git-mv pitfall workaround** — `git mv` after `Edit` stages HEAD-blob; required follow-up commit pattern
- **Workers re-anchor on origin/main before archive** — archive PRs must `git checkout -b <archive-branch> origin/main` explicitly (not bare `git checkout -b` which inherits current HEAD with potential orchestrator-WIP)
- **Sentinel-row pattern extension** to `kyc_verifications` + `signed_document_archive` + future WORM-mirrored tables (codified day-one in Components 2 + 3 + 4; pattern itself canonical at ADR-gcs-worm R3)

---

## Contributing patterns back

If you have adopted a pwos-core primitive in production and codified a pattern around it that would help other adopters, we welcome ADR-style contributions to this catalog. Open a PR against `docs/CANONICAL-PATTERNS.md` with:

- One-line summary
- Status tier (CANONICAL / REVISION / EMERGING)
- Why-the-pattern-exists framing
- Mechanics + adoption notes
- Canonical reference (your own ADR or design doc URL is fine; we'll link out)

See [CONTRIBUTING.md](../CONTRIBUTING.md) for general contribution guidelines.
