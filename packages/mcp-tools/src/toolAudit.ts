// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * Per-tool-call audit row builder.
 *
 * Designed to be invoked after every LLM tool dispatch in a multi-turn
 * loop. Produces a compliance-ready audit record with hashed inputs and
 * outputs, never with raw PII.
 *
 * Hashing model: SHA-256 over a stable JSON serialization (key-sorted
 * recursively). Inputs are hashed via {@link stableJsonString}; outputs
 * are hashed over the SCRUBBED text — i.e. AFTER a PII scanner has
 * replaced PII with placeholders. That way the audit log itself can
 * never become a correlation oracle for raw PII. If a tool's output
 * had no detected PII, the "scrubbed" text equals the raw text and the
 * hash is the same — no information loss for honest reconstruction,
 * no leakage for adversarial reuse.
 *
 * The output is shaped to drop directly into
 * `@protocolwealthos/audit-log`'s `AuditLogger.log()`, but stays
 * dependency-free so it can be used with any audit backend.
 *
 * @example
 * import { AuditLogger } from "@protocolwealthos/audit-log";
 * import { buildToolAuditEntry } from "@protocolwealthos/mcp-tools";
 *
 * const entry = buildToolAuditEntry({
 *   actorId: session.sub,
 *   toolName: "gmail_search",
 *   toolUseId: block.id,
 *   conversationId: convo.id,
 *   requestId: req.id,
 *   rawInput: block.input,
 *   scrubbedOutputText: scrubbed,
 *   ok: result.ok,
 *   latencyMs: Date.now() - t0,
 *   outputSanitized: scrubbed !== rawText,
 * });
 * await logger.log(entry);
 */

import { createHash } from "node:crypto";

import { stableJsonString } from "./confirmationGate.js";

/** Default action label written to `audit.action`. */
export const DEFAULT_TOOL_CALLED_ACTION = "ai.tool.called";

/** Default `resourceType` written for tool-call audit rows. */
export const TOOL_AUDIT_RESOURCE_TYPE = "ai.tool";

/** Sentinel actor used when the call has no associated user (system / cron). */
export const SYSTEM_ACTOR_ID = "system";

/** Inputs to {@link buildToolAuditEntry}. */
export interface ToolAuditEntryInput {
  /**
   * Stable identifier of the user who initiated the call (e.g. session
   * sub, user id, email). Pass `null` for system-initiated calls;
   * the resulting entry will use {@link SYSTEM_ACTOR_ID}.
   */
  actorId: string | null;
  /** Registered tool name (e.g. `"gmail_search"`). */
  toolName: string;
  /** Vendor-supplied tool-use id (Anthropic `tool_use.id`, etc.). */
  toolUseId?: string | null;
  /** Conversation id, for correlation with the conversations table. */
  conversationId?: string | null;
  /** Request id, mirrored into the audit row's request_id field. */
  requestId?: string | null;
  /** Raw tool input as the LLM emitted it. May be string / object / null. */
  rawInput: unknown;
  /**
   * Tool output text AFTER a PII scrubber has run. If the call errored,
   * pass the error message. The hash of THIS string is what gets
   * persisted — never the raw, possibly-PII-bearing output.
   */
  scrubbedOutputText: string;
  /** Whether the tool call succeeded. */
  ok: boolean;
  /** Stable error code when `ok === false` (e.g. `"upstream_5xx"`). */
  errorCode?: string | null;
  /** End-to-end tool execution latency in milliseconds. */
  latencyMs: number;
  /** True iff the PII scrubber actually replaced anything in the output. */
  outputSanitized: boolean;
  /** Override the default `"ai.tool.called"` action label. */
  action?: string;
}

/** Structured payload written to the audit row's `details` field. */
export interface ToolAuditDetails {
  /** "user" when an actorId was supplied, "system" otherwise. */
  actor_type: "user" | "system";
  tool_use_id: string | null;
  conversation_id: string | null;
  request_id: string | null;
  /** SHA-256 hex of `stableJsonString(rawInput)`. */
  input_hash: string;
  /** SHA-256 hex of `scrubbedOutputText`. */
  output_hash: string;
  ok: boolean;
  error_code: string | null;
  latency_ms: number;
  output_sanitized: boolean;
}

/**
 * Audit-log entry shape (matches `@protocolwealthos/audit-log`'s
 * `NewAuditEntry`). Pass directly to `AuditLogger.log()` or consume
 * the fields with any other audit backend.
 */
export interface ToolAuditEntry {
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details: ToolAuditDetails;
}

/** SHA-256 over a UTF-8 string, returned as 64-char lowercase hex. */
export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Build an audit-log entry for a single tool call. Pure function: no
 * I/O, no clock, no logging. The caller decides where to write it.
 */
export function buildToolAuditEntry(
  input: ToolAuditEntryInput,
): ToolAuditEntry {
  const inputHash = sha256Hex(stableJsonString(input.rawInput));
  const outputHash = sha256Hex(input.scrubbedOutputText);
  return {
    actorId: input.actorId ?? SYSTEM_ACTOR_ID,
    action: input.action ?? DEFAULT_TOOL_CALLED_ACTION,
    resourceType: TOOL_AUDIT_RESOURCE_TYPE,
    resourceId: input.toolName,
    details: {
      actor_type: input.actorId ? "user" : "system",
      tool_use_id: input.toolUseId ?? null,
      conversation_id: input.conversationId ?? null,
      request_id: input.requestId ?? null,
      input_hash: inputHash,
      output_hash: outputHash,
      ok: input.ok,
      error_code: input.errorCode ?? null,
      latency_ms: input.latencyMs,
      output_sanitized: input.outputSanitized,
    },
  };
}
