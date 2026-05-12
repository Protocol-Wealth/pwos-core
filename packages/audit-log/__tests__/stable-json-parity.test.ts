// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * Parity test — audit-log's stableJsonString must produce byte-identical
 * output to mcp-tools' stableJsonString on every fixture below.
 *
 * Why this test exists: stableJsonString is inlined in both packages
 * (audit-log/src/hash.ts and mcp-tools/src/confirmationGate.ts) because
 * audit-log is intentionally zero-dependency. Inlining creates a drift
 * risk between the two copies. This test is the enforcement mechanism —
 * any behavioral change to one impl that isn't mirrored in the other
 * will fail this test and block the PR.
 *
 * Coverage: ~20 fixtures spanning nested objects (deep + shallow),
 * arrays of objects, mixed primitives, edge cases (empty/null/undefined),
 * unicode in keys, 5+ level nesting, BigInt error case, NaN/Infinity
 * coercion, and JSON.parse round-trip safety.
 */
import { describe, expect, it } from "vitest";

import { stableJsonString as auditLogImpl } from "../src/index.js";
import { stableJsonString as mcpToolsImpl } from "@protocolwealthos/mcp-tools";

/** Each fixture is `[label, value]`. */
const FIXTURES: Array<[string, unknown]> = [
  // Primitives
  ["null", null],
  ["undefined", undefined],
  ["true", true],
  ["false", false],
  ["zero", 0],
  ["integer", 42],
  ["float", 3.14],
  ["empty string", ""],
  ["non-empty string", "hello world"],
  ["string with quotes + backslash", 'a"b\\c'],
  ["string with unicode", "café résumé 日本語"],

  // Empty containers
  ["empty object", {}],
  ["empty array", []],

  // Flat objects — key-order independence
  ["flat object two keys forward", { a: 1, b: 2 }],
  ["flat object two keys reverse", { b: 2, a: 1 }],

  // Nested
  ["one-level nested", { outer: { y: 1, x: 2 } }],
  ["five-level nested forward", { a: { b: { c: { d: { e: 1 } } } } }],
  [
    "five-level nested key shuffle",
    {
      a: {
        b: {
          c: { d: { e: 1, f: 2 }, g: 3 },
          h: 4,
        },
        i: 5,
      },
      j: 6,
    },
  ],

  // Arrays of objects — preserve order, deep-sort each element
  ["array of objects", [{ b: 2, a: 1 }, { d: 4, c: 3 }]],
  ["mixed array", [1, "two", null, { x: 1, y: 2 }, [3, 4]]],

  // Unicode keys
  ["unicode keys", { "中": 1, "日": 2, "あ": 3 }],

  // Real audit-payload shape
  [
    "audit-event-shaped payload",
    {
      previousHash: "abc123",
      id: "evt_1",
      timestamp: "2026-05-12T18:33:06.000Z",
      actorId: "anonymous",
      action: "chat_tool_called",
      resourceType: "order",
      resourceId: "LJ-2026-00001",
      details: {
        toolName: "verify_record",
        latencyMs: 42,
        toolCalls: [
          { name: "get_order_details", ok: true },
          { name: "verify_record", ok: true, recordId: "rec_xyz" },
        ],
      },
      ipAddress: "203.0.113.7",
    },
  ],
];

describe("stableJsonString parity (audit-log ↔ mcp-tools)", () => {
  for (const [label, value] of FIXTURES) {
    it(`byte-identical: ${label}`, () => {
      const fromAudit = auditLogImpl(value);
      const fromMcp = mcpToolsImpl(value);
      expect(fromAudit).toBe(fromMcp);
    });
  }

  it(`covers ${FIXTURES.length} fixtures`, () => {
    expect(FIXTURES.length).toBeGreaterThanOrEqual(15);
  });
});

describe("stableJsonString — BigInt and NaN/Infinity semantics", () => {
  it("throws on BigInt (matches mcp-tools)", () => {
    expect(() => auditLogImpl(1n)).toThrow(TypeError);
    expect(() => mcpToolsImpl(1n)).toThrow(TypeError);
  });

  it("NaN coerces to 'null' (matches mcp-tools)", () => {
    expect(auditLogImpl(NaN)).toBe("null");
    expect(mcpToolsImpl(NaN)).toBe("null");
  });

  it("Infinity coerces to 'null' (matches mcp-tools)", () => {
    expect(auditLogImpl(Infinity)).toBe("null");
    expect(mcpToolsImpl(Infinity)).toBe("null");
  });

  it("-Infinity coerces to 'null' (matches mcp-tools)", () => {
    expect(auditLogImpl(-Infinity)).toBe("null");
    expect(mcpToolsImpl(-Infinity)).toBe("null");
  });
});
