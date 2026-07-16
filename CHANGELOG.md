# Changelog

All notable changes to PWOS Core will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added — `@protocolwealthos/onchain-accounting-contract` (2026-07-16)

- Added a publish-ready local package mirroring deployed Nexus accounting
  contract `0.2.0`: strict Zod request/response schemas, exact bounded decimal
  strings and aggregate arithmetic, generated Draft 2020-12 structural schema
  hints, version/tool constants, tri-state correlation assessment,
  engine-scoped composition eligibility, exact discovery, and advisor-tier
  read-only tool declarations.
- Hardened response validation against negative proceeds/counters, inconsistent
  disposal and PnL arithmetic, forged completeness/coverage partitions, raw
  wallet-shaped response refs, and unbounded response refs/sources.
- Enforced Nexus-exact UTC holding periods, disposal basis-fee bounds, exact
  known cost-basis totals with unmatched-transfer suppression, and exact
  semantic disposal shortfall sets.
- Required unique in-query price overrides while preserving deterministic
  duplicate query slots, and marked un-echoed decoder counterparties as partial
  rather than fully verified correlation.
- Rejected opening-state replay metadata with pre-period events and complete PnL
  results with unknown-basis open lots; non-transfer classifications that drop
  caller transfer metadata now produce partial correlation.
- Cost-basis and PnL correlation is explicitly `unverifiable` under wire
  contract `0.2.0`; private consumers must bind authenticated requests,
  responses, and immutable audit records until a future coordinated contract
  bump adds a canonical request digest.
- Added synthetic Nexus-derived golden fixtures for historical pricing, event
  decode, account-scoped FIFO cost basis/replay, and realized-PnL output.
- Preserved the public/private boundary: only opaque references and public-chain
  facts cross the contract. Private identity/wallet linkage, egress canaries,
  statement composition, approval, release, and retention remain consumer work.
- Queued the first release through a minor Changeset, intentionally producing
  package `0.2.0` from `0.1.0` source. Package semver and Nexus wire versions are
  independent despite initially matching; nothing was published from this
  feature branch.

### Changed — repo audit, CI, and docs/state hardening (2026-07-01)

- Added PR CI for `pnpm versions:check`, `pnpm -r build`, `pnpm -r typecheck`,
  `pnpm -r test`, and `pnpm -r lint`.
- Added `scripts/check-version-constants.mjs` and synchronized exported
  `VERSION` constants with package manifests.
- Removed stale tracked duplicate PII source under `apps/api/src/services/pii/*`;
  `@protocolwealthos/pii-guard` is the maintained implementation.
- Hardened license scanning to fail closed on install/scan errors.
- Refreshed root state docs (`README.md`, `CLAUDE.md`, `AGENTS.md`,
  `CURRENT-STATE.md`, `ROADMAP.md`, `HANDOFF.md`, `CONTRIBUTING.md`,
  `docs/publishing.md`, `docs/attribution.md`) to match the package workspace,
  local-publish release process, and private/public boundary.
- Added a PlanningContract regression test that keeps public tool descriptions
  aligned with `PLANNING_CONTRACT_VERSION`.

### Added — `@protocolwealthos/planning-contract` (Roth/IRMAA planning ABI) (2026-06-03)

New package: the PII-free TypeScript ABI for the Roth-conversion + IRMAA planning
capability, mirroring the nexus-core Python engine. Ships the `PlanningContract`
input shape, the `RothConversionAnalysis` output shape, the canonical
Draft-2020-12 JSON-Schema (`PLANNING_CONTRACT_JSON_SCHEMA` — a faithful copy of
the nexus-core source of truth), and the MCP tool definitions
(`analyze_roth_conversion`, `sequence_conversions`, `irmaa_headroom`) +
`registerPlanningTools`. Declarations only — the math lives in nexus-core,
reached over the planning gateway; registering the tools lets the agent path
inherit them (with the disclaimer/PII pipeline) for free. PlanningContract
v1.1.0; PII-free by construction (opaque `case_id`, birth years not DOBs,
aggregated balances). Depends on `@protocolwealthos/mcp-tools` for the
`ToolDefinition`/`ToolRegistry` types; published as JS (`dist/`) via the standard
`publishConfig`→`dist` + `prepack` build. **Published to npm as
`@protocolwealthos/planning-contract@0.3.0` (2026-06-03).**

