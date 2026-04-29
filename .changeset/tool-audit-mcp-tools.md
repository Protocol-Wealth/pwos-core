---
"@protocolwealthos/mcp-tools": minor
---

Add the **tool-call audit row builder** — `buildToolAuditEntry()` — for compliance-grade per-tool-call audit trails in multi-turn LLM loops.

Pure function: takes the raw tool input, the SCRUBBED tool output (i.e. AFTER a PII scanner has run), and the call metadata, and produces a `NewAuditEntry`-shaped record. SHA-256 hashes are computed over a stable JSON serialization of the input and over the scrubbed output text — the audit log itself can never become a correlation oracle for raw PII.

Drops directly into `@protocolwealthos/audit-log`'s `AuditLogger.log()`, but stays dependency-free so it works with any audit backend.

```ts
import { AuditLogger } from "@protocolwealthos/audit-log";
import { buildToolAuditEntry } from "@protocolwealthos/mcp-tools";

const t0 = Date.now();
const result = await executeTool(name, input, ctx);
const scrubbed = scrubPII(result.text);

await logger.log(buildToolAuditEntry({
  actorId: session.sub,
  toolName: name,
  toolUseId: block.id,
  conversationId: convo.id,
  requestId: req.id,
  rawInput: input,
  scrubbedOutputText: scrubbed,
  ok: result.ok,
  latencyMs: Date.now() - t0,
  outputSanitized: scrubbed !== result.text,
}));
```

New exports: `buildToolAuditEntry`, `sha256Hex`, constants `DEFAULT_TOOL_CALLED_ACTION`, `SYSTEM_ACTOR_ID`, `TOOL_AUDIT_RESOURCE_TYPE`, types `ToolAuditEntry`, `ToolAuditEntryInput`, `ToolAuditDetails`.
