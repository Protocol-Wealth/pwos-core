# PWOS Core

> Open source compliance-first AI operating system for SEC-registered investment advisers.

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Patent Pending](https://img.shields.io/badge/Patent-Pending-orange.svg)](https://patentcenter.uspto.gov/applications/64034215)
[![OIN Member](https://img.shields.io/badge/OIN-Member-green.svg)](https://openinventionnetwork.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0+-blue.svg)](https://www.typescriptlang.org/)
[![Contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![GitHub stars](https://img.shields.io/github/stars/Protocol-Wealth/pwos-core?style=social)](https://github.com/Protocol-Wealth/pwos-core/stargazers)

**Live:** [pwos.app](https://pwos.app) | **Demo:** [pwos.app/demo](https://pwos.app/demo) | **Disclosures:** [pwos.app/disclosures](https://pwos.app/disclosures)

## Who built this

Protocol Wealth LLC — an SEC-registered investment adviser (CRD #335298), AI-native by construction. The firm runs its own advisor + client surfaces (pwos.app, pwportal.app) on this substrate, with the regulated-workload posture documented in [`docs/gcp-reference-architecture.md`](docs/gcp-reference-architecture.md). pwos-core is the open-source extraction of the firm's canonical patterns + primitive packages — for community reuse and for OS-licensing prospects who want the same compliance shape inside their own RIA / FINRA / family-office stack.

## Status

This is a reference framework and a starting point, not a production-ready product. It is a work in progress under active, iterative development.

Adopters are responsible for adding their own PII controls, access control, input validation, authentication, and data-handling boundaries appropriate to their own regulatory and security context before any real or sensitive data touches it. Adopters are also responsible for their own AI-provider data-handling posture; the framework makes no data-retention guarantees.

Provided as-is under Apache-2.0.

## Recent shipping cadence (2026-05-18 → 2026-05-19 cascade)

The Protocol Wealth estate ships continuously; pwos-core is the public-facing extraction surface where canonical patterns surface for community reuse. Recent in-estate work (referenced in [`shared/CHANGELOG.md`](https://github.com/Protocol-Wealth/pw-shared) cross-repo log):

- **Component 4 e-signature substrate** — Anvil-canonical 4-doc v1 envelope (IAA + Form ADV Part 2A + Privacy Notice + IPS); `signed_document_archive` + sentinel-row reconciliation day-one; 7-year retention via GCS WORM; PDF/A-2b archival; Rule 204-3 annual re-delivery + material-change re-execution. Two new ADRs (signed-document-state-machine + Anvil-integration) extended the canonical reference set.
- **Component 3 risk-tolerance verification** — substrate + 8 canonical actions + PII_TAGS port + sentinel-row reconciliation; deterministic scoring engine (MIT/Grable FRTS-13 normalize + PW overlay 0-30 + bucket 1-33/34-66/67-100); advisor override surface; needs_review→review_item flow.
- **Component 2 KYC verification** — `kyc_sessions` substrate + 14 canonical actions + Veriff REST + webhook handler (first production consumer of Track B' webhook-receiver primitive; promoted DRAFT → ACCEPTED) + Scorechain AML two-layer (Chainalysis moved off 2026-05-01).
- **Chat session naming** — pw-api + pw-os-v2 substrate landed (PR #353 + #255).
- **Stream Z PII-tagging program** — canonical typed `PII_TAGS` map at pw-api; byte-equal vendored in BFFs; structural prompt-construction middleware; independent PII egress canary at every Anthropic-SDK outbound call (deliberately re-implemented byte-identical pattern sets across BFFs so the layers cannot share a bug).
- **Design system v1.0** — unified PW design + UX system (warm-light parity across pwos.app + pwportal.app); design tokens canonical at `shared/docs/firm/design-system.md` v1.0.
- **Worker-launch-ritual hardening** — expanded 14 → 18 items across the cascade; 5 additional codification candidates queued for next-iteration close.

Full cross-repo activity ledger lives at `shared/CHANGELOG.md` in the private PW estate; the artifacts that materialize here as reusable primitives are listed in the **Canonical patterns extracted** section below.

## For advisors — how to use this repo

If you are an RIA principal, CCO, or technical advisor evaluating your firm's AI-and-compliance substrate, three concrete actions you can take with this repo today:

1. **Fork `pwos-core`.** Apache 2.0 license; no NDA, no contact form. Run the audit-logging + PII-redaction primitives against your own data, in your own GCP project, on your own timeline. The pattern set is documented; the primitives are inspectable.
2. **Use the [advisor's AI vendor audit checklist](https://protocolwealthllc.com/factsheets/advisor-ai-vendor-audit-checklist).** 20 questions any RIA should ask before adopting an AI-enabled vendor — Reg S-P, Rule 17a-4, Marketing Rule §206(4)-1, Rule 204-2, Rule 206(4)-7. Yours to edit, republish, hand to your CCO, or attach to a vendor RFP.
3. **Subscribe to [protocolwealthllc.com/changelog](https://protocolwealthllc.com/changelog).** Public substrate changelog. If we ship something compliance-interesting (or something dumb), you see it. Build-in-public both ways.

### Package → regulation map

The pwos-core primitives map to specific SEC + GLBA + Reg S-P obligations as follows. This is the canonical mapping; individual package READMEs carry the per-primitive substantive detail.

| Package | Regulatory obligation | Primary substrate |
|---|---|---|
| **`audit-log`** | SEC Rule 17a-4(b)(4) preservation + Rule 17a-4(f)(2)(ii) WORM electronic-storage + Rule 204-2 books-and-records | Hash-chained append-only log; anomaly detectors; `assertApprovedByDifferentParty`; Postgres trigger SQL |
| **`pii-guard`** | Reg S-P §248.30(b) safeguards + GLBA non-public-personal-information protections | 4-layer pipeline (regex + NER + financial recognizers + domain allow-list); streaming rehydrator; injection detector |
| **`email-archive`** | SEC Rule 17a-4(f)(2)(ii) electronic-storage retention + Rule 17a-4(b)(4) communications preservation | SHA-256 chain-of-custody hashing; retention enforcement; query evaluator |
| **`ai-guardrails`** | AI governance posture for SEC-registered advisers (Marketing Rule §206(4)-1 attribution + Rule 204-2 communication retention) | ZDR workspace fail-fast; env-aliased model resolver (no hardcoded model strings); cache-marker PII boundary check; audit row builder |
| **`compliance`** | Rule 204-2 books-and-records primitives + Reg S-P §248.30 incident classification | SEC 204-2 retention calculator; Books-and-Records bundler; PII incident classifier; compliance calendar; vendor DD metadata schema |
| **`mcp-tools`** | AI governance — tool-call attribution + write-tool authorization gate + Rule 204-2 tool-call retention | 4-tier tool access classification; response filters; payload-bound `confirmGate()` (write-tool two-turn gate); `buildToolAuditEntry()` |
| **`webhooks`** | Canonical webhook receiver primitive — verify · dedup · parse · process · audit · DLQ — applicable across vendor relationships under Reg S-P §248.30(a)(5) | `verifyHmacSha256` (hex/base64/base64url); `verifyTimestampedHmacSha256` (replay-window); `verifyDualLayer` (path-token + Basic Auth); `IdempotencyStore` interface |
| **`security-headers`** | Web-security baseline (CSP / HSTS / Permissions-Policy / X-Frame-Options) — Reg S-P §248.30(b) safeguards adjacent | `strictBaseline()` CSP (no `'unsafe-inline'`); `applyDevOverrides()` for HMR; `buildHsts()` (preload-eligible); framework-agnostic flat header map |
| **`workflow-engine`** | Review-items state machine + HITL Tier 2 patterns — Rule 206(4)-7 compliance program substrate | Durable-job runtime; backoff strategies (fixed / linear / exponential + jitter); in-memory queue + pluggable backends |
| **`auth`** | SEC Rule 17a-4(g) electronic-records access controls + state privacy access discipline | HS256 JWT (refuses `alg:"none"`; timing-safe); numeric-rank role guard; workspace domain assert; per-agent token sign/verify/scope with revocation |
| **`ledger`** | Rule 17a-3 (broker-dealer) parallel patterns + RIA bailment-mode invariants — applicable to advisor shadow-ledger contexts | Append-only double-entry; five canonical roots; sum-to-zero per (currency, scale); `BalanceAssertion` checkpoints; reverse-only edits; `verifyPooledEqualsClaims` + `detectCustodianDrift` |
| **`holdings`** | Rule 204-2(a)(3) + (a)(13) account / transaction records; SEC 204-2 hash-chainable snapshot retention | `Account` / `Security` (ISIN / CUSIP / SEDOL first-class); immutable `HoldingEvent` stream; `materializeSnapshots()` (deterministic, hash-chainable); `AdvisorAccess` scope hierarchy |
| **`crm`** | Rule 204A-1 client-data handling + Marketing Rule §206(4)-1 communication tracking primitives | Contacts; households; interactions; opportunities; tasks; status/aging helpers; `HouseholdProfile` (versioned) for "financial memory" pattern |
| **`document-gen`** | Rule 204-2(a)(11) communications retention substrate | Document model; RFC 4180 CSV; plain-text renderer; `DocumentRenderer` interface (PDF / PPTX / DOCX backends) |
| **`onchain-sdk`** | Custody Rule §275.206(4)-2 relevant for crypto-touching advisors (typed RIA-shadow-portfolio surfaces, NOT custody itself) | Typed client + models for on-chain portfolio services |
| **`onchain-accounting-contract`** | Rule 204-2(a)(3)/(13) recordkeeping and digital-asset tax-awareness substrate; not a tax return or tax advice | PII-free Nexus accounting v0.2.0 request/response ABI; exact decimal strings; FIFO/replay/lineage/completeness schemas; read-only tool declarations |
| **`gcp-helpers`** | SEC Rule 17a-4(f)(2)(ii) electronic-storage substrate + structured-logging Reg S-P §248.30(b) adjacent | `createCloudLogger()` (JSON-line structured logging); `pickConnectionStrategy()` (Cloud SQL IAM auth, refuses silent password fallback); `createCachingSecretLoader()`; `buildFrontendErrorReport()` |
| **`cache-keys`** | Reg S-P §248.30(b) safeguards — cache-key PII isolation | Namespace-enforced builder (`vendor:resource:identifier`); PII pattern rejection (email / SSN / credit card / US phone / UUID); `hashed()` escape hatch |

**Mapping principle:** each primitive is a substrate that *enables* an RIA to meet a regulation, not a replacement for the RIA's CCO judgment on that regulation. Use the primitive; document the use in your `Rule 206(4)-7` annual review; let your CCO bind the substrate to your firm's specific obligations. This package does not provide legal advice.

### License

**Apache License 2.0** — the canonical [`LICENSE`](LICENSE) file is the authoritative source. Apache 2.0 was chosen deliberately over MIT for two reasons: (1) the patent-grant clause aligns with PW's defensive-patent posture (provisional patents 64/034,215 + 64/034,229 + 64/082,241; OIN membership); (2) any RIA forking PW's substrate inherits the patent grant alongside the code. MIT works for primitives; Apache 2.0 is the right license for substrate that another RIA's compliance posture depends on.

Sibling repository [`nexus-core`](https://github.com/Protocol-Wealth/nexus-core) (production MCP server foundation; live at [nexusmcp.site](https://nexusmcp.site); ~243 financial-data tools) carries the same Apache 2.0 + defensive patent license.

### Cross-references — PW public surfaces

| Surface | Purpose |
|---|---|
| [`protocolwealthllc.com/security`](https://protocolwealthllc.com/security) | Public security posture — ZDR + PII guard + WORM audit + signing posture + verification pathways |
| [`protocolwealthllc.com/changelog`](https://protocolwealthllc.com/changelog) | Public substrate changelog — sanitized cross-repo shipping ledger; build-in-public Tier-1 |
| [`protocolwealthllc.com/factsheets`](https://protocolwealthllc.com/factsheets) | Public fact-sheet kit — 5 substrate-education documents incl. the advisor's AI vendor audit checklist |
| [`pwos.app/live`](https://pwos.app/live) | Engineering substrate transparency dashboard — PR activity + CI status + ADR counts + static posture indicators |
| [`nexusmcp.site`](https://nexusmcp.site) | Sibling repo `nexus-core` production MCP foundation — ~243 financial-data tools surfaced as MCP-protocol tools |
| [`protocolwealthllc.com/subprocessors`](https://protocolwealthllc.com/subprocessors) | Canonical subprocessor list — 16 vendors in PW's production stack with attestations |

**Note (2026-07-01):** These public surfaces live outside this repo. Verify them directly before treating their current runtime state as part of a release decision.

## What This Is

PWOS Core is the open source foundation of the [Protocol Wealth Operating System](https://pwos.app) — a self-hosted AI platform built for SEC-registered investment advisers (RIAs), FINRA-regulated financial advisors, family offices, and anyone who needs regulatory-grade compliance in AI-assisted financial operations.

**This is not a toy.** It was built and tested in production by an SEC-registered RIA (Protocol Wealth LLC, CRD #335298) with real compliance requirements.

## Capability Surface

- **PII and AI guardrails** — PII scanner, streaming rehydrator, prompt-injection detector, account masker, cache-prefix PII boundary, model alias resolver, ZDR workspace assertion, content-free audit rows.
- **Audit and governance** — Append-only audit log, recursive canonical JSON hashing, anomaly detectors, approver-separation guard, provenance hash-chain, fail-closed HITL evaluator, disclosure-card schema.
- **Tool and workflow primitives** — MCP tool registry, tier classification, response filters, payload-bound confirmation gate, tool-call audit builder, durable-job interfaces, backoff strategies.
- **Security and integration boundaries** — HS256 JWT/session helpers, scoped agent tokens, role/domain guards, webhook HMAC and dual-layer verification, idempotency, security headers, cache-key PII rejection.
- **Advisor data shapes** — Ledger, holdings, CRM, document model, email archive, on-chain portfolio client/types, GCP helper interfaces.
- **Planning ABI** — PlanningContract v1.1.0 snake_case TypeScript contract, Roth/IRMAA result types, JSON Schema, and MCP planning tool definitions. Math lives in `nexus-core`.
- **Onchain accounting ABI** — Nexus contract v0.2.0 strict runtime schemas and structural JSON hints for de-identified historical pricing, event decode, account-scoped FIFO replay, and realized-PnL output. Math lives in `nexus-core`; client linkage and statements stay private.
- **Eval and examples** — Private deterministic AI-safety eval harness under `apps/evals/` and a composed RIA agent-substrate example under `examples/rias-agent-substrate/`.

## What You Get From npm

The `@protocolwealthos/*` packages are what's published. The deployed app at [pwos.app](https://pwos.app) is the reference consumer; you can use the packages standalone or compose them into your own platform.

### Compliance + audit primitives

| Package | Headline primitives |
|---------|---------------------|
| **`@protocolwealthos/pii-guard`** | `scan()` + `rehydrate()` (4-layer pipeline) · `createStreamRehydrator()` (chunk-safe) · injection detector · input validator · `maskAccountNumber()` (show-last-4) |
| **`@protocolwealthos/audit-log`** | `AuditLogger` + `AuditStore` interface · SHA-256 hash chaining · `verifyChain()` · three anomaly detectors (off-hours / rapid-sequential / new-actor-on-admin) · `assertApprovedByDifferentParty` · Postgres append-only-trigger SQL template |
| **`@protocolwealthos/mcp-tools`** | `ToolRegistry` + 4-tier access classification · response filters · Anthropic adapter · `confirmGate()` (payload-bound write-tool gate) · `buildToolAuditEntry()` |
| **`@protocolwealthos/compliance`** | SEC 204-2 retention calculator · Books-and-Records bundler with chain-of-custody · PII incident classifier · compliance calendar · `VendorDocMetadata` schema (SOC 2 / DPA / pen-test advisory metadata) |

### AI safety primitives

| Package | Headline primitives |
|---------|---------------------|
| **`@protocolwealthos/ai-guardrails`** | `assertWorkspace()` (ZDR fail-fast) · `createModelResolver()` (env-aliased model strings, no hardcoded literals) · `markCacheable()` (Anthropic prompt-cache markers with PII boundary check) · `buildAuditRow()` (sha256 of prompt + response + tool_use; no raw content) |

### Governance + planning primitives

| Package | Headline primitives |
|---------|---------------------|
| **`@protocolwealthos/shared`** | `hitl` fail-closed approval gate · `provenance` SHA-256 hash-chain records · shared constants/types |
| **`@protocolwealthos/disclosure-card`** | Zod 4 disclosure-card schema · dependency-free JSON Schema · `assertNoVerifyMarkers()` pre-publish gate |
| **`@protocolwealthos/planning-contract`** | PlanningContract v1.1.0 snake_case Roth/IRMAA ABI · result types · JSON Schema · MCP tool definitions |
| **`@protocolwealthos/onchain-accounting-contract`** | Nexus accounting v0.2.0 strict runtime + structural schema hints · exact decimal/partition validation · tri-state correlation · engine-scoped composition eligibility · read-only tool definitions |

### Auth + access primitives

| Package | Headline primitives |
|---------|---------------------|
| **`@protocolwealthos/auth`** | HS256 JWT session sign/verify (~80 LOC, refuses `alg:"none"`, timing-safe) · `createRoleGuard()` (numeric-rank hierarchy) · `assertWorkspaceDomain()` · `signAgentToken()` / `verifyAgentToken()` / `hasScope()` for per-AI-agent scoped access with revocation |
| **`@protocolwealthos/webhooks`** | `verifyHmacSha256()` (hex / base64 / base64url) · `verifyTimestampedHmacSha256()` (replay-window) · `verifyDualLayer()` (path-token + Basic Auth for vendors that don't body-sign) · `IdempotencyStore` interface |
| **`@protocolwealthos/cache-keys`** | Namespace-enforced builder (`vendor:resource:identifier`) with PII pattern rejection (email / SSN / credit card / US phone / UUID) · `hashed()` escape hatch for high-entropy identifiers |
| **`@protocolwealthos/security-headers`** | `strictBaseline()` CSP (no `'unsafe-inline'`; sha256-hash helpers for inline scripts) · `applyDevOverrides()` for HMR · `buildHsts()` (preload-eligible) · locked-down `Permissions-Policy` defaults · framework-agnostic flat header map |
| **`@protocolwealthos/gcp-helpers`** | `createCloudLogger()` (JSON-line structured logging) · `pickConnectionStrategy()` (Cloud SQL IAM auth, refuses silent password fallback) · `createCachingSecretLoader()` · `buildFrontendErrorReport()` for React/Vue error boundaries. Zero `@google-cloud/*` deps |

### Financial-data primitives

| Package | Headline primitives |
|---------|---------------------|
| **`@protocolwealthos/ledger`** | Append-only double-entry ledger · five canonical roots · sum-to-zero invariant per (currency, scale) · `BalanceAssertion` data-integrity checkpoints · reverse-only edits · bailment-mode invariants (`verifyPooledEqualsClaims`, `detectCustodianDrift`, `claimsByClient`) for advisor shadow ledgers |
| **`@protocolwealthos/holdings`** | `Account` / `Security` (ISIN / CUSIP / SEDOL first-class) · immutable `HoldingEvent` stream (buy / sell / dividend / split / transfer / mark) · `materializeSnapshots()` (deterministic, hash-chainable for SEC 204-2) · `AccountBalance` with inflow/outflow decomposition for TWR/MWR · `AdvisorAccess` scope hierarchy |
| **`@protocolwealthos/crm`** | Contacts · households · interactions · opportunities · tasks · status/aging helpers · `HouseholdProfile` (versioned) / `HouseholdGoal` / `HouseholdNote` for the "financial memory" pattern |
| **`@protocolwealthos/email-archive`** | SEC 17a-4 archive primitives · chain-of-custody hashing · retention enforcement · query evaluator |

### Operational primitives

| Package | Headline primitives |
|---------|---------------------|
| **`@protocolwealthos/workflow-engine`** | Durable-job runtime · backoff strategies (fixed/linear/exponential + jitter) · in-memory queue + pluggable backends |
| **`@protocolwealthos/document-gen`** | Document model · RFC 4180 CSV · plain-text renderer · `DocumentRenderer` interface for PDF/PPTX/DOCX backends |
| **`@protocolwealthos/onchain-sdk`** | Typed client + models for on-chain portfolio services |

## Canonical patterns extracted

The pwos-core primitive packages above implement individual capabilities; the *patterns* that govern how those capabilities compose at production scale live as ADRs in the PW estate. The ones most useful to adopters are listed below, with cross-reference paths into the PW estate canonical set. See [`docs/CANONICAL-PATTERNS.md`](docs/CANONICAL-PATTERNS.md) for the full pattern catalog + adoption notes.

| Pattern | One-line | Canonical reference |
|---------|----------|---------------------|
| **PII_TAGS canonical map** | Schema-level `pii.{high,medium,low}` tagging at ingestion + prompt-construction exclusion middleware; structural, not disciplinary | `shared/architecture/decisions/ADR-PII-tagging.md` (Revision 3) |
| **Sentinel-row reconciliation** | Canonical retry shape for WORM / immutable-row tables — retry emits a NEW row referencing the failed row's ID; never UPDATEs the failed row; recursion guard prevents infinite loops | `shared/architecture/decisions/ADR-gcs-worm-audit-mirror.md` (Revision 3) |
| **Track B' webhook-receiver primitive** | Single canonical `/v1/webhooks/:vendor` route + six-stage pipeline (verify → dedup → parse → process → audit → DLQ) per-vendor handler interface; svix-pattern adoption in PW-native TypeScript | `shared/architecture/decisions/ADR-webhook-receiver-primitive.md` (ACCEPTED) |
| **Multi-agent dispatch infrastructure** | Worker-launch ritual + Phase 1.5 STOP discipline + AskUserQuestion canonical Phase 1.5 delivery + §17 SELF-FIX BOUNDARY + sentinel-validation Phase 4 + Phase 6 archive-after-CI-success | `shared/dispatch/shared/worker-launch-ritual.md` (18 items + 5 codification candidates queued) |
| **Design tokens (warm-light v1.0)** | Unified design + UX system for advisor + client surfaces (pwos.app + pwportal.app parity); warm off-white canvas; dark navy type; minimal borders; calm-confidence tone | `shared/docs/firm/design-system.md` v1.0 (consumable artifacts referenced: `brand/design-tokens.css`, `brand/tailwind-preset.js`) |
| **PII egress canary** | Three-byte-identical-copy pattern: middleware at pw-api + re-implemented canaries at every Anthropic-SDK egress site (pw-os-v2 + pw-portal-v2); deliberately not a shared module so the layers cannot share a bug | `shared/strategy/CURRENT-STATE.md` (AI surface section); paired with `@protocolwealthos/pii-guard` + `@protocolwealthos/ai-guardrails` |

**Reference posture:** pwos-core packages are the npm-published, framework-agnostic implementation surface. The PW estate canonicals (ADRs + dispatch infrastructure + design tokens) are the operational shape that production deployments inherit. Adopters can take the npm packages standalone, or compose them against the same canonical patterns — both paths are supported.

## Architecture

```
pwos-core
├── packages/     # Published framework-agnostic TypeScript primitives
├── apps/evals/   # Private, deterministic eval harness workspace
├── examples/     # Private integration examples
├── docs/         # Canonical-pattern, attribution, publishing, architecture notes
└── .github/      # PR CI, SPDX/license checks, version-PR workflow
```

## Built on the Shoulders of Giants

PWOS Core stands on a foundation of exceptional open-source projects. Some are direct package dependencies; others are consumer-stack or reference-architecture projects credited for patterns, not copied code. See [NOTICE](NOTICE) and [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) for complete legal notices.

### Consumer App Frameworks Credited For Reference Patterns
- **[Hono](https://github.com/honojs/hono)** (MIT) — Edge-first web framework
- **[React 19](https://github.com/facebook/react)** (MIT) — UI library
- **[Vite](https://github.com/vitejs/vite)** (MIT) — Build tool + dev server
- **[Zustand](https://github.com/pmndrs/zustand)** (MIT) — State management
- **[Tailwind CSS](https://github.com/tailwindlabs/tailwindcss)** (MIT) — Utility CSS
- **[Drizzle ORM](https://github.com/drizzle-team/drizzle-orm)** (Apache 2.0) — TypeScript ORM
- **[jose](https://github.com/panva/jose)** (MIT) — JWT signing/verification
- **[Zod](https://github.com/colinhacks/zod)** (MIT) — Schema validation

### Document Generation
- **[pdfme](https://github.com/pdfme/pdfme)** (MIT) — WYSIWYG PDF template designer (~10ms/report)
- **[@react-pdf/renderer](https://github.com/diegomura/react-pdf)** (MIT) — React → PDF rendering
- **[pdf-lib](https://github.com/Hopding/pdf-lib)** (MIT) — Modify existing PDFs (fill forms, merge)
- **[pdfmake](https://github.com/bpampuch/pdfmake)** (MIT) — JSON-declarative PDFs
- **[pdfkit](https://github.com/foliojs/pdfkit)** (MIT) — Programmatic PDF generation
- **[docx](https://github.com/dolanmiu/docx)** (MIT) — Word documents
- **[pptxgenjs](https://github.com/gitbrent/PptxGenJS)** (MIT) — PowerPoint presentations

### Onchain Infrastructure
- **[Viem](https://github.com/wevm/viem)** (MIT) — Type-safe Ethereum interactions
- **[Wagmi](https://github.com/wevm/wagmi)** (MIT) — React hooks for wallet connection
- **[Ox](https://github.com/wevm/ox)** (MIT) — Low-level Ethereum utilities

### Workflow & Background Jobs
- **[BullMQ](https://github.com/taskforcesh/bullmq)** (MIT) — Redis-backed job queue
- **[Temporal](https://github.com/temporalio/temporal)** (MIT) — Durable execution engine
- **[Trigger.dev](https://github.com/triggerdotdev/trigger.dev)** (MIT) — Background jobs with checkpoints
- **[Activepieces](https://github.com/activepieces/activepieces)** (MIT) — Workflow automation with MCP servers

### AI & LLM
- **[@anthropic-ai/sdk](https://github.com/anthropics/anthropic-sdk-typescript)** (MIT) — Claude SDK

### File & Data Processing
- **[csv-parse](https://github.com/adaltas/node-csv)** (MIT) — CSV parsing
- **[pdf-parse](https://gitlab.com/autokent/pdf-parse)** (MIT) — PDF text extraction
- **[exceljs](https://github.com/exceljs/exceljs)** (MIT) — Excel read/write

### Reference Architecture (AGPL-3.0 code NOT copied — patterns only)
- **[Twenty CRM](https://github.com/twentyhq/twenty)** (AGPL-3.0) — CRM custom object system
- **[Ghostfolio](https://github.com/ghostfolio/ghostfolio)** (AGPL-3.0) — Portfolio data model
- **[Wealthfolio](https://github.com/afadil/wealthfolio)** (AGPL-3.0) — React+Vite financial UI
- **[Sure](https://github.com/we-promise/sure)** (AGPL-3.0) — MCP-exposed finance features
- **[Firefly III](https://github.com/firefly-iii/firefly-iii)** (AGPL-3.0) — Double-entry bookkeeping API
- **[Ignidash](https://github.com/schelskedevco/ignidash)** — AI-powered planning UI patterns
- **[OpenArchiver](https://github.com/LogicLabs-OU/OpenArchiver)** — SEC 17a-4 email archiving
- **[Wealthbot](https://github.com/wealthbot-io/wealthbot)** (MIT, dormant PHP) — RIA rebalancing/billing algorithms (ported to TS)

**Huge thanks to every maintainer and contributor of these projects.** RIA software has historically been locked behind proprietary walls — PWOS Core would not exist without the open-source ecosystem.

## What's Open vs Private

PWOS Core is a **reference extraction** of the Protocol Wealth substrate, not the running firm. The split is explicit and non-negotiable.

**Open (Apache 2.0, this repo):** The 21 framework-agnostic primitive package manifests under `packages/*`, including the `0.2.0` onchain-accounting contract, the canonical-pattern documentation under `docs/`, the private eval harness at `apps/evals/`, and private integration examples under `examples/`. Generic, hermetic, no firm-specific values. The package surface includes PII guard, audit log, AI guardrails, auth, MCP tools, compliance calendar, ledger, holdings, CRM, document model, webhooks, security headers, GCP helpers, cache keys, workflow engine, email archive, on-chain SDK, shared governance primitives, disclosure-card schema, planning ABI, and the PII-free onchain-accounting ABI.

**Private (not in this repo, never will be):**
- The production orchestrator that wires these primitives into PW's running advisor and client surfaces (lives in `pw-os-v2`, `pw-api`, `pw-portal-v2` — separate, closed repos).
- Real client data, advisor identities, household profiles, transaction history.
- Firm-internal tools (Wealthbox / Altruist / Quiltt / Turnkey / Veriff wired clients with credentials, narrative-pipeline prompt sets, advisor-vetted disclaimer copy, tool-tier policy bindings).
- Production thresholds, retention windows that are tighter than the defaults shipped here, kill-rule cutoffs, regime voting cutoffs, decay constants — anything where the *value* (not the *shape*) carries IP or competitive weight.
- API keys, webhook secrets, signing keys, client identifiers.

**Mapping principle:** the *shape* is open (schemas, interfaces, hash-chain algorithm, gate-evaluator structure). The *settings* a regulated firm operates under stay private to that firm. Adopt the shape; supply your own settings.

## Quick Start

```bash
git clone https://github.com/Protocol-Wealth/pwos-core.git
cd pwos-core
pnpm install
pnpm -r build
pnpm -r typecheck
pnpm -r test
pnpm -r lint
pnpm versions:check
```

This repository is a package workspace, not a runnable advisor app. Use the packages directly, or start from `examples/rias-agent-substrate` for a composed integration example.

## How to adopt a canonical pattern

Pick the primitive you need; compose against the canonical pattern reference. Three examples:

**PII scan before model egress:**

```ts
import { markCacheable } from '@protocolwealthos/ai-guardrails';
import { scan } from '@protocolwealthos/pii-guard';

const staticPrefix = 'Static system prompt and tool definitions only.';
const scanResult = await scan(staticPrefix);

if (scanResult.hasPII) throw new Error(`PII in cached prefix: ${scanResult.categories.join(', ')}`);

const cacheableBlocks = markCacheable([{ type: 'text', text: staticPrefix }]);
```

Full canonical: `shared/architecture/decisions/ADR-PII-tagging.md` R3.

**Sentinel-row reconciliation for WORM tables:**

```ts
// Failed write to immutable table → emit a sentinel-row referencing the failed row
import { AuditLogger } from '@protocolwealthos/audit-log';

const failedRow = await auditLogger.log({
  actorId: 'system',
  action: 'kyc.session.create',
  resourceType: 'kyc_session',
  resourceId: 'session_opaque_123',
});

if (gcsWormMirrorFailed) {
  await auditLogger.log({
    actorId: 'system',
    action: 'kyc.session.retry_mirror',
    resourceType: 'kyc_session',
    resourceId: failedRow.id,
    details: { referencesFailedRowId: failedRow.id, attempt: 1 },
    // recursion guard: if attempt > MAX_RETRIES, surface to operator
  });
}
```

Full canonical: `shared/architecture/decisions/ADR-gcs-worm-audit-mirror.md` R3.

**Webhook-receiver primitive with per-vendor handler:**

```ts
// pw-api/src/routes/webhooks.ts pattern
import { verifyHmacSha256 } from '@protocolwealthos/webhooks';

webhookRouter.post('/:vendor', async (c) => {
  const handler = vendorRegistry.get(c.req.param('vendor'));
  const rawPayload = await c.req.text();
  if (!await handler.verify(rawPayload, c.req.header(), getVendorSecret(c.req.param('vendor')))) {
    return c.json({ error: 'invalid signature' }, 401);
  }
  // dedup → parse → process → audit → DLQ
});
```

Full canonical: `shared/architecture/decisions/ADR-webhook-receiver-primitive.md`.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Language | TypeScript 6, strict mode, ESM-only |
| Package manager | pnpm 9 workspace |
| Test runner | Vitest 4 per package |
| Runtime deps | Kept intentionally small; most packages are zero-runtime-dependency |
| Validation | Zod 4 only where runtime boundary validation is needed |
| Release prep | Changesets version PR; maintainer local publish |

## PII Guard Pipeline

The `@protocolwealthos/pii-guard` package exposes the reusable scanner. Consumer apps decide where to enforce it; the reference pattern is at every model-egress boundary.

1. **Layer 1: Regex** — deterministic patterns (SSN, CC, email, phone, crypto keys, API keys, mortgage/RE/platform IDs, etc.)
2. **Layer 2: NER** — Named entity recognition for person names, addresses, contextual PII
3. **Layer 3: Financial Recognizers** — CUSIP, account references, policy numbers (context-boosted scoring)
4. **Layer 4: Allow-List** — 60+ financial terms that should never be redacted ($amounts, AGI, 401k, etc.)

## For RIAs and Advisors

Use these packages as primitives inside your own advisor platform. This repo does not ship a ready-to-deploy production app, database schema, auth surface, or vendor integration layer.

> Note on infrastructure choice: Protocol Wealth (the firm) runs its own production stack on Google Cloud Run (see [GCP Reference Architecture](docs/gcp-reference-architecture.md) for the regulated-workload posture we use internally). Adopters with existing GCP/AWS/Fly footprints should adapt the primitives to their own platform, controls, retention windows, and CCO-approved policies.

## Documentation

- [Canonical Patterns](docs/CANONICAL-PATTERNS.md) — six patterns extracted from the PW estate canonical set (PII_TAGS, sentinel-row reconciliation, Track B' webhook-receiver primitive, multi-agent dispatch infrastructure, design tokens v1.0, PII egress canary); each entry links to its ADR or design doc in `shared/` for the full canonical
- [GCP Reference Architecture](docs/gcp-reference-architecture.md) — generic, vendor-agnostic GCP posture for regulated workloads (Cloud Run private services, Cloud SQL with IAM auth, retention-locked GCS audit archive, Workload Identity Federation for CI, org-wide Cloud Audit Logs sinks); control-framework mapping table to ISO 27001 Annex A + SOC 2 TSC
- [PWOS + SmythOS (reference integration)](docs/pwos-smythos.md) — forward-looking compatibility note (not a partnership): how an MCP-compatible agent platform such as SmythOS can call the PWOS compliance/credential layer (pii-guard, mcp-tools tier + confirm-gate, hitl, disclosure-card, audit-log) over the open Model Context Protocol; SmythOS does not integrate PWOS today
- [Attribution](docs/attribution.md) — detailed provenance per capability
- [Publishing](docs/publishing.md) — local publish process and Changesets version-PR workflow
- [Contributing](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security](SECURITY.md)

## Patent & IP

**Patent Pending** — USPTO Application #64/034,215
"Compliance-First AI Operating System with Per-User PII Guard Pipeline and Immutable Audit Trail for SEC/FINRA-Regulated Financial Advisory Services"

- [Patent disclosure](https://pwos.app/patent) · [USPTO Patent Center](https://patentcenter.uspto.gov/applications/64034215) · [Figure 1 — system drawing (PDF)](docs/PW-PROV-001-FIG1.pdf)
- Applicant: Protocol Wealth, LLC
- Inventor: Nicholas Rygiel
- Filed: April 9, 2026
- Status: Patent Pending

This patent was filed **defensively** under Apache 2.0. The intent is to establish formal prior art and prevent third parties from patenting these concepts and restricting their use by independent financial advisors. Under Apache 2.0, you receive an automatic, perpetual, royalty-free patent grant. If you sue Protocol Wealth for patent infringement related to this software, your license terminates automatically.

**Open Invention Network (OIN) Member** — Protocol Wealth LLC is a member of the Open Invention Network (OIN), the world's largest patent non-aggression network with 4,100+ members including Google, IBM, Toyota, Meta, Microsoft, and Amazon. [Learn more](https://openinventionnetwork.com/about-us/member-benefits/)

See [PATENTS](PATENTS) for full non-assertion pledge.

## License

Apache License 2.0 — see [LICENSE](LICENSE).

Apache 2.0 includes an explicit patent retaliation clause that MIT lacks. If someone sues you for patent infringement related to PWOS, their right to use the software terminates automatically. This is why we chose Apache 2.0 over MIT.

**Third-party components retain their original licenses.** See [NOTICE](NOTICE) and [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).

## Contributing

We welcome contributions. All commits must include a `Signed-off-by:` line certifying agreement with the [Developer Certificate of Origin](https://developercertificate.org/):

```bash
git commit -s -m "feat: your change"
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for full guidelines.

## Related

- **[Nexus Core](https://github.com/Protocol-Wealth/nexus-core)** — Quantitative research engine ([nexusmcp.site](https://nexusmcp.site))

## Links

- **Live App:** [pwos.app](https://pwos.app)
- [Product Demo](https://pwos.app/demo)
- [Open Source Manifesto](https://pwos.app/opensource)
- [Patent Documentation](https://pwos.app/patent)
- [Regulatory Disclosures](https://pwos.app/disclosures)
- [Regulatory References](https://pwos.app/references)
- [Protocol Wealth](https://protocolwealthllc.com)

---

*Built by [Protocol Wealth LLC](https://protocolwealthllc.com) — SEC-Registered Investment Adviser (CRD #335298)*
