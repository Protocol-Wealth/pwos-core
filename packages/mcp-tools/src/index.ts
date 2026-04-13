// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * @pwos/mcp-tools
 *
 * Library-agnostic MCP (Model Context Protocol) tool definitions,
 * registry, tier classification, and response-filter pipeline. Ships
 * adapters to the Anthropic Messages API and exposes the primitives
 * other SDKs can plug into.
 *
 * Quick start::
 *
 *     import {
 *       ToolRegistry,
 *       ToolTier,
 *       applyFilters,
 *       disclaimerFilter,
 *       toAnthropicTools,
 *     } from "@pwos/mcp-tools";
 *
 *     const registry = new ToolRegistry();
 *     registry.register({
 *       name: "portfolio_summary",
 *       description: "Return an advisor's portfolio summary.",
 *       tier: ToolTier.ADVISOR,
 *       input_schema: {
 *         type: "object",
 *         properties: { client_id: { type: "string" } },
 *         required: ["client_id"],
 *       },
 *     });
 *
 *     const anthropicTools = toAnthropicTools(
 *       registry.listForTier(ToolTier.ADVISOR),
 *     );
 *
 * Defensive patent: USPTO #64/034,215.
 */

export const VERSION = "0.1.0";

export {
  type AnthropicToolShape,
  toAnthropicTool,
  toAnthropicTools,
} from "./anthropic.js";

export {
  type ResponseFilter,
  applyFilters,
  disclaimerFilter,
  observerFilter,
  piiRedactionFilter,
  publicTierSanitizer,
} from "./filters.js";

export {
  ToolNameConflictError,
  ToolNotFoundError,
  ToolRegistry,
} from "./registry.js";

export { isAuthorizedFor, tierFilter, tierRank } from "./tier.js";

export {
  type AuthContext,
  type JsonSchema,
  type ObjectSchema,
  type ToolAnnotations,
  type ToolDefinition,
  type ToolResult,
  ToolTier,
} from "./types.js";
