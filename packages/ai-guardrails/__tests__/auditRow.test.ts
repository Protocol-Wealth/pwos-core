// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { describe, expect, it } from "vitest";
import {
  buildAuditRow,
  canonicalJson,
  extractToolCallHashes,
  hashPayload,
} from "../src/auditRow.js";

describe("canonicalJson", () => {
  it("sorts keys deterministically", () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(canonicalJson({ a: 2, b: 1 })).toBe('{"a":2,"b":1}');
  });

  it("recurses into nested objects and arrays", () => {
    expect(canonicalJson({ x: [{ b: 1, a: 2 }] })).toBe('{"x":[{"a":2,"b":1}]}');
  });

  it("handles primitives", () => {
    expect(canonicalJson(null)).toBe("null");
    expect(canonicalJson(42)).toBe("42");
    expect(canonicalJson("hi")).toBe('"hi"');
  });
});

describe("hashPayload", () => {
  it("produces the same hash for differently-ordered keys", () => {
    expect(hashPayload({ a: 1, b: 2 })).toBe(hashPayload({ b: 2, a: 1 }));
  });

  it("produces different hashes for different content", () => {
    expect(hashPayload({ a: 1 })).not.toBe(hashPayload({ a: 2 }));
  });

  it("returns a 64-char lowercase hex string", () => {
    expect(hashPayload({ a: 1 })).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("extractToolCallHashes", () => {
  it("returns an empty array when content is missing", () => {
    expect(extractToolCallHashes(undefined)).toEqual([]);
    expect(extractToolCallHashes(null)).toEqual([]);
    expect(extractToolCallHashes("text")).toEqual([]);
  });

  it("hashes tool_use blocks in order, ignores text blocks", () => {
    const content = [
      { type: "text", text: "thinking…" },
      { type: "tool_use", name: "search", input: { q: "x" } },
      { type: "tool_use", name: "fetch", input: { url: "https://example" } },
    ];
    const out = extractToolCallHashes(content);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatch(/^[0-9a-f]{64}$/);
    expect(out[0]).not.toBe(out[1]);
  });
});

describe("buildAuditRow", () => {
  const baseInput = {
    requestId: "req_1",
    actorId: "advisor_42",
    model: "claude-opus-4-7",
    modelAlias: "FRONTIER" as const,
    latencyMs: 850,
    now: () => 1_700_000_000_000,
  };

  it("builds a row with hashes and zero error fields on success", () => {
    const row = buildAuditRow({
      ...baseInput,
      request: { messages: [{ role: "user", content: "x" }] },
      response: {
        id: "msg_1",
        model: "claude-opus-4-7",
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          cache_read_input_tokens: 5,
          cache_creation_input_tokens: 0,
        },
        content: [{ type: "text", text: "hello" }],
      },
      traceId: "trace_abc",
    });
    expect(row.promptHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.responseHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.inputTokens).toBe(10);
    expect(row.outputTokens).toBe(20);
    expect(row.cacheReadInputTokens).toBe(5);
    expect(row.toolCallHashes).toEqual([]);
    expect(row.errorClass).toBeNull();
    expect(row.traceId).toBe("trace_abc");
    expect(row.at).toBe(1_700_000_000_000);
  });

  it("zeros usage and nulls responseHash on error", () => {
    const row = buildAuditRow({
      ...baseInput,
      request: { messages: [] },
      response: null,
      errorClass: "rate_limit",
    });
    expect(row.responseHash).toBeNull();
    expect(row.inputTokens).toBe(0);
    expect(row.outputTokens).toBe(0);
    expect(row.errorClass).toBe("rate_limit");
  });
});
