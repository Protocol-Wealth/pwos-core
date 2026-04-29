// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
import { describe, expect, it } from "vitest";

import {
  DEFAULT_TOOL_CALLED_ACTION,
  SYSTEM_ACTOR_ID,
  TOOL_AUDIT_RESOURCE_TYPE,
  buildToolAuditEntry,
  sha256Hex,
} from "../src/index.js";

describe("sha256Hex", () => {
  it("matches a known SHA-256 vector for 'abc'", () => {
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("produces 64 lowercase hex chars", () => {
    expect(sha256Hex("anything")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("buildToolAuditEntry", () => {
  it("emits the canonical action + resourceType for a tool call", () => {
    const e = buildToolAuditEntry({
      actorId: "sub-12345",
      toolName: "gmail_search",
      toolUseId: "toolu_abc",
      conversationId: "conv-xyz",
      requestId: "req-789",
      rawInput: { q: "from:adam" },
      scrubbedOutputText: "gmail: 3 results from <EMAIL_1>",
      ok: true,
      latencyMs: 145,
      outputSanitized: true,
    });
    expect(e.action).toBe(DEFAULT_TOOL_CALLED_ACTION);
    expect(e.resourceType).toBe(TOOL_AUDIT_RESOURCE_TYPE);
    expect(e.resourceId).toBe("gmail_search");
    expect(e.actorId).toBe("sub-12345");
    expect(e.details.actor_type).toBe("user");
    expect(e.details.input_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(e.details.output_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(e.details.tool_use_id).toBe("toolu_abc");
    expect(e.details.conversation_id).toBe("conv-xyz");
    expect(e.details.request_id).toBe("req-789");
    expect(e.details.ok).toBe(true);
    expect(e.details.latency_ms).toBe(145);
    expect(e.details.output_sanitized).toBe(true);
    expect(e.details.error_code).toBeNull();
  });

  it("uses SYSTEM_ACTOR_ID and actor_type='system' when actorId is null", () => {
    const e = buildToolAuditEntry({
      actorId: null,
      toolName: "scheduled_summary",
      rawInput: null,
      scrubbedOutputText: "",
      ok: true,
      latencyMs: 0,
      outputSanitized: false,
    });
    expect(e.actorId).toBe(SYSTEM_ACTOR_ID);
    expect(e.details.actor_type).toBe("system");
    expect(e.details.tool_use_id).toBeNull();
    expect(e.details.conversation_id).toBeNull();
    expect(e.details.request_id).toBeNull();
  });

  it("produces stable input_hash regardless of payload key order", () => {
    const a = buildToolAuditEntry({
      actorId: "u",
      toolName: "t",
      rawInput: { b: 2, a: 1 },
      scrubbedOutputText: "",
      ok: true,
      latencyMs: 0,
      outputSanitized: false,
    });
    const b = buildToolAuditEntry({
      actorId: "u",
      toolName: "t",
      rawInput: { a: 1, b: 2 },
      scrubbedOutputText: "",
      ok: true,
      latencyMs: 0,
      outputSanitized: false,
    });
    expect(a.details.input_hash).toBe(b.details.input_hash);
  });

  it("hashes the scrubbed output, not raw text", () => {
    // Two callers pass different raw outputs but the same scrubbed text —
    // the hash should be identical, since the audit log records what the
    // scrubber emitted.
    const e1 = buildToolAuditEntry({
      actorId: "u",
      toolName: "t",
      rawInput: {},
      scrubbedOutputText: "Email <EMAIL_1>",
      ok: true,
      latencyMs: 0,
      outputSanitized: true,
    });
    const e2 = buildToolAuditEntry({
      actorId: "u",
      toolName: "t",
      rawInput: {},
      scrubbedOutputText: "Email <EMAIL_1>",
      ok: true,
      latencyMs: 0,
      outputSanitized: true,
    });
    expect(e1.details.output_hash).toBe(e2.details.output_hash);
  });

  it("records error_code when ok=false", () => {
    const e = buildToolAuditEntry({
      actorId: "u",
      toolName: "t",
      rawInput: {},
      scrubbedOutputText: "tool internal error",
      ok: false,
      errorCode: "tool_internal_error",
      latencyMs: 12,
      outputSanitized: false,
    });
    expect(e.details.ok).toBe(false);
    expect(e.details.error_code).toBe("tool_internal_error");
  });

  it("supports a custom action override", () => {
    const e = buildToolAuditEntry({
      actorId: "u",
      toolName: "t",
      rawInput: {},
      scrubbedOutputText: "",
      ok: true,
      latencyMs: 0,
      outputSanitized: false,
      action: "ai.tool.dry_run",
    });
    expect(e.action).toBe("ai.tool.dry_run");
  });

  it("hashes null and undefined input identically (treated as JSON null)", () => {
    const a = buildToolAuditEntry({
      actorId: "u",
      toolName: "t",
      rawInput: null,
      scrubbedOutputText: "",
      ok: true,
      latencyMs: 0,
      outputSanitized: false,
    });
    const b = buildToolAuditEntry({
      actorId: "u",
      toolName: "t",
      rawInput: undefined,
      scrubbedOutputText: "",
      ok: true,
      latencyMs: 0,
      outputSanitized: false,
    });
    expect(a.details.input_hash).toBe(b.details.input_hash);
  });
});