### Changed — `@protocolwealthos/disclosure-card` supports zod 4 → `0.3.0` (2026-06-03)

zod 4 removed the `z.SafeParseReturnType` alias used by `safeParseDisclosureCard`,
which broke the package build and the monorepo Release workflow. Replaced it with
the schema-derived `ReturnType<typeof disclosureCardSchema.safeParse>` (runtime
behavior unchanged); the package now builds against its declared `zod ^4.4.3`.
**Published to npm as `@protocolwealthos/disclosure-card@0.3.0` (2026-06-03).** The
standing release process is maintainer-local `pnpm changeset:publish` after
`npm login`; CI opens/updates the Changesets version PR but intentionally does
not publish.

### Changed — Split `@protocolwealthos/disclosure-card` into its own focused package (2026-05-27)

Pre-publish split — done while nothing is on npm yet (no downstream importers,
no version history to reconcile). The disclosure-card schema is the
flagship adoptable-standard artifact; shipping it buried under
`@protocolwealthos/shared` undersold it and signaled "internal plumbing"
rather than "candidate standard." Promoted to its own focused package
with its own npm surface, its own version stream, and a friendlier
fork-by-name path. HITL gate + provenance hash-chain stay in
`@protocolwealthos/shared`; `apps/evals` stays `"private": true`.

End state: **TWO published packages** —

- **`@protocolwealthos/disclosure-card`** — disclosure schema: Zod
  schema + dependency-free JSON Schema (Draft 2020-12) + validators +
  pre-publish `[VERIFY]` CI gate + synthetic example. The Friday
  artifact's adopter package.
- **`@protocolwealthos/shared`** — HITL gate (fail-closed evaluator +
  default two-class policy) + SHA-256 hash-chained provenance records.

Files moved + manifest changes:

- **`packages/disclosure-card/`** (new workspace package) — created
  with `package.json` (name `@protocolwealthos/disclosure-card`,
  `version: 0.1.0`, `"private": false`, `publishConfig` src→dist swap),
  `tsconfig.json` mirroring `packages/shared/`, and a `prepack` build
  script.
- **`packages/disclosure-card/src/{types,schema,validator,jsonSchema,example,index}.ts`**
  + **`packages/disclosure-card/__tests__/disclosure.test.ts`**
  + **`packages/disclosure-card/README.md`** — all `git mv`'d from
  `packages/shared/src/disclosure/*` + `packages/shared/__tests__/disclosure.test.ts`
  + `packages/shared/src/disclosure/README.md` (history preserved).
- **`packages/disclosure-card/src/index.ts`** — JSDoc header updated
  `@protocolwealthos/shared/disclosure` → `@protocolwealthos/disclosure-card`.
- **`packages/disclosure-card/__tests__/disclosure.test.ts`** — test
  import path fixed from `../src/disclosure/index.js` → `../src/index.js`.
  The load-bearing `[VERIFY]`-marker-trips-the-gate test
  (`assertNoVerifyMarkers` on the bundled synthetic example) survived
  the move intact and still asserts the gate fails on the example.
- **`packages/disclosure-card/README.md`** — every
  `@protocolwealthos/shared/disclosure` import reference updated to
  `@protocolwealthos/disclosure-card`. Cross-package links to
  `@protocolwealthos/shared/hitl` + `@protocolwealthos/shared/provenance`
  now point at GitHub URLs (since these cross-package links can't be
  relative once the READMEs ship on different npm pages). The
  "namespace re-export from shared" sentence was removed (shared no
  longer re-exports disclosure).
- **`packages/shared/package.json`** — `./disclosure` removed from
  both `exports` and `publishConfig.exports`. Description trimmed to
  name HITL + provenance only (with a parenthetical pointing readers
  at the disclosure-card sibling). `disclosure-card` + `ai-disclosure`
  removed from `keywords[]`.
- **`packages/shared/src/index.ts`** — `export * as disclosure from
  './disclosure/index.js'` removed. JSDoc rewritten to "Two sub-paths"
  with a migration-note pointer to the disclosure-card sibling. No
  back-compat shim (nothing has been published yet).
- **`packages/shared/README.md`** — rewritten from "Three sub-modules"
  to "Two sub-modules" with a prominent sibling-package pointer to
  `@protocolwealthos/disclosure-card`. The disclosure section was
  removed; HITL + provenance sections retained verbatim.
