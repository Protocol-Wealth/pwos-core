# PWOS Core

> Open source compliance-first AI operating system for SEC-registered investment advisers.

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Patent Pending](https://img.shields.io/badge/Patent-Pending-orange.svg)](https://patentcenter.uspto.gov/applications/64034215)
[![OIN Member](https://img.shields.io/badge/OIN-Member-green.svg)](https://openinventionnetwork.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6+-blue.svg)](https://www.typescriptlang.org/)
[![Contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg)](CONTRIBUTING.md)

**Live:** [pwos.app](https://pwos.app) | **Demo:** [pwos.app/demo](https://pwos.app/demo) | **Disclosures:** [pwos.app/disclosures](https://pwos.app/disclosures)

## What This Is

PWOS Core is the open source foundation of the [Protocol Wealth Operating System](https://pwos.app) — a self-hosted AI platform built for SEC-registered investment advisers (RIAs), FINRA-regulated financial advisors, family offices, and anyone who needs regulatory-grade compliance in AI-assisted financial operations.

**This is not a toy.** It was built and tested in production by an SEC-registered RIA (Protocol Wealth LLC, CRD #335298) with real compliance requirements.

## Features

- **AI Chat IDE** — Multi-model LLM chat with streaming SSE, projects, folders, templates, conversation management
- **4-Layer PII Guard** — Regex (31 patterns) + NER + financial recognizers + domain allow-list with per-user modes (warn/block/redact)
- **Streaming PII Rehydrator** — Buffer-aware placeholder rehydrator for SSE / chunked LLM output (handles placeholders split across chunks)
- **Prompt Injection Detection** — 23 patterns across 6 attack categories
- **Immutable Audit Trail** — Append-only log meeting SEC Rule 204-2 Books & Records requirements
- **Inline Tool Orchestration** — LLM autonomously selects and executes tools during chat (multi-turn, up to 5 rounds)
- **Confirmation Gate for Write Tools** — Stateless, payload-bound two-turn gate so LLMs can't fudge fields between preview and execute
- **Tool-Call Audit Builder** — SHA-256 hashed input + scrubbed-output audit rows for compliance-grade per-tool-call trails
- **Practice Management** — Task tracking, meeting notes with AI action item extraction, CRM integration
- **Financial Calculator** — Compound interest, CAGR, mortgage, RMD, future/present value, rule of 72
- **Document Gen** — PDFs via pdfme/pdf-lib/react-pdf, Word via docx, PowerPoint via pptxgenjs
- **Onchain Portfolio** — Viem + Wagmi for EVM wallets, DeFi positions, statements
- **Workflow Engine** — Durable execution via Temporal or BullMQ
- **Chart Generator** — SVG bar, pie, and line charts
- **Template System** — Reusable templates with variable substitution
- **Compliance Center** — AI tool inventory, PII dashboard, governance docs, email archiving (SEC 17a-4)
- **Google OAuth + RBAC** — Role-based access (admin/partner/user/intern)
- **Mobile Responsive** — Sidebar drawer, full-width chat, touch-optimized

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

## Architecture

```
PWOS Core (single deployment)
├── React 19 + Tailwind v4 (frontend)
├── Hono 4 (API server, serves frontend)
├── 4-Layer PII Guard Pipeline
├── Tool Orchestration (extensible via HTTP)
├── Document Generation (pdfme, pdf-lib, react-pdf, docx, pptxgenjs)
├── Onchain SDK (Viem, Wagmi, Ox)
├── Workflow Engine (BullMQ + optional Temporal)
├── Email Archive (OpenArchiver integration for SEC 17a-4)
├── Gemma Engine (optional local AI)
└── LLM API (Claude/GPT/Gemini with tool_use)
    ├── PostgreSQL (Drizzle ORM)
    ├── Redis (sessions)
    └── External integrations (HTTP)
```

## Built on the Shoulders of Giants

PWOS Core stands on a foundation of exceptional open-source projects. We bundle or extend these libraries with full attribution — see [NOTICE](NOTICE) and [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) for complete legal notices.

### Web Framework & Runtime
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

## Quick Start

```bash
git clone https://github.com/Protocol-Wealth/pwos-core.git
cd pwos-core
pnpm install
cp .env.example .env          # Add your API keys
pnpm --filter @protocolwealthos/shared build
pnpm --filter @protocolwealthos/api migrate
pnpm --filter @protocolwealthos/api seed
pnpm dev
```

Open http://localhost:5173 — sign in with Google, start chatting.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + Vite 6 + Tailwind CSS v4 + Zustand 5 |
| Backend | Hono 4 + @hono/node-server |
| Database | PostgreSQL + Drizzle ORM |
| Cache | Redis (Upstash compatible) |
| Auth | Google OAuth 2.0 → JWT (jose) |
| LLM | @anthropic-ai/sdk (extensible) |
| PII | 31 regex + NER + financial recognizers + allow-list |
| Validation | Zod 3 |
| Workflow | BullMQ (lightweight) or Temporal (durable) |

## PII Guard Pipeline

Every outbound message passes through 4 layers before reaching any AI model:

1. **Layer 1: Regex** — 31 deterministic patterns (SSN, CC, email, phone, crypto keys, API keys, etc.)
2. **Layer 2: NER** — Named entity recognition for person names, addresses, contextual PII
3. **Layer 3: Financial Recognizers** — CUSIP, account references, policy numbers (context-boosted scoring)
4. **Layer 4: Allow-List** — 60+ financial terms that should never be redacted ($amounts, AGI, 401k, etc.)

Per-user modes: `off` | `warn` (confirm before send) | `block` (must remove PII) | `redact` (auto-mask with `<TYPE_N>` placeholders)

## For RIAs and Advisors

Deploy your own instance on Fly.io (~$62/month) with your own database. Your data stays yours. Every AI interaction is logged in an immutable audit trail. Export Books & Records as JSON for SEC examiners.

## Documentation

- [Architecture](docs/architecture.md)
- [Packages Reference](docs/packages.md)
- [GCP Reference Architecture](docs/gcp-reference-architecture.md) — generic, vendor-agnostic GCP posture for regulated workloads (Cloud Run private services, Cloud SQL with IAM auth, retention-locked GCS audit archive, Workload Identity Federation for CI, org-wide Cloud Audit Logs sinks); control-framework mapping table to ISO 27001 Annex A + SOC 2 TSC
- [Attribution](docs/attribution.md) — detailed provenance per capability
- [Contributing](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security](SECURITY.md)

## Patent & IP

**Patent Pending** — USPTO Application #64/034,215
"Compliance-First AI Operating System with Per-User PII Guard Pipeline and Immutable Audit Trail for SEC/FINRA-Regulated Financial Advisory Services"

- [USPTO Patent Center](https://patentcenter.uspto.gov/applications/64034215)
- Applicant: Protocol Wealth, LLC
- Inventor: Nicholas Rygiel
- Filed: April 9, 2026
- Status: Patent Pending

This patent was filed **defensively** under Apache 2.0. The intent is to establish formal prior art and prevent third parties from patenting these concepts and restricting their use by independent financial advisors. Under Apache 2.0, you receive an automatic, perpetual, royalty-free patent grant. If you sue Protocol Wealth for patent infringement related to this software, your license terminates automatically.

**Open Invention Network (OIN) Member** — Protocol Wealth is a member of the OIN 2.0 community, the world's largest patent non-aggression network with 4,100+ members including Google, IBM, Toyota, Meta, Microsoft, and Amazon. [Learn more](https://openinventionnetwork.com/about-us/member-benefits/)

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
