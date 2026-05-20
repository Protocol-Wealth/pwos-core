# rias-agent-substrate

Reference implementation of the **three-tier agent memory architecture** for AI agents in an RIA (Registered Investment Adviser) context.

Companion to the architecture doc at [`docs/three-tier-agent-memory-architecture.md`](../../docs/three-tier-agent-memory-architecture.md). The canonical ADR lives in the consumer-side `shared/architecture/decisions/ADR-three-tier-agent-memory.md` (referenced from `pwos-core/docs/CANONICAL-PATTERNS.md` Pattern #7).

## What this demonstrates

An AI agent operating in an RIA context has three legitimate memory scopes — per-client, per-advisor, and per-firm. Each scope has different retention, access control, and audit requirements. This example shows how to compose the three tiers against pwos-core substrate primitives (`@protocolwealthos/audit-log` + `@protocolwealthos/pii-guard` + `@protocolwealthos/ai-guardrails`) without leaking context across scope boundaries.

The example is **storage-agnostic** by design — `MemoryStore<T>` interfaces let you plug in Postgres, DynamoDB, or any other backing store. In-memory implementations ship with the example for testing and exploration.

## The three tiers

| Tier | Scope | What it remembers | Storage shape |
|---|---|---|---|
| **Per-client** | One client across all advisor sessions | Goals, preferences, decision history, document signatures, communication style | Composed from existing `client_profile` + `audit_log` principal-chain queries (no new table) |
| **Per-advisor** | One advisor across their book of business | Methodology preferences, common workflows, expertise areas, prior session decisions | New `advisor_memory` table; advisor_id-scoped |
| **Per-firm** | All advisors and clients; firm-wide state | Compliance state, vendor relationships, policies, ADRs, CCO-approved patterns | Derived from version-controlled markdown (no Postgres table) |

The composition is **always in this order**: per-firm context (broadest, read-only) → per-advisor context (advisor scope) → per-client context (most-scoped, principal-chain-authorized).

## Runnable demo

The example includes a runnable demo that closes the loop end-to-end —
composes context across all three tiers, makes a real LLM call (against the
Anthropic API when `ANTHROPIC_API_KEY` is set, or a deterministic mock when
it isn't), and writes the 5-audit-row trail. This is the **first production
consumer** path for Pattern #7.

```sh
# From the pwos-core repo root:
pnpm install
pnpm --filter @protocolwealthos-examples/rias-agent-substrate run demo

# With a real LLM call:
ANTHROPIC_API_KEY=sk-ant-... pnpm --filter @protocolwealthos-examples/rias-agent-substrate run demo
```

The demo prints the composed system prompt + LLM response + the 5 audit-log
rows that landed: chain-establishment anchor + per-tier memory_read rows +
the `agent.llm.call_completed` row referencing the anchor with a
content-free `AiCallAuditRow` (hash-based prompt + response + token-usage)
in its details payload.

When `@anthropic-ai/sdk` is installed and `ANTHROPIC_API_KEY` is present,
the LLM call hits the real API; otherwise the demo prints a notice and
uses a deterministic mock client so the audit-row trail still demonstrates
end-to-end. Tests stay hermetic via the same mock pattern.

## Quickstart (programmatic)

```ts
import { RIAAgentSubstrate, InMemoryClientMemoryStore, InMemoryAdvisorMemoryStore, InMemoryFirmMemorySource } from "./src/index.js";
import { AuditLogger, InMemoryAuditStore } from "@protocolwealthos/audit-log";

// Wire the substrate
const audit = new AuditLogger({ store: new InMemoryAuditStore() });
const substrate = new RIAAgentSubstrate({
  audit,
  clientMemoryStore: new InMemoryClientMemoryStore(),
  advisorMemoryStore: new InMemoryAdvisorMemoryStore(),
  firmMemorySource: new InMemoryFirmMemorySource({
    policies: [{ slug: "ai-governance", title: "AI Governance Policy", body: "..." }],
    adrs: [{ slug: "ADR-PII-tagging", title: "PII Tagging at Ingestion", status: "ACCEPTED" }],
  }),
});

// Compose context for an agent session
const context = await substrate.buildAgentContext({
  advisorId: "advisor_xyz",
  clientId: "client_abc",
  sessionId: "sess_123",
});

// context.firmMemory  → read-only firm-wide policies + ADRs + CCO patterns
// context.advisorMemory → advisor's methodology + workflows (RLS-scoped to advisor_id)
// context.clientMemory  → client's goals + decision history (RLS + principal-chain-scoped)
// context.principalChain → { advisorId, sessionId, clientId, audit_log entry id }
```

Every composition writes an `audit_log` row capturing which tiers were accessed and which principal chain authorized the access — the agent's own context-assembly is audit-trail-eligible by construction.

## Substrate enforcement summary

- **PII tagging at the memory-read boundary** — `pii.high` fields excluded from LLM-bound payloads unless explicit waiver authorizes the field path. Inherits `@protocolwealthos/pii-guard` 4-layer scanning posture.
- **Row-level security at the query layer** — production consumers wire Postgres RLS policies on `client_profile` (client_id scope) and `advisor_memory` (advisor_id scope); the example demonstrates the scope-enforcement contract via TypeScript interfaces, with `unauthorized` thrown when scope-mismatch is attempted.
- **Principal-chain authorization** — every cross-tier read records the principal chain (advisor → session → client) in the audit log. The chain is what makes "the agent saw client X's data" auditable down to which advisor session authorized the read.
- **Read-only firm tier** — no write path exists for per-firm memory in code. Per-firm memory updates are version-control commits in the firm's `shared/` repo, not API calls.

## Adopter posture

This example is **not a production library** — it's a reference for how to compose pwos-core primitives into an agent-memory architecture. Adopters typically:

1. Implement `ClientMemoryStore<T>` against their Postgres + RLS policy stack
2. Implement `AdvisorMemoryStore<T>` against their `advisor_memory` table migration
3. Implement `FirmMemorySource` against their version-controlled compliance + ADR substrate (often as a build-time derivation step)
4. Compose with `RIAAgentSubstrate` and inject into their agent runtime

The composition contract is what's canonical; the storage implementation is yours.

## Boundaries

- No PII in source / tests / fixtures (per pwos-core boundaries; tests use synthetic `client_test_*` ids)
- No network calls in tests (hermetic by construction)
- No framework coupling (no Hono/Express/React assumed; agnostic at the substrate layer)

## License

Apache 2.0. See [../../LICENSE](../../LICENSE).
