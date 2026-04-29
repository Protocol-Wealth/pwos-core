---
"@protocolwealthos/mcp-tools": minor
---

Add the **confirmation gate** framework for write-class LLM tools.

Two-turn pattern: first call returns a deterministic preview + a `confirm_token` bound to the exact payload (sha256 over key-sorted JSON, truncated to 16 hex chars). Second call requires the matching token; any payload mutation invalidates the binding and the gate refuses to execute. Stateless — the token IS the contract.

```ts
import { confirmGate, computeConfirmToken } from "@protocolwealthos/mcp-tools";

const outcome = await confirmGate({
  payload,
  confirmToken: input.confirm_token,
  operationLabel: "create record",
  renderPreview: (p) => `Will create "${p.name}" with amount ${p.amount}.`,
  execute: (p) => upstream.createRecord(p),
});

switch (outcome.phase) {
  case "preview":  return { ok: true, content: outcome.previewMessage };
  case "executed": return { ok: true, content: JSON.stringify(outcome.result) };
  case "rejected": return { ok: false, error: outcome.error, code: outcome.code };
}
```

New exports: `confirmGate`, `computeConfirmToken`, `stableJsonString`, `formatPreviewMessage`, `CONFIRM_TOKEN_LENGTH`, types `ConfirmGateOptions`, `ConfirmGateOutcome`, `PreviewMessageArgs`.

The result type is fully generic — callers adapt the discriminated `phase` outcome to whatever envelope their tool surface uses (Anthropic content blocks, MCP results, etc.).