- **`packages/shared/src/hitl/README.md`** — cross-link to the
  disclosure card updated to the new package URL (GitHub URL for
  cross-package portability).
- **`.changeset/disclosure-card-initial-public-release.md`** — new
  changeset (minor for `@protocolwealthos/disclosure-card`) describing
  the initial public release.
- **`.changeset/shared-initial-public-release.md`** — rewritten to
  cover the now-trimmed `@protocolwealthos/shared` surface (HITL +
  provenance), with a migration note about the disclosure-card move.
- **`CLAUDE.md`** — package map: shared/ line trimmed; new
  disclosure-card/ line added.
- **`README.md`** — "What's Open vs Private" section: package count
  18 → 19; added "disclosure-card schema" to the enumerated list.
- **`HANDOFF.md`** — Tier-2 and Tier-3 cross-repo wiring items that
  reference the disclosure card now point at
  `@protocolwealthos/disclosure-card` (the dogfooding `/disclosures`
  item, the Compliance Hub UI consumer item).

Build + test verified post-split: `pnpm -r build` exit 0, `pnpm -r
typecheck` exit 0, `pnpm -r test` exit 0; **543 vitest tests passing**
(unchanged — 15 disclosure tests moved from `packages/shared`'s suite
(57 → 42) to `packages/disclosure-card`'s suite (0 → 15); arithmetic
holds). `packages/shared/dist/` no longer carries a `disclosure/`
subdirectory (stale-artifact check clean). Zero remaining unintentional
`@protocolwealthos/shared/disclosure` references in the source tree;
the few remaining mentions are in changesets / changelog / migration
JSDoc, all intentional historical context.

### Changed — Publish prep for `@protocolwealthos/shared`; disclosure-card adoption guide (2026-05-27)

- **`packages/shared/package.json`** — flipped `"private": true` → `"private": false`
  in preparation for the initial public npm release (`0.1.0`). Added a
  `"publishConfig"` block that swaps `src/` for `dist/` at publish time across
  all four exports (root + `./hitl` + `./disclosure` + `./provenance`); the
  build emits `dist/{,hitl/,disclosure/,provenance/}index.{js,d.ts}` and the
  subpath imports resolve from those paths post-publish. Added a `prepack`
  script that runs `pnpm run build`, an `npm view`-discoverable `keywords[]`
  array, and a description rewrite that names the three published primitives.
  The `0.x` version stream signals a pre-1.0 API contract — minor breaking
  changes are permitted until `1.0`.
- **`.changeset/shared-initial-public-release.md`** — new changeset (`minor` for
  `@protocolwealthos/shared`) describing the initial public release. The
  existing pwos-core Release workflow + Changesets GitHub Action will pick this
  up on merge to `main` → open a "Version Packages" PR → publish on that PR's
  merge. No one runs `pnpm publish` directly.
- **`packages/shared/README.md`** — new package-level README (the artifact `npm
  view @protocolwealthos/shared` surfaces). Three sub-module summaries +
  Apache-2.0 + defensive-patent posture statement.
- **`packages/shared/src/disclosure/README.md`** — new adopter-facing disclosure-card
  adoption guide. Firm-agnostic; uses the bundled synthetic example as a starting
  template; documents how to author a card, validate via `parseDisclosureCard` /
  `safeParseDisclosureCard`, consume the hand-rolled JSON Schema without
  TypeScript / Zod (for non-TS adopters), and use the `assertNoVerifyMarkers`
  pre-publish CI gate. This is the documentation that makes the schema
  adoptable as a candidate standard — the Friday artifact's adopter usage doc.
- **`packages/shared/src/hitl/README.md`** — new HITL adoption companion. Define a
  policy → call the fail-closed evaluator → route the action. Documents the
  fail-closed invariant, the canonical two-class default
  (`client_facing_deliverable: mandatory`, `internal_research: optional`), and
  the load-bearing coupling with the disclosure card's
  `humanOversight.clientFacingRequiresApproval` field (the published claim
  and the runtime enforcement MUST agree).
- **`CLAUDE.md`** — updated the one-line description of `packages/shared/`
  to reflect that it now ships a published package with the three governance
  primitives, rather than being internal-only.
- **`apps/evals/`** — **unchanged**, stays `"private": true`. The eval harness
  is a fork-to-use reference scaffold, not an npm primitive.
