# @protocolwealthos/ai-guardrails

> Safety primitives for calling Anthropic-style LLM APIs from regulated environments.

MIT-0 OR Apache-2.0 · Patent Pending: USPTO #64/034,215 · part of [pwos-core](https://github.com/Protocol-Wealth/pwos-core).

## Why this exists

Off-the-shelf LLM SDKs are designed for ergonomics, not regulated use. A few of the things they don't do for you:

- **Workspace assertion** — compare a configured workspace id at boot, and optionally a fingerprint of the credential that will sign requests. This does not query the provider and does not prove a retention policy.
- **Model-string discipline** — keep vendor model ids out of the application; resolve aliases (FRONTIER / WORKHORSE / EXTRACTION) from env at boot.
- **Prompt-cache hygiene** — mark a prefix cacheable; refuse to mark a prefix cacheable if it contains client PII.
- **Content-free audit rows** — record `sha256(prompt)`, `sha256(response)`, `sha256(tool_use)` plus model id, token counts, and trace id. Never raw content.

This package is the boot-time + per-request + per-response composable that gives you those four things. It does not pull in a vendor SDK.

> `assertWorkspace` is a configuration assertion. Matching workspace ids do not prove that the credential signing a call belongs to that workspace, and they do not prove the provider's retention policy. Bind `fingerprintCredential` of the live signing key to an allowlist you maintain separately, and treat provider retention as evidence from the provider, not from this helper.

## Install

```sh
pnpm add @protocolwealthos/ai-guardrails
```

## Quick start

```ts
import {
  assertWorkspaceFromEnv,
  fingerprintCredential,
  createModelResolver,
  markCacheable,
  buildAuditRow,
} from "@protocolwealthos/ai-guardrails";

// 1. Boot — configured workspace id. This does not prove retention.
//    To also reject a rotated signing key, pass its fingerprint and an
//    allowlist that is not derived from the live key at boot.
const ALLOWED_SIGNING_FINGERPRINTS = ["<sha256 hex of each enrolled signing key>"];
assertWorkspaceFromEnv("ws_expected", "ANTHROPIC_WORKSPACE_ID", "block", {
  credential: {
    source: "env:ANTHROPIC_API_KEY",
    fingerprint: fingerprintCredential(process.env.ANTHROPIC_API_KEY ?? ""),
  },
  allowedCredentialFingerprints: ALLOWED_SIGNING_FINGERPRINTS,
});

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
| `assertWorkspace` / `assertWorkspaceFromEnv` | Compare a configured workspace id. Optional signing-credential fingerprint allowlist. `retentionVerified` is always `false`. Default posture is `block`; `warn` returns `{ ok: false }` instead of throwing. |
| `fingerprintCredential` | SHA-256 hex of the credential that will sign requests. Content-free; do not log the input. |
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

- Not a provider retention probe, and not proof that a signing credential belongs to a workspace. `ok: true` means the checks you configured passed.
- Not a model-call SDK. Use the vendor SDK (`@anthropic-ai/sdk`) for transport.
- Not a prompt-injection detector. Use [`@protocolwealthos/pii-guard`](../pii-guard) `detectInjection` for that.
- Not an observability tracer. Pass your trace id through `buildAuditRow` and let your tracer handle the rest.

## License

Licensed under either MIT-0 or Apache-2.0, at your option. Defensive patent posture: USPTO Application #64/034,215. See repo `LICENSE-MIT-0`, `LICENSE-APACHE`, `NOTICE`, and `PATENTS`.
