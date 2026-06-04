# PWOS + SmythOS (reference integration)

> Forward-looking compatibility note, not a partnership. SmythOS does **not** integrate PWOS today; this document describes how an MCP-compatible agent platform *can* call the PWOS compliance/credential layer over the open Model Context Protocol. Pair with [`docs/CANONICAL-PATTERNS.md`](./CANONICAL-PATTERNS.md) and the `@protocolwealthos/*` packages it references.

## What this is

[SmythOS](https://smythos.com) is an open-source (MIT) agent operating system: a visual builder (Agent Studio), a small cloud-to-edge runtime kernel (the Smyth Runtime Environment), and an SDK/CLI for building and deploying autonomous AI agents. It is general-purpose — any LLM, any task — and embraces open standards: it ships an MCP (Model Context Protocol) client **and** server, and supports agent-to-agent (A2A) collaboration. It does not carry a built-in compliance, PII, or audit layer; that is adopter-supplied.

PWOS is the other half of that sentence. The `@protocolwealthos/*` primitives in this repo are the RIA compliance/credential layer an agent can call — or be wrapped by — when it operates in a regulated-finance context:

- **`@protocolwealthos/pii-guard`** — 4-layer PII scanner + streaming rehydrator at the LLM call boundary.
- **`@protocolwealthos/audit-log`** — append-only, SHA-256 hash-chained record of every tool call and decision (SEC Rule 204-2 / 17a-4 shape).
- **`@protocolwealthos/mcp-tools`** — tool registry with 4-tier access classification and `confirmGate()`, the payload-bound two-turn gate for write tools.
- **`@protocolwealthos/disclosure-card`** — machine-readable AI-system disclosure schema.
- **`@protocolwealthos/shared`** — the `hitl` (human-in-the-loop) and `provenance` governance primitives.

SmythOS runs the agents. PWOS supplies the compliance and credential layer those agents call. The connection point is the open Model Context Protocol — nothing PW-proprietary sits between them.

## The interop primitive that exists today

The architecturally-true, present-tense fact: the sibling repo [`nexus-core`](https://github.com/Protocol-Wealth/nexus-core) already exposes a public, read-only MCP-over-HTTP server at [`https://nexusmcp.site/mcp`](https://nexusmcp.site/mcp) (no account, no auth). Any MCP-compatible client — Claude, GPT, Gemini, or an agent platform such as SmythOS — can connect to it and call those tools. The interop *primitive* is live now; the SmythOS *relationship* is not.

That is the whole basis for compatibility: MCP is an open protocol, both sides speak it, so an MCP client on one end can reach an MCP server on the other. No integration code, no endorsement, and no mutual product relationship is implied by that fact.

## How the layers compose (reference shape)

This is a reference shape, not a shipped product. An adopter wiring an MCP agent platform into a regulated workflow would compose the layers like this:

```
  SmythOS agent (runs the agent; speaks MCP)
        │  MCP (open Model Context Protocol)
        ▼
  PWOS compliance/credential layer (adopter-composed)
        ├── pii-guard      → scrub PII before any LLM / tool egress
        ├── mcp-tools tier + confirmGate() → authorize + two-turn-gate write tools
        ├── hitl           → require a human sign-off where the tier demands it
        ├── disclosure-card → surface the machine-readable AI-system disclosure
        └── audit-log      → hash-chained record of every call + decision
        │
        ▼
  MCP server(s) the agent ultimately calls
        └── e.g. nexus-core read-only MCP server at nexusmcp.site/mcp
```

Two composition directions are equally valid, and which one an adopter picks is their CCO's call:

- **Agent calls PWOS.** An MCP-compatible agent — SmythOS among them — can treat a PWOS-backed surface as one of its MCP tool sources. The read-only research surface is callable by any MCP client today (nexus-core); a credential/compliance surface in front of write actions is something an adopter would build, not something that ships today.
- **PWOS wraps the agent.** The adopter places the PWOS primitives *between* the agent and any consequential action — `pii-guard` at egress, `mcp-tools` tier + `confirmGate()` on writes, `hitl` for sign-off, `audit-log` on every step — so the agent platform stays general-purpose and the regulated controls live in the adopter's substrate.

In both directions, PWOS is the designed-for compliance/credential layer that an MCP agent platform *can* call or wrap. It is not adopted by SmythOS or by any third party, and this document does not claim otherwise.

## What this is / is not

**This is:** a description of compatibility via the open Model Context Protocol, and a reference shape for composing the `@protocolwealthos/*` compliance/credential primitives behind an MCP-compatible agent platform.

**This is not:** a partnership, an endorsement, a built or shipped integration, or a statement that SmythOS uses PWOS or that PWOS is adopted by any third party. SmythOS does not integrate PWOS today; any "works with SmythOS" reading is forward-looking and means MCP-protocol compatibility, not a product relationship.

## Adopter responsibilities

The compliance posture is the adopter's, not the framework's. As stated in the repo [README](../README.md) status note: adopters supply their own PII controls, access control, authentication, and data-handling boundaries appropriate to their regulatory context before any real or sensitive data touches the substrate, and are responsible for their own AI-provider data-handling posture. Composing PWOS primitives behind an agent platform does not transfer that responsibility; it gives the adopter the substrate to meet it and the audit trail to evidence it. This document is not legal advice.

## See also

- [`docs/CANONICAL-PATTERNS.md`](./CANONICAL-PATTERNS.md) — the production-scale patterns the primitives compose against.
- [`nexus-core`](https://github.com/Protocol-Wealth/nexus-core) — the live read-only MCP server foundation ([nexusmcp.site](https://nexusmcp.site)).
