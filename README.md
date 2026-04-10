# PWOS Core

> Open source compliance-first AI operating system for SEC-registered investment advisers.

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Patent Pending](https://img.shields.io/badge/Patent-Pending-orange.svg)](https://patentcenter.uspto.gov/applications/64034215)
[![OIN Member](https://img.shields.io/badge/OIN-Member-green.svg)](https://openinventionnetwork.com)

**Live:** [pwos.app](https://pwos.app) | **Demo:** [pwos.app/demo](https://pwos.app/demo) | **Disclosures:** [pwos.app/disclosures](https://pwos.app/disclosures)

## What This Is

PWOS Core is the open source foundation of the [Protocol Wealth Operating System](https://pwos.app) — a self-hosted AI platform built for SEC-registered investment advisers (RIAs), FINRA-regulated financial advisors, family offices, and anyone who needs regulatory-grade compliance in AI-assisted financial operations.

**This is not a toy.** It was built and tested in production by an SEC-registered RIA (Protocol Wealth LLC, CRD #335298) with real compliance requirements.

## Features

- **AI Chat IDE** — Multi-model LLM chat with streaming SSE, projects, folders, templates, conversation management
- **4-Layer PII Guard** — Regex (31 patterns) + NER + financial recognizers + domain allow-list with per-user modes (warn/block/redact)
- **Prompt Injection Detection** — 23 patterns across 6 attack categories
- **Immutable Audit Trail** — Append-only log meeting SEC Rule 204-2 Books & Records requirements
- **Inline Tool Orchestration** — LLM autonomously selects and executes tools during chat (multi-turn, up to 5 rounds)
- **Practice Management** — Task tracking, meeting notes with AI action item extraction, CRM integration
- **Financial Calculator** — Compound interest, CAGR, mortgage, RMD, future/present value, rule of 72
- **Document Reader** — Upload and analyze PDFs, CSVs, Excel, TXT, JSON
- **Chart Generator** — SVG bar, pie, and line charts
- **Export Generators** — CSV, PDF (branded reports), PPTX (presentations)
- **Template System** — Reusable templates with variable substitution for proposals, meeting prep, research briefs
- **Compliance Center** — AI tool inventory, PII dashboard, governance docs, disclosure management
- **Google OAuth + RBAC** — Role-based access (admin/partner/user/intern)
- **Mobile Responsive** — Sidebar drawer, full-width chat, touch-optimized

## Architecture

```
PWOS Core (single deployment)
├── React 19 + Tailwind v4 (frontend)
├── Hono 4 (API server, serves frontend)
├── 4-Layer PII Guard Pipeline
├── Tool Orchestration (extensible via HTTP)
├── Gemma Engine (optional local AI)
└── LLM API (Claude/GPT/Gemini with tool_use)
    ├── PostgreSQL (Drizzle ORM)
    ├── Redis (sessions)
    └── External integrations (HTTP)
```

## Quick Start

```bash
git clone https://github.com/Protocol-Wealth/pwos-core.git
cd pwos-core
pnpm install
cp .env.example .env          # Add your API keys
pnpm --filter @pwos/shared build
pnpm --filter @pwos/api migrate
pnpm --filter @pwos/api seed
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
| Auth | Google OAuth 2.0 → JWT |
| LLM | @anthropic-ai/sdk (extensible) |
| PII | 31 regex + NER + financial recognizers + allow-list |
| Validation | Zod 3 |

## PII Guard Pipeline

Every outbound message passes through 4 layers before reaching any AI model:

1. **Layer 1: Regex** — 31 deterministic patterns (SSN, CC, email, phone, crypto keys, API keys, etc.)
2. **Layer 2: NER** — Named entity recognition for person names, addresses, contextual PII
3. **Layer 3: Financial Recognizers** — CUSIP, account references, policy numbers (context-boosted scoring)
4. **Layer 4: Allow-List** — 60+ financial terms that should never be redacted ($amounts, AGI, 401k, etc.)

Per-user modes: `off` | `warn` (confirm before send) | `block` (must remove PII) | `redact` (auto-mask with `<TYPE_N>` placeholders)

## For RIAs and Advisors

Deploy your own instance on Fly.io (~$62/month) with your own database. Your data stays yours. Every AI interaction is logged in an immutable audit trail. Export Books & Records as JSON for SEC examiners.

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

## Contributing

PRs welcome. Please read the code conventions before contributing.

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
