# Attribution & Provenance

This document provides detailed provenance for every capability in PWOS Core. When an idea, algorithm, or code pattern came from a third-party project, we credit it here. Some entries are direct package dependencies; others are consumer-stack or reference-architecture projects credited for patterns, not copied code.

---

## Capability Provenance Map

### Consumer App Frameworks Credited For Reference Patterns

**Fully attributed to:**
- **[Hono](https://github.com/honojs/hono)** by Yusuke Wada (MIT) — Edge-first web framework
- **[React 19](https://github.com/facebook/react)** by Meta (MIT) — UI library
- **[Vite](https://github.com/vitejs/vite)** (MIT) — Build tool and dev server
- **[Zustand](https://github.com/pmndrs/zustand)** by Paul Henschel (MIT) — State management
- **[Tailwind CSS](https://github.com/tailwindlabs/tailwindcss)** (MIT) — Utility-first CSS
- **[Drizzle ORM](https://github.com/drizzle-team/drizzle-orm)** (Apache 2.0) — TypeScript ORM
- **[jose](https://github.com/panva/jose)** by Filip Skokan (MIT) — JWT signing/verification
- **[Zod](https://github.com/colinhacks/zod)** by Colin McDonnell (MIT) — Runtime validation

**Our original work:** Framework-agnostic primitives that consumer apps can compose into auth, PII, audit, and compliance-routing boundaries.

### 4-Layer PII Guard Pipeline

**Our original work.** The 4-layer pipeline (regex + NER + financial recognizers + allow-list) with per-user modes (off/warn/block/redact) is Protocol Wealth original research. See [USPTO Application #64/034,215](https://patentcenter.uspto.gov/applications/64034215).

**Related inspiration:**
- Presidio (Microsoft) — we do NOT copy code, but their named entity recognition concepts informed our NER layer
- Standard regex patterns for PII types (SSN, credit card, phone) — industry-standard formats

### Immutable Audit Trail

**Our original work.** SEC Rule 204-2 Books & Records compliance with append-only database constraints and cryptographic hash chaining is Protocol Wealth original work.

**Related inspiration:**
- SEC Rule 17a-4 WORM storage requirements — regulatory specification
- Git object model — conceptual inspiration for append-only hash-chained storage

### Document Generation

**Fully attributed to:**
- **[pdfme](https://github.com/pdfme/pdfme)** (MIT) — WYSIWYG PDF template designer
  - Sub-10ms rendering per report
  - JSON-based templates stored in PostgreSQL
- **[@react-pdf/renderer](https://github.com/diegomura/react-pdf)** by Diego Muracciole (MIT) — React component-based PDFs
- **[pdf-lib](https://github.com/Hopding/pdf-lib)** by Andrew Dillon (MIT) — PDF modification (fill forms, merge)
- **[pdfmake](https://github.com/bpampuch/pdfmake)** (MIT) — Declarative JSON-to-PDF
- **[pdfkit](https://github.com/foliojs/pdfkit)** by Devon Govett (MIT) — Programmatic PDF generation
- **[docx](https://github.com/dolanmiu/docx)** by Dolan Miu (MIT) — Word document generation
- **[pptxgenjs](https://github.com/gitbrent/PptxGenJS)** by Brent Ely (MIT) — PowerPoint generation

**Our original work:** `@protocolwealthos/document-gen` package with a portable document model, CSV/plain-text renderers, and renderer interfaces. Concrete PDF/PPTX/DOCX adapters live with consumers.

### Onchain Infrastructure

**Fully attributed to wevm team:**
- **[Viem](https://github.com/wevm/viem)** (MIT) — Type-safe Ethereum interactions
- **[Wagmi](https://github.com/wevm/wagmi)** (MIT) — React hooks for wallet connection
- **[Ox](https://github.com/wevm/ox)** (MIT) — Low-level Ethereum utilities

**Our original work:** `@protocolwealthos/onchain-sdk` package with typed on-chain portfolio client/data shapes that consumer apps can bind to their own wallet and audit integrations.

### Onchain Accounting Contract

**Public specifications and methodology references:**
- IRS digital-asset FAQs and Publication 544 holding-period summaries
- Standard FIFO lot-accounting mechanics and public protocol transaction shapes
- The Apache-2.0 `nexus-core` accounting contract and methodology maintained by
  Protocol Wealth

**Our original work:** `@protocolwealthos/onchain-accounting-contract` is the
strict TypeScript/runtime mirror of the public-safe Nexus v0.2.0 wire ABI. It
contains de-identified schemas, decimal-string validation, tool declarations,
and synthetic fixtures only; no client linkage, statement composition, tax
return logic, or AGPL source code.

### Workflow Engine

**Fully attributed to:**
- **[BullMQ](https://github.com/taskforcesh/bullmq)** (MIT) — Redis-backed job queue
- **[Temporal TypeScript SDK](https://github.com/temporalio/sdk-typescript)** (MIT) — Durable execution for mission-critical workflows
- **[Trigger.dev](https://github.com/triggerdotdev/trigger.dev)** (MIT) — Background jobs with checkpoint-resume
- **[Activepieces](https://github.com/activepieces/activepieces)** (MIT) — Workflow automation + MCP servers

**Our original work:** `@protocolwealthos/workflow-engine` storage-agnostic durable-job primitives, in-memory queue, and backoff policies that can be adapted to BullMQ, Temporal, or other runtimes.

### AI & LLM Integration

**Fully attributed to:**
- **[@anthropic-ai/sdk](https://github.com/anthropics/anthropic-sdk-typescript)** by Anthropic (MIT) — Claude API

**Our original work:** Model-provider-agnostic guardrails, MCP tool registry primitives, tool-call audit rows, confirmation gates, and PII/cache-boundary helpers.

### CRM Module

**Reference architecture (AGPL code NOT copied):**
- **[Twenty CRM](https://github.com/twentyhq/twenty)** (AGPL-3.0)
  - Custom object system pattern
  - Workflow automation with triggers/actions
  - Role-based permissions

- **[Monica](https://github.com/monicahq/monica)** (AGPL-3.0)
  - Relationship-centric data model
  - Life event tracking

**Our original work:** `@protocolwealthos/crm` package with storage-agnostic contact, household, interaction, opportunity, task, and household-profile primitives. No code copied from AGPL sources.

### Holdings / Portfolio Module

**Reference architecture (AGPL code NOT copied):**
- **[Ghostfolio](https://github.com/ghostfolio/ghostfolio)** (AGPL-3.0)
  - Prisma + PostgreSQL schema for holdings/transactions
  - Multi-period return calculations (ROAI)
  - Multi-platform aggregation

- **[Wealthfolio](https://github.com/afadil/wealthfolio)** (AGPL-3.0)
  - React + Vite financial dashboard UI
  - Plugin/addon ecosystem

**MIT source (ported, not copied):**
- **[Wealthbot](https://github.com/wealthbot-io/wealthbot)** (MIT, dormant PHP)
  - Rebalancing algorithm (ported to TypeScript)
  - Tax-loss harvesting logic
  - Multi-tiered billing

**Our original work:** `@protocolwealthos/holdings` and `@protocolwealthos/ledger` packages with storage-agnostic holdings events, snapshots, double-entry ledger primitives, and bailment-mode checks.

### Planning Contract

**Reference architecture (patterns only):**
- **[Ignidash](https://github.com/schelskedevco/ignidash)** — AI-powered planning UI (Monte Carlo + AI chat)
- **[SquirrelPlan](https://github.com/skapebolt/SquirrelPlan)** — Client-side planning UI patterns

**Our original work:** `@protocolwealthos/planning-contract` package with the PlanningContract v1.1.0 TypeScript ABI, result types, JSON Schema, and MCP tool definitions. The math engine lives in sibling `nexus-core`.

### Compliance / Email Archive

**Fully attributed to:**
- **[OpenArchiver](https://github.com/LogicLabs-OU/OpenArchiver)** (check license) — SEC Rule 17a-4 email archiving

**Our original work:** `@protocolwealthos/compliance` and `@protocolwealthos/email-archive` packages with retention, Books-and-Records bundling, incident classification, compliance calendar, vendor-document metadata, chain-of-custody hashing, and retention enforcement.

---

## How to Add New Attributions

When integrating new third-party code or ideas:

1. **Determine license compatibility** — check the project's LICENSE file
   - ✅ Safe to bundle: MIT, Apache 2.0, BSD (2/3-clause), MPL 2.0, ISC
   - ⚠️ Dynamic link only: LGPL
   - ❌ Reference architecture only: GPL-3.0, AGPL-3.0, SSPL

2. **Update NOTICE** — add copyright and license notice

3. **Update THIRD_PARTY_LICENSES.md** — add full license text (unless already present for that license type)

4. **Update README.md "Built on" section** — add human-readable attribution

5. **Update this file (docs/attribution.md)** — add detailed provenance

6. **Update package.json** — pin the dependency with `^` or `~` constraint

---

## Attribution Audit

We run an automated license compliance check in CI on every PR:

```yaml
# .github/workflows/license-compliance.yml
- run: npm install -g license-checker-rseidelsohn
- run: pnpm install --frozen-lockfile
- run: license-checker-rseidelsohn --json --out dependency-licenses.json --production
```

The workflow fails the build if any production dependency reports GPL-3.0, AGPL-3.0, or SSPL-1.0.

---

## Questions?

If you believe we've missed an attribution or misidentified a license, please open an issue. We take attribution seriously.