- **`HANDOFF.md`** — appended a Tier-3 section with three additional
  cross-repo wiring items for the private-estate session: publish PW's OWN
  disclosure card at `/disclosures` on pwos.app + protocolwealthllc.com
  (the dogfooding proof), reconcile autonomy wording across
  `/how-we-work` (pw-website) and `shared/docs/compliance/opensource-policy.md`
  against the now-public README, and update the opensource-policy doc's
  open/private list to include the newly-published primitives. Also flags
  the npm-name stickiness — once `@protocolwealthos/shared@0.1.0` ships, the
  name cannot be reclaimed.

### Added — Tier-2 governance primitives: HITL gate, disclosure card, provenance hash-chain, eval harness v0 (2026-05-27)

- **`packages/shared/`** — bootstrapped into a real workspace package
  (`@protocolwealthos/shared`, `"private": true`). Previously the directory
  contained source files but no `package.json` / `tsconfig.json`, so its
  code was never typechecked or built. Now wired with `zod ^3.23.0` runtime
  dep + subpath exports for `/hitl`, `/disclosure`, `/provenance`.
- **`packages/shared/src/hitl/`** — fail-closed HITL gate. Canonical
  two-class default policy (`client_facing_deliverable: mandatory`,
  `internal_research: optional`). Pure synchronous `evaluateHitl(action,
  policy) -> HitlDecision`. Unknown action class -> `requiresApproval:
  true`. Zod-validated policy + action schemas; `DEFAULT_POLICY` + helpers
  `parseHitlPolicy` + `resolveHitlPolicy`. Dedicated
  `__tests__/hitl.test.ts` with a `"fail-closed invariant"` block.
- **`packages/shared/src/disclosure/`** — disclosure-card primitives.
  Required fields: `systemName`, `version`, `operator` (firm/crd),
  `generatedAt`, `model` (provider/name/version), `inferenceJurisdiction`,
  `dataRetention` (input/output retention days, trainingUse),
  `humanOversight` (tier, clientFacingRequiresApproval, scope),
  `piiHandling` (mode, layerCount), `knownLimitations[]`,
  `regulatoryBasis[]`, `auditTrail` (rule: `"SEC 204-2"`, tamperEvident).
  Zod schema + hand-rolled JSON Schema (Draft 2020-12, zero extra deps)
  + validator (`parseDisclosureCard`, `safeParseDisclosureCard`,
  `assertNoVerifyMarkers` for pre-publish CI gate) + example instance.
  Tests assert the JSON Schema's top-level `required[]` mirrors the Zod
  schema's keys.
- **`packages/shared/src/provenance/`** — SHA-256 hash-chained provenance.
  `NewProvenanceRecord` (caller shape) + `ProvenanceRecord` (chained,
  hashed) + `ProvenanceRedactionSummary` + `ProvenanceApprover`.
  `chainRecord(record, prevHash) -> ProvenanceRecord`; `chainAll(records)
  -> ProvenanceRecord[]`; `verifyChain(records) -> { valid, badIndex?,
  badId?, reason? }`. Eight TAMPER DETECTION tests cover edited content,
  edited prevHash, edited hash, deleted middle record, inserted record,
  reordered chain — each scenario produces a non-`valid` result pointing
  at the first divergent record. Web Crypto -> `node:crypto` fallback for
  Node < 19. Wiring into the production audit trail is OUT OF SCOPE —
  documented in `HANDOFF.md`.
- **`apps/evals/`** — eval harness v0. Five categories
  (`regulatory_hallucination`, `suitability`, `marketing_rule_leakage`,
  `pii_bypass`, `prompt_injection`); 15 synthetic JSON fixtures (3 per
  category); deterministic offline runner that loads + validates every
  fixture but never calls a model; live mode opt-in via `runEvals({ live:
  true, modelInvoke })`. Provider-agnostic — adopters supply
  `modelInvoke({ prompt, system? }) -> string`. Predicate types:
  `must_not_contain`, `must_contain`, `must_not_match`, `must_match`,
  `exact_match_normalized`. Bundles `src/cli.ts` for `pnpm --filter
  @protocolwealthos-apps/evals evals:offline` / `evals:list`. Documented
  in `apps/evals/README.md` (how to add a fixture).
- **`HANDOFF.md`** — extended with Tier-2 wiring contract for the
  private-estate session: provenance hash-chain into `ai_audit_log`,
  disclosure-card surface at the Compliance Hub + `/disclosures` route,
  HITL gate at the tool-orchestrator boundary, `as_of` threading through
  audit-trail replay code paths, and the open governance question on
  whether `@protocolwealthos/shared` should ship as a published npm
  package or stay fork-consumed.
