// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * Core types for MCP tool definitions.
 *
 * The shape is intentionally library-agnostic — no dependency on
 * @anthropic-ai/sdk or @modelcontextprotocol/sdk. Adapters convert
 * these types into the vendor-specific shape at the edge.
 *
 * Tool input schemas follow JSON Schema Draft 2020-12 (same subset the
 * Anthropic Messages API accepts). Keep schemas simple — deeply nested
 * objects with unions tend to confuse both LLMs and compliance reviewers.
 */

/** JSON Schema fragment describing a tool's input payload. */
export interface JsonSchema {
  type: "object" | "string" | "number" | "integer" | "boolean" | "array" | "null";
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: readonly (string | number | boolean | null)[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  default?: unknown;
  additionalProperties?: boolean | JsonSchema;
  [key: string]: unknown;
}

/** Object-typed schema — the canonical shape for MCP tool inputs. */
export interface ObjectSchema extends JsonSchema {
  type: "object";
  properties: Record<string, JsonSchema>;
  required?: string[];
}

/** Tool definition. */
export interface ToolDefinition {
  /** Stable, machine-readable name. Use `snake_case`; unique per registry. */
  name: string;
  /** LLM-facing description. Should start with a verb and describe side-effects. */
  description: string;
  /** JSON Schema for the tool's input payload. */
  input_schema: ObjectSchema;
  /** Access classification for this tool. Controls who can invoke it. */
  tier?: ToolTier;
  /** Optional tags for filtering (e.g., "read", "write", "financial"). */
  tags?: readonly string[];
  /** Optional UI hints — safe to ignore. */
  annotations?: ToolAnnotations;
}

/** Access tiers for tool invocation — inspired by Nexus MCP four-tier model. */
export enum ToolTier {
  /** Anyone can invoke. No auth, no PII, no client-specific data. */
  PUBLIC = "public",
  /** Requires advisor authentication. Firm-wide data, research, non-client. */
  ADVISOR = "advisor",
  /** Advisor auth + per-client PII filter on outputs. */
  CLIENT_FILTERED = "client_filtered",
  /** Advisor auth + explicit client consent. Full PII in outputs. */
  SENSITIVE = "sensitive",
}

/** Optional UI hints consumed by some MCP hosts (Claude Desktop, Cursor, etc.). */
export interface ToolAnnotations {
  /** Human-friendly title. Useful when the raw name is cryptic. */
  title?: string;
  /** True iff the tool only reads data. */
  readOnlyHint?: boolean;
  /** True iff invoking the tool may have visible external effects. */
  destructiveHint?: boolean;
  /** True iff idempotent — same input → same output, safe to retry. */
  idempotentHint?: boolean;
  /** True iff the tool interacts with unpredictable external systems. */
  openWorldHint?: boolean;
}

/** Generic tool invocation result. */
export interface ToolResult<T = unknown> {
  /** The tool name that produced this result. */
  tool: string;
  /** Whether the invocation succeeded. */
  ok: boolean;
  /** Payload for successful invocations. */
  data?: T;
  /** Error info for failed invocations. */
  error?: { code: string; message: string; cause?: unknown };
  /** Metadata — latency, cache-hit, upstream version, etc. */
  meta?: Record<string, unknown>;
}

/** Context passed to filters and handlers for policy decisions. */
export interface AuthContext {
  /** Tier the caller is authorized for. Defaults to PUBLIC if unset. */
  tier?: ToolTier;
  /** Arbitrary identifier for the caller (user id, service name, etc.). */
  subject?: string;
  /** Allow-list of specific client ids the caller may access. */
  allowedClientIds?: readonly string[];
  /** Free-form extensions — audit ids, correlation ids, etc. */
  extra?: Record<string, unknown>;
}
