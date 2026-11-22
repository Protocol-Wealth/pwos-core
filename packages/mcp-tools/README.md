# @protocolwealthos/mcp-tools

> Library-agnostic MCP tool definitions, registry, tier classification, and response-filter pipeline for advisor-platform LLM orchestration.

MIT-0 OR Apache-2.0 · part of [pwos-core](https://github.com/Protocol-Wealth/pwos-core).

## Quick start

```ts
import {
  ToolRegistry,
  ToolTier,
  toAnthropicTools,
} from "@protocolwealthos/mcp-tools";

const registry = new ToolRegistry();
registry.register({
  name: "portfolio_summary",
  description: "Return an advisor's portfolio summary.",
  tier: ToolTier.ADVISOR,
  input_schema: {
    type: "object",
    properties: { client_id: { type: "string" } },
    required: ["client_id"],
  },
});

const anthropicTools = toAnthropicTools(
  registry.listForTier(ToolTier.ADVISOR),
);
```

## What ships

- **`ToolRegistry`** with `ToolTier` classification (`isAuthorizedFor`, `tierFilter`, `tierRank`).
- **Filters:** `applyFilters`, `disclaimerFilter`, `observerFilter`, `piiRedactionFilter`, `publicTierSanitizer`.
- **Confirmation gate:** `confirmGate`, `issueConfirmToken`, `InMemoryConfirmTokenStore`.
- **Adapters / audit:** `toAnthropicTools`, `buildToolAuditEntry`.

Defensive patent: [USPTO #64/034,215](https://patentcenter.uspto.gov/applications/64034215).

## License

Licensed under MIT-0 OR Apache-2.0, at your option.