- **Cross-link doc** — `nexus-core/docs/CROSS-LINK-PWOS-CORE.md` (in the
  sibling repo, same iteration) documents the three conceptual join
  points between `nexus-core`'s `ScoreExplanation` + `as_of` and
  `pwos-core`'s disclosure card + provenance chain + HITL gate.
- All new code carries the canonical two-line TS SPDX header
  (`// SPDX-License-Identifier: Apache-2.0\n// Copyright 2026 Protocol
  Wealth, LLC and contributors.`). No private constants, no real client
  / vendor / API data, no published-package code change to the existing
  17 packages.

### Changed — Governance docs parity with `nexus-core`; README open-vs-private + tool-orchestration framing (2026-05-27)

- **`CONTRIBUTING.md`** — full rewrite to match the actual repo: removed references to non-existent `.env.example`, `pnpm --filter @protocolwealthos/api migrate`, `pnpm --filter @protocolwealthos/api seed`, and `apps/web/`; expanded the package layout from the outdated 9-package list to the full 18 currently in `packages/*`; added an explicit SPDX-header section with the two-line TypeScript canonical block; added a Conventional Commits expectation; added the hermetic-tests posture (no network, no live keys, no real client / advisor / vendor data); added a `pnpm changeset` step to the PR checklist. Doc-only; no published-package change.
- **`CODE_OF_CONDUCT.md`** — fixed a project-name typo introduced by an initial copy from `nexus-core` (`Nexus Core` → `PWOS Core`). No policy change.
- **`SECURITY.md`** — replaced the inherited `XBRL/SEC data integrity issues` in-scope line (which is a `nexus-core` capability, not a pwos-core one) with four lines naming the primitives whose security postures this repo actually owns: PII pipeline (`@protocolwealthos/pii-guard`), audit-log hash-chain tamper-evidence (`@protocolwealthos/audit-log`), MCP write-tool confirmation gate (`@protocolwealthos/mcp-tools`), and JWT / HMAC cryptographic posture (`@protocolwealthos/auth` + `@protocolwealthos/webhooks`).
- **`README.md`** — added a `## What's Open vs Private` section between *Built on the Shoulders of Giants* and *Quick Start*, mirroring the same section in `nexus-core/README.md`: explicit enumeration of what the 18 published packages cover vs what stays in the closed PW estate (production orchestrator, client data, firm-internal tools, production thresholds / kill-rule cutoffs / decay constants, vendor credentials). Mapping principle stated: shape is open, settings are private.
- **`README.md`** — rewrote the *Features* "Inline Tool Orchestration — LLM autonomously selects and executes tools during chat (multi-turn, up to 5 rounds)" line to remove the unqualified "autonomously" framing. New line distinguishes (a) advisor-driven IDE tool selection inside multi-turn chat from (b) client-facing actions, which are gated by the Confirmation Gate primitive and require explicit advisor sign-off before a write tool affects client state. The framework does not ship an unattended client-action mode.
- No npm package code change. No CI workflow change. No SPDX / license / patent / OIN posture change.

### Added — Documentation refresh for 2026-05-18 → 2026-05-19 cascade (2026-05-19)

Doc-refresh-only iteration; no code change. Captures the operational depth + recent shipping cadence visible at the README + canonical-patterns surface; pwos-core's published packages and CI workflows unchanged.

