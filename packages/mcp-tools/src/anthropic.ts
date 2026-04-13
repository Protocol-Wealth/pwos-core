// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * Adapter: pwos-core ToolDefinition ↔ Anthropic Messages API tool_use.
 *
 * This adapter has no runtime dependency on ``@anthropic-ai/sdk`` — it
 * emits plain objects shaped the way the SDK expects. Downstream
 * projects can pass the result directly to ``messages.create`` as the
 * ``tools`` array.
 *
 * If you use a different MCP host (Cursor, Claude Desktop via stdio,
 * OpenAI function calling), write a sibling adapter following the same
 * pattern.
 */

import type { JsonSchema, ToolDefinition } from "./types.js";

/** Subset of ``Anthropic.Messages.Tool`` needed at the call site. */
export interface AnthropicToolShape {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

/** Convert one tool definition to the Anthropic tool_use shape. */
export function toAnthropicTool(tool: ToolDefinition): AnthropicToolShape {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: {
      type: "object",
      properties: stripExtensions(tool.input_schema.properties ?? {}),
      required: tool.input_schema.required ?? [],
    },
  };
}

/** Convert an array of tool definitions. */
export function toAnthropicTools(tools: readonly ToolDefinition[]): AnthropicToolShape[] {
  return tools.map(toAnthropicTool);
}

/**
 * Drop non-standard JSON-Schema keys the Anthropic API doesn't understand.
 * Anthropic accepts standard Draft 2020-12 but treats unknown keys as
 * validation errors in some SDK versions — be defensive.
 */
function stripExtensions(
  props: Record<string, JsonSchema>,
): Record<string, unknown> {
  const ALLOWED = new Set<string>([
    "type",
    "description",
    "properties",
    "required",
    "items",
    "enum",
    "minimum",
    "maximum",
    "minLength",
    "maxLength",
    "pattern",
    "default",
    "additionalProperties",
  ]);

  const out: Record<string, unknown> = {};
  for (const [key, schema] of Object.entries(props)) {
    out[key] = cleanSchema(schema, ALLOWED);
  }
  return out;
}

function cleanSchema(schema: JsonSchema, allowed: Set<string>): unknown {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema)) {
    if (!allowed.has(k)) continue;
    if (k === "properties" && v && typeof v === "object") {
      result[k] = stripExtensions(v as Record<string, JsonSchema>);
    } else if (k === "items" && v && typeof v === "object") {
      result[k] = cleanSchema(v as JsonSchema, allowed);
    } else {
      result[k] = v;
    }
  }
  return result;
}
