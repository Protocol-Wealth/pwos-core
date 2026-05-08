// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Per-call audit row builder for AI inference.
 *
 * Records hashes — never raw content. Why: the AI audit trail's purpose
 * is correlation (which actor, which model, which call, what shape of
 * output), not retention of the messages themselves. Retaining hashes
 * lets you prove a request happened and lets you correlate against an
 * out-of-band content store (or none, if your posture is store-nothing),
 * without making the audit log itself a PII liability.
 *
 * Pairs with `@protocolwealthos/audit-log` — the row produced here is
 * intended to be wrapped in an `AuditEntry` and fed into the hash chain.
 */

import { createHash } from "node:crypto";
import type { AiCallAuditRow, ModelAlias, ResponseLike } from "./types.js";

/**
 * Stable, key-sorted JSON used as the canonical preimage for hashing.
 * Replays the algorithm from `@protocolwealthos/mcp-tools` so the same
 * payload always produces the same hash regardless of property order.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map((v) => canonicalJson(v)).join(",") + "]";
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const parts = keys.map(
    (k) => JSON.stringify(k) + ":" + canonicalJson((value as Record<string, unknown>)[k])
  );
  return "{" + parts.join(",") + "}";
}

export function sha256Hex(value: string | Uint8Array): string {
  const h = createHash("sha256");
  h.update(value);
  return h.digest("hex");
}

/**
 * Hash an arbitrary payload (canonicalized) — useful for prompt and
 * response shapes that are object trees.
 */
export function hashPayload(value: unknown): string {
  return sha256Hex(canonicalJson(value));
}

interface ToolUseBlock {
  type: "tool_use";
  name?: string;
  input?: unknown;
}

/**
 * Walk a response's content array and return the canonical sha256 of
 * each tool_use block. Order preserved.
 */
export function extractToolCallHashes(content: unknown): string[] {
  if (!Array.isArray(content)) return [];
  const hashes: string[] = [];
  for (const block of content) {
    if (
      block &&
      typeof block === "object" &&
      (block as { type?: unknown }).type === "tool_use"
    ) {
      const tu = block as ToolUseBlock;
      hashes.push(hashPayload({ name: tu.name, input: tu.input }));
    }
  }
  return hashes;
}

export interface BuildAuditRowInput {
  requestId: string;
  actorId: string;
  model: string;
  modelAlias: ModelAlias;
  /** The full request payload sent to the model (will be canonicalized + hashed). */
  request: unknown;
  /** The full response object (or null on error). */
  response: ResponseLike | null;
  traceId?: string | null;
  errorClass?: string | null;
  latencyMs: number;
  /** Optional clock injection for tests. Defaults to `Date.now()`. */
  now?: () => number;
}

/**
 * Construct an `AiCallAuditRow` from a request/response pair.
 *
 * On success: prompt hashed, response hashed, tool-call hashes extracted,
 * token-usage propagated.
 *
 * On error: response & token fields are zero/null; `errorClass` carries
 * the failure-class taxonomy bucket (caller-supplied).
 */
export function buildAuditRow(input: BuildAuditRowInput): AiCallAuditRow {
  const promptHash = hashPayload(input.request);
  const response = input.response;
  const responseHash = response ? hashPayload(response) : null;
  const toolCallHashes = response
    ? extractToolCallHashes(response.content)
    : [];
  const usage = response?.usage ?? {};
  const now = (input.now ?? Date.now)();
  return {
    requestId: input.requestId,
    actorId: input.actorId,
    model: input.model,
    modelAlias: input.modelAlias,
    promptHash,
    responseHash,
    toolCallHashes,
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    cacheReadInputTokens: usage.cache_read_input_tokens ?? 0,
    cacheCreationInputTokens: usage.cache_creation_input_tokens ?? 0,
    traceId: input.traceId ?? null,
    errorClass: input.errorClass ?? null,
    latencyMs: input.latencyMs,
    at: now,
  };
}
