# Attribution & Provenance

This document provides detailed provenance for every capability in PWOS Core. When an idea, algorithm, or code pattern came from a third-party project, we credit it here.

---

## Capability Provenance Map

### Web Framework & Runtime

**Fully attributed to:**
- **[Hono](https://github.com/honojs/hono)** by Yusuke Wada (MIT) — Edge-first web framework
- **[React 19](https://github.com/facebook/react)** by Meta (MIT) — UI library
- **[Vite](https://github.com/vitejs/vite)** (MIT) — Build tool and dev server
- **[Zustand](https://github.com/pmndrs/zustand)** by Paul Henschel (MIT) — State management
- **[Tailwind CSS](https://github.com/tailwindlabs/tailwindcss)** (MIT) — Utility-first CSS
- **[Drizzle ORM](https://github.com/drizzle-team/drizzle-orm)** (Apache 2.0) — TypeScript ORM
- **[jose](https://github.com/panva/jose)** by Filip Skokan (MIT) — JWT signing/verification
- **[Zod](https://github.com/colinhacks/zod)** by Colin McDonnell (MIT) — Runtime validation

**Our original work:** Custom middleware stack (auth + PII guard + audit), multi-tenancy design, compliance-first routing patterns.

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

**Our original work:** `@pwos/document-gen` package that wraps all of these with unified branding templates, compliance watermarks, and data model binding.

### Onchain Infrastructure

**Fully attributed to wevm team:**
- **[Viem](https://github.com/wevm/viem)** (MIT) — Type-safe Ethereum interactions
- **[Wagmi](https://github.com/wevm/wagmi)** (MIT) — React hooks for wallet connection
- **[Ox](https://github.com/wevm/ox)** (MIT) — Low-level Ethereum utilities

**Our original work:** `@pwos/onchain-sdk` package with wallet-to-client association model, DeFi position categorization for RIA compliance, and audit-trail integration for every on-chain read.

### Workflow Engine

**Fully attributed to:**
- **[BullMQ](https://github.com/taskforcesh/bullmq)** (MIT) — Redis-backed job queue
- **[Temporal TypeScript SDK](https://github.com/temporalio/sdk-typescript)** (MIT) — Durable execution for mission-critical workflows
- **[Trigger.dev](https://github.com/triggerdotdev/trigger.dev)** (MIT) — Background jobs with checkpoint-resume
- **[Activepieces](https://github.com/activepieces/activepieces)** (MIT) — Workflow automation + MCP servers

**Our original work:** `@pwos/workflow-engine` that wraps BullMQ for lightweight jobs and Temporal for mission-critical flows (client onboarding, regulatory filings), with audit-trail integration.

### AI & LLM Integration

**Fully attributed to:**
- **[@anthropic-ai/sdk](https://github.com/anthropics/anthropic-sdk-typescript)** by Anthropic (MIT) — Claude API

**Our original work:** Multi-turn tool-use orchestration (up to 5 rounds), streaming SSE with tool_use injection, PII-guarded prompt flows.

### CRM Module (Planned)

**Reference architecture (AGPL code NOT copied):**
- **[Twenty CRM](https://github.com/twentyhq/twenty)** (AGPL-3.0)
  - Custom object system pattern
  - Workflow automation with triggers/actions
  - Role-based permissions

- **[Monica](https://github.com/monicahq/monica)** (AGPL-3.0)
  - Relationship-centric data model
  - Life event tracking

**Our original work:** `@pwos/crm` package with household relationship graph, interaction logging, opportunity pipeline — all TypeScript/Drizzle/PostgreSQL native, no code copied from AGPL sources.

### Portfolio Module (Planned)

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

**Our original work:** Drizzle schema design, multi-client household rollup, compliance-gated rebalancing workflow.

### Planning Module (Planned)

**Reference architecture (patterns only):**
- **[Ignidash](https://github.com/schelskedevco/ignidash)** — AI-powered planning UI (Monte Carlo + AI chat)
- **[SquirrelPlan](https://github.com/skapebolt/SquirrelPlan)** — Client-side planning UI patterns

**Our original work:** `@pwos/planning-ui` package with regime-aware projections, tax-optimized withdrawal strategies.

### Compliance Module (Planned)

**Fully attributed to:**
- **[OpenArchiver](https://github.com/LogicLabs-OU/OpenArchiver)** (check license) — SEC Rule 17a-4 email archiving

**Our original work:** `@pwos/compliance` package with AI tool inventory, PII incident tracking, SEC exam export, per-advisor PII mode tracking.

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
- run: pnpm licenses list --json > licenses.json
- run: node scripts/check-licenses.mjs licenses.json
```

The script fails the build if any dependency has a GPL/AGPL/SSPL license not present in our approved reference-only list.

---

## Questions?

If you believe we've missed an attribution or misidentified a license, please open an issue. We take attribution seriously.
