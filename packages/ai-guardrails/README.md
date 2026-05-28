# @protocolwealthos/ai-guardrails

> Safety primitives for calling Anthropic-style LLM APIs from regulated environments.

Apache 2.0 · Patent Pending: USPTO #64/034,215 · part of [pwos-core](https://github.com/Protocol-Wealth/pwos-core).

## Why this exists

Off-the-shelf LLM SDKs are designed for ergonomics, not regulated use. A few of the things they don't do for you:

- **Workspace assertion** — verify at boot that a credential rotation hasn't silently moved your traffic to a non-ZDR / non-data-residency workspace.
- **Model-string discipline** — keep vendor model ids out of the application; resolve aliases (FRONTIER / WORKHORSE / EXTRACTION) from env at boot.
- **Prompt-cache hygiene** — mark a prefix cacheable; refuse to mark a prefix cacheable if it contains client PII.
- **Content-free audit rows** — record `sha256(prompt)`, `sha256(response)`, `sha256(tool_use)` plus model id, token counts, and trace id. Never raw content.

This package is the boot-time + per-request + per-response composable that gives you those four things. It does not pull in a vendor SDK.

> The workspace-assertion check is the runtime enforcement of Protocol Wealth's ZDR API-surface boundary. ZDR (zero data retention) is contractually applied at the Anthropic workspace level — by asserting the workspace ID at boot and on every model call, ai-guardrails prevents accidental routing through a non-ZDR-enrolled workspace or the Anthropic Workbench / Claude.ai surfaces (which are NOT in ZDR scope). See PW's canonical AI-posture statement at `shared/docs/compliance/wisp-ai-posture.md` v1.3 §1 bullet 4 (internal).

## Install

```sh
pnpm add @protocolwealthos/ai-guardrails
```

## Quick start

```ts
import {
  assertWorkspaceFromEnv,
  createModelResolver,
  markCacheable,
  buildAuditRow,
} from "@protocolwealthos/ai-guardrails";

// 1. Boot — fail fast if credential rotation routed us to a non-ZDR workspace.
assertWorkspaceFromEnv("ws_zdr_prod", "ANTHROPIC_WORKSPACE_ID");

// 2. Boot — refuse hardcoded model literals; aliases resolve from env.
const models = createModelResolver({
  aliases: {
    FRONTIER: "CLAUDE_MODEL_FRONTIER",
    WORKHORSE: "CLAUDE_MODEL_WORKHORSE",
    EXTRACTION: "CLAUDE_MODEL_EXTRACTION",
  },
  allowedPrefixes: ["claude-"],
});

// 3. Per-request — mark the system prompt + tool prefix cacheable.
const cachedSystem = markCacheable([
  { type: "text", text: SYSTEM_PROMPT },
  { type: "text", text: TOOL_GUIDANCE },
]);

// 4. Per-response — produce a content-free audit row for the chain.
const row = buildAuditRow({
  requestId: ctx.requestId,
  actorId: ctx.actorId,
  model: models.resolve("FRONTIER"),
  modelAlias: "FRONTIER",
  request: anthropicRequest,
  response: anthropicResponse,
  traceId: langfuseTraceId,
  latencyMs: Date.now() - startedAt,
});

// Feed the row into your audit log (e.g. @protocolwealthos/audit-log).
```

## What's in the box

| Export | Purpose |
|---|---|
| `assertWorkspace` / `assertWorkspaceFromEnv` | Fail-fast workspace check at boot. Default posture is `block` (throws); `warn` available for shadow modes. |
| `createModelResolver` | Resolve application model aliases from env, with optional vendor-prefix allowlisting. |
| `markCacheable` | Set Anthropic `cache_control: { type: "ephemeral" }` on the last block of a prefix. Returns a clone — never mutates. |
| `assertNoPiiInCachedPrefix` | Wire a PII scanner into the cache boundary. The scanner is caller-supplied; pair with [`@protocolwealthos/pii-guard`](../pii-guard). |
| `buildAuditRow` | Construct a content-free `AiCallAuditRow` from request + response. Hashes are sha256 of canonicalized JSON. |
| `canonicalJson` / `sha256Hex` / `hashPayload` | Building blocks if you need stable hashes elsewhere. |

## Designed to compose

- Pair `buildAuditRow` with [`@protocolwealthos/audit-log`](../audit-log) — the row's hash fields are stable enough to chain.
- Pair `assertNoPiiInCachedPrefix` with [`@protocolwealthos/pii-guard`](../pii-guard) `scan` — supply a wrapper that returns `{ ok: false, reason }` if `scan` finds an entity.
- Pair `createModelResolver` with a CI lint that grep's for hardcoded model strings outside the resolver module. The lint is the second half of the discipline; the resolver alone is a habit, not an enforcement.

## What this is *not*

- Not a model-call SDK. Use the vendor SDK (`@anthropic-ai/sdk`) for transport.
- Not a prompt-injection detector. Use [`@protocolwealthos/pii-guard`](../pii-guard) `detectInjection` for that.
- Not an observability tracer. Pass your trace id through `buildAuditRow` and let your tracer handle the rest.

## License

Apache 2.0 with USPTO Application #64/034,215 defensive patent grant. See repo `LICENSE`, `NOTICE`, and `PATENTS.txt`.
