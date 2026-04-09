# PWOS Core

> Open source compliance-first AI operating system for SEC-registered investment advisers.

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## What This Is

PWOS Core is the open source foundation of the Protocol Wealth Operating System — a self-hosted AI platform built for SEC-registered investment advisers (RIAs), FINRA-regulated financial advisors, family offices, and anyone who needs regulatory-grade compliance in AI-assisted financial operations.

**This is not a toy.** It was built and tested in production by an SEC-registered RIA (Protocol Wealth LLC, CRD #335298) with real compliance requirements.

## Features

- **AI Chat IDE** — Multi-model LLM chat (Claude, GPT, Gemini) with streaming SSE, projects, folders, conversation management
- **4-Layer PII Guard** — Regex (31 patterns) + NER + financial recognizers + domain allow-list with per-user modes (warn/block/redact)
- **Prompt Injection Detection** — 23 patterns across 6 attack categories
- **Immutable Audit Trail** — Append-only log meeting SEC Rule 204-2 Books & Records requirements
- **Inline Tool Orchestration** — LLM autonomously selects and executes tools during chat (multi-turn, up to 5 rounds)
- **Financial Calculator** — Compound interest, CAGR, mortgage, RMD, future/present value, rule of 72
- **Document Reader** — Upload and analyze PDFs, CSVs, Excel, TXT, JSON
- **Chart Generator** — SVG bar, pie, and line charts
- **Export Generators** — CSV, PDF (branded reports), PPTX (presentations)
- **Web Search** — Brave Search API integration
- **URL Browser** — Fetch and analyze any public web page
- **Compliance Center** — AI tool inventory, PII dashboard, governance docs, disclosure management
- **Operations Dashboard** — Service health, cross-repo contracts, feature gates, roadmap
- **Daily Digest** — Automated email summary via Postmark
- **Google OAuth + RBAC** — Role-based access (admin/partner/user/intern)
- **Mobile Responsive** — Sidebar drawer, full-width chat, touch-optimized

## Architecture

```
PWOS Core (single deployment)
├── React 19 + Tailwind v4 (frontend)
├── Hono 4 (API server, serves frontend)
├── 4-Layer PII Guard Pipeline
├── 20 Tools (8 local + extensible via HTTP)
├── Gemma Engine (optional local AI)
└── LLM API (Claude/GPT/Gemini with tool_use)
    ├── PostgreSQL (Drizzle ORM, 12 tables)
    ├── Redis (sessions)
    └── External tool services (HTTP)
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
| LLM | @anthropic-ai/sdk (extensible to OpenAI, Google) |
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

## For Family Offices

Same compliance-grade infrastructure without the compliance overhead. Use it for your family's financial research with the confidence that PII is protected and everything is auditable.

## For Builders

Fork it. Add your own tools. Build agents for your specific workflow. The tool orchestration system is extensible — define a tool schema, implement the handler, and Claude will use it automatically.

## License

Apache License 2.0 — includes a perpetual, royalty-free patent grant. If you sue Protocol Wealth for patent infringement related to this software, your license terminates.

See [LICENSE](LICENSE) for full terms.

## Defensive Patent

Protocol Wealth LLC holds a defensive patent on the compliance-first AI operating system architecture. The patent exists solely to prevent patent trolls from restricting use of this technology. Under Apache 2.0, you receive an automatic patent grant.

## Contributing

PRs welcome. Please read the code conventions in CLAUDE.md before contributing.

## Links

- [Demo](https://pwos.app/#/demo) — Product showcase
- [Open Source Manifesto](https://pwos.app/#/opensource) — Why this is open source
- [Patent Documentation](https://pwos.app/#/patent) — Defensive patent claims
- [Disclosures](https://pwos.app/#/disclosures) — Regulatory disclosures

---

*Built by [Protocol Wealth LLC](https://protocolwealthllc.com) — SEC-Registered Investment Adviser (CRD #335298)*