- **`README.md`** — added `## Who built this` section anchoring PW as the SEC RIA (CRD #335298) running this substrate; added `## Recent shipping cadence (2026-05-18 → 2026-05-19 cascade)` block summarizing Component 4 e-signature + Component 3 risk-tolerance + Component 2 KYC + chat session naming + Stream Z PII-tagging + design-system v1.0 + worker-launch-ritual hardening (14 → 18 items); added `## Canonical patterns extracted` table mapping six patterns to PW estate canonical ADRs + design docs; added `## How to adopt a canonical pattern` worked-example section with three TypeScript snippets (PII tagging, sentinel-row reconciliation, webhook-receiver primitive); added Canonical Patterns link in Documentation section.
- **`docs/CANONICAL-PATTERNS.md`** — new doc cataloging the six patterns now extracted from the PW estate that pwos-core's primitive packages compose against: (1) PII_TAGS canonical map + prompt-construction exclusion middleware (ADR-PII-tagging R3); (2) sentinel-row reconciliation for WORM / immutable-row tables (ADR-gcs-worm-audit-mirror R3); (3) Track B' webhook-receiver primitive (ADR-webhook-receiver-primitive ACCEPTED); (4) multi-agent dispatch infrastructure (worker-launch-ritual; 18 items + 5 codification candidates queued); (5) design tokens v1.0 warm-light parity (`shared/docs/firm/design-system.md` v1.0); (6) PII egress canary three-byte-identical-copy pattern. Tier conventions defined (CANONICAL / REVISION / EMERGING); cross-pattern composition notes; roadmap for additional patterns queued for extraction; contributing-patterns-back guidance.
- **Cross-reference posture** — pwos-core packages remain the npm-published, framework-agnostic implementation surface; PW estate canonicals (ADRs + dispatch infrastructure + design tokens) remain the operational shape that production deployments inherit. Adopters can take the npm packages standalone or compose against the same canonical patterns — both paths supported.
- **New referenced ADRs landed in pw-shared this cascade:** ADR-signed-document-state-machine (Component 4 e-signature substrate), ADR-anvil-integration (Component 4 vendor integration).
- **No npm package code change.** No CI workflow change. License + patent + OIN posture unchanged. Apache-2.0 + USPTO #64/034,215 defensive-licensing posture preserved.

### Changed — Public-repo honesty disclaimer (2026-05-14)

- **`README.md`** — added `## Status` block before `## What This Is`: pwos-core is a reference framework and starting point, not a production-ready product; adopters are responsible for adding their own PII controls, access control, input validation, authentication, and data-handling boundaries appropriate to their own regulatory and security context; the framework makes no AI-provider data-retention guarantees.
- No claim reconciliation needed in this repo (the README's capability statements are backed by the actual primitive packages — `@protocolwealthos/pii-guard`, `@protocolwealthos/audit-log`, `@protocolwealthos/auth`, `@protocolwealthos/mcp-tools` etc.). Disclaimer-only, no code change. Apache-2.0 + USPTO #64/034,215 defensive-licensing posture unchanged.

### Added — Phase 3b completion (compliance / workflow-engine / crm / email-archive)

Five remaining pwos-core stubs from Phase 3b were extended into
production-ready primitive packages on April 13. Combined with mcp-tools
(below), this completes the 9-package OSS surface area for pwos-core.

**@protocolwealthos/compliance** — SEC Rule 204-2 primitives:
- `RetentionCalculator` with 7 default policies (advisory 5y, audit 7y, etc.)
- `BooksAndRecordsBundle` with SHA-256 chain-of-custody hashes per section
- `evaluateCalendar` for annual/quarterly/monthly recurring obligations
- `classifySeverity` + `summarize` + `notifiableIncidents` for PII tracking
- `policyStatus` / `vendorStatus` + `policiesNeedingReview` / `vendorsNeedingReview`
- 26 vitest tests, typecheck clean

**@protocolwealthos/workflow-engine** — durable-job runtime:
- `Job` / `JobQueue` / `JobHandler` / `Worker` types and primitives
- Backoff: `fixed` / `linear` / `exponential` (+cap) with jitter decorators
- `InMemoryJobQueue` with priority, runAfter, idempotency keys
- `Worker` with retry policy, `PermanentJobError` short-circuit, observer hook
- 24 vitest tests, typecheck clean

**@protocolwealthos/crm** — advisor CRM types + status helpers:
- Contact / Household / Interaction / Opportunity / CrmTask types
- `isStaleContact` / `isOverdueTask` / `isStalledOpportunity` predicates + filters
- `groupByLifecycle` / `pipelineValueByStage` aggregations
- 15 vitest tests, typecheck clean

**@protocolwealthos/email-archive** — SEC Rule 17a-4 primitives:
- `ArchivedEmail` / `ArchiveQuery` / `EmailAttachment` types
- `hashEmail` + `finalizeRecord` + `verifyChain` for chain-of-custody
- `isPurgeable` + `purgeableEmails` for retention enforcement
- `evaluateQuery` in-memory eDiscovery evaluator
- 14 vitest tests, typecheck clean

### Added — mcp-tools extension

**@protocolwealthos/mcp-tools** — library-agnostic MCP tool primitives:
- `ToolDefinition` / `JsonSchema` / `ObjectSchema` / `ToolAnnotations` / `ToolResult` types
- `ToolTier` enum (`PUBLIC` / `ADVISOR` / `CLIENT_FILTERED` / `SENSITIVE`) with `tierRank`, `isAuthorizedFor`, `tierFilter`
- `ToolRegistry` class with `register` / `registerAll` / `upsert` / `find` / `get` / `unregister` / `listForTier` / `listByTags`, plus `ToolNameConflictError` and `ToolNotFoundError`
- Response-filter pipeline (`ResponseFilter` type, `applyFilters` runner) with built-ins:
  - `disclaimerFilter` — attach SEC-compliant text to successful responses
  - `piiRedactionFilter` — mask PII for CLIENT_FILTERED tier (plugs in @protocolwealthos/pii-guard)
  - `publicTierSanitizer` — replace directive language (STRONG BUY → STRONG) for public tier
  - `observerFilter` — audit / metrics hook that cannot block the response path
- Anthropic adapter: `toAnthropicTool` / `toAnthropicTools` emit plain objects shaped for the Messages API — no runtime dep on `@anthropic-ai/sdk`. Strips non-standard JSON-Schema keys.
- 22 vitest unit tests, typecheck clean

### Added — Phase 3b (pii-guard + audit-log + onchain-sdk + document-gen)

**@protocolwealthos/pii-guard** — 4-layer PII scanning pipeline:
- `LAYER1_PATTERNS` — 31 deterministic regex patterns (credentials, crypto,
  financial IDs, personal info, mortgage/RE, platform IDs)
- `detectFinancial` — context-aware CUSIP, account refs, policy numbers
- `AllowList` — configurable allow-list (default: 60+ finance acronyms)
- `detectInjection` — prompt injection detector (22 patterns, 7 categories)
- `validateInput` — input sanitizer (control chars, invisible unicode, script tags)
- `scan` / `rehydrate` — orchestrator with optional NER hook; redaction
  manifest enables round-trip rehydration
- 13 unit tests, all passing

**@protocolwealthos/audit-log** — append-only audit log with hash chaining:
- `AuditLogger` — pluggable ID/clock for deterministic testing
- `AuditStore` protocol + `InMemoryAuditStore` reference impl
- SHA-256 hash chain with `hashEntry` / `verifyChain` for tamper detection
- Works in Node 18+ (dynamic `node:crypto` import) and browsers (Web Crypto)
- 7 unit tests, all passing

**@protocolwealthos/onchain-sdk** — typed client for portfolio tracking services:
- `OnchainPortfolioClient` — configurable base URL, bearer auth, timeout
- Types: `OnchainClient`, `OnchainWallet`, `OnchainBalance`,
  `OnchainSnapshot`, `ProtocolPosition`, `PortfolioSummary`,
  `PerformanceWindow`
- No internal URLs, env vars, or credentials baked in — adapt to any
  portfolio API (your own service, DeBank, Zerion, Covalent)
- 8 unit tests, all passing

**@protocolwealthos/document-gen** — document model + CSV generator:
- Block-based document model: headings, paragraphs (with style hints),
  lists, tables, images, spacers, page breaks
- RFC 4180 CSV export (`rowsToCsv`, `objectsToCsv`, `escapeCsvField`)
- `PlainTextRenderer` — dep-free default, useful for tests + debugging
- `DocumentRenderer` protocol — plug in PDF/PPTX/DOCX via user-supplied adapter
- 8 unit tests, all passing

### Added — Phase 1+2 (scaffolding)
- Attribution infrastructure (NOTICE, THIRD_PARTY_LICENSES.md,
  docs/attribution.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md)
- pnpm monorepo with 9 packages (pii-guard, audit-log, mcp-tools,
  document-gen, onchain-sdk, workflow-engine, crm, compliance, email-archive)
- Root package.json with pnpm workspace configuration
- tsconfig.base.json for shared TypeScript settings
- License compliance CI workflow (forbids GPL/AGPL/SSPL)

### Changed
- Expanded README to include "Built on the shoulders of giants" attribution
- Package.json files for 4 extended packages: added `type: "module"`,
  proper `exports`, devDependencies for TypeScript 5.6+ and vitest 2.1+

## [0.0.1] - 2026-04-12

- Initial public release with PII pipeline scaffolding and Apache 2.0 + patent pending
