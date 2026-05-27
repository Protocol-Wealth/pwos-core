// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Provenance hash-chain tests.
 *
 * The two load-bearing properties exercised here:
 *   1. CHAIN CONTINUITY  — a sealed chain `verifyChain`s as `valid: true`.
 *   2. TAMPER DETECTION  — every class of post-hoc edit (content, prevHash,
 *      hash, deletion, insertion, reorder) is caught by `verifyChain` and
 *      the failure points at the FIRST divergent record.
 *
 * Also verifies that `stableJsonString` produces deep-sort-stable output —
 * the canonical-serialization contract the audit-log peer depends on.
 */

import { describe, expect, it } from "vitest";

import {
  chainAll,
  chainRecord,
  hashProvenanceRecord,
  stableJsonString,
  verifyChain,
  type NewProvenanceRecord,
  type ProvenanceRecord,
} from "../src/provenance/index.js";

const synthRecord = (id: string, ts: string): NewProvenanceRecord => ({
  id,
  timestamp: ts,
  model: { provider: "anthropic", name: "claude-sonnet-4-6", version: "claude-sonnet-4-6" },
  promptHash: `sha256-of-prompt-for-${id}`,
  retrievedSourceIds: [`source_a_${id}`, `source_b_${id}`],
  redactionSummary: {
    layerCount: 4,
    redactedCount: 2,
    masksApplied: ["ssn", "account_number"],
  },
});

describe("stableJsonString — canonical serialization", () => {
  it("deep-sorts nested object keys", () => {
    expect(stableJsonString({ a: { y: 1, x: 2 } })).toBe(
      stableJsonString({ a: { x: 2, y: 1 } }),
    );
  });

  it("preserves array order (does NOT sort arrays)", () => {
    expect(stableJsonString([1, 2, 3])).not.toBe(stableJsonString([3, 2, 1]));
  });

  it("undefined and null both serialize to 'null'", () => {
    expect(stableJsonString(undefined)).toBe("null");
    expect(stableJsonString(null)).toBe("null");
  });

  it("sorts at every nesting level (5+ deep)", () => {
    const a = stableJsonString({ a: { b: { c: { d: { f: 6, e: 5 } } } } });
    const b = stableJsonString({ a: { b: { c: { d: { e: 5, f: 6 } } } } });
    expect(a).toBe(b);
  });
});

describe("chainAll / chainRecord — building a chain", () => {
  it("genesis record has prevHash === ''", async () => {
    const r = await chainRecord(synthRecord("r1", "2026-05-27T00:00:00Z"), "");
    expect(r.prevHash).toBe("");
    expect(r.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("two records form a 2-link chain whose prev/hash agree", async () => {
    const chain = await chainAll([
      synthRecord("r1", "2026-05-27T00:00:00Z"),
      synthRecord("r2", "2026-05-27T00:01:00Z"),
    ]);
    expect(chain).toHaveLength(2);
    expect(chain[0]!.prevHash).toBe("");
    expect(chain[1]!.prevHash).toBe(chain[0]!.hash);
    expect(chain[0]!.hash).not.toBe(chain[1]!.hash);
  });

  it("ten records form a valid chain", async () => {
    const inputs = Array.from({ length: 10 }, (_, i) =>
      synthRecord(`r${i + 1}`, `2026-05-27T00:0${i}:00Z`),
    );
    const chain = await chainAll(inputs);
    const result = await verifyChain(chain);
    expect(result.valid).toBe(true);
    expect(result.badIndex).toBeUndefined();
  });

  it("the same inputs always produce the same chain (deterministic)", async () => {
    const inputs: NewProvenanceRecord[] = [
      synthRecord("r1", "2026-05-27T00:00:00Z"),
      synthRecord("r2", "2026-05-27T00:01:00Z"),
    ];
    const a = await chainAll(inputs);
    const b = await chainAll(inputs);
    expect(a.map((r) => r.hash)).toEqual(b.map((r) => r.hash));
  });
});

describe("verifyChain — happy path", () => {
  it("intact chain returns { valid: true }", async () => {
    const chain = await chainAll([
      synthRecord("r1", "2026-05-27T00:00:00Z"),
      synthRecord("r2", "2026-05-27T00:01:00Z"),
      synthRecord("r3", "2026-05-27T00:02:00Z"),
    ]);
    const result = await verifyChain(chain);
    expect(result.valid).toBe(true);
  });

  it("empty array returns { valid: true }", async () => {
    expect(await verifyChain([])).toEqual({ valid: true });
  });
});

describe("verifyChain — TAMPER DETECTION", () => {
  const buildChain = async (): Promise<ProvenanceRecord[]> =>
    chainAll([
      synthRecord("r1", "2026-05-27T00:00:00Z"),
      synthRecord("r2", "2026-05-27T00:01:00Z"),
      synthRecord("r3", "2026-05-27T00:02:00Z"),
    ]);

  it("edited content field on r2 is caught at index 1", async () => {
    const chain = await buildChain();
    chain[1] = { ...chain[1]!, promptHash: "tampered-prompt-hash" };
    const result = await verifyChain(chain);
    expect(result.valid).toBe(false);
    expect(result.badIndex).toBe(1);
    expect(result.badId).toBe("r2");
    expect(result.reason).toMatch(/hash mismatch/);
  });

  it("edited retrievedSourceIds (deep field) on r3 is caught at index 2", async () => {
    const chain = await buildChain();
    chain[2] = {
      ...chain[2]!,
      retrievedSourceIds: ["source_INJECTED", ...chain[2]!.retrievedSourceIds],
    };
    const result = await verifyChain(chain);
    expect(result.valid).toBe(false);
    expect(result.badIndex).toBe(2);
    expect(result.badId).toBe("r3");
  });

  it("edited redactionSummary on r1 is caught at index 0", async () => {
    const chain = await buildChain();
    chain[0] = {
      ...chain[0]!,
      redactionSummary: { ...chain[0]!.redactionSummary, redactedCount: 0 },
    };
    const result = await verifyChain(chain);
    expect(result.valid).toBe(false);
    expect(result.badIndex).toBe(0);
    expect(result.badId).toBe("r1");
  });

  it("flipped prevHash field on r2 is caught at index 1", async () => {
    const chain = await buildChain();
    chain[1] = { ...chain[1]!, prevHash: "0".repeat(64) };
    const result = await verifyChain(chain);
    expect(result.valid).toBe(false);
    expect(result.badIndex).toBe(1);
    expect(result.reason).toMatch(/prevHash mismatch/);
  });

  it("edited hash field on r2 is caught at index 1 (even though content is intact)", async () => {
    const chain = await buildChain();
    chain[1] = { ...chain[1]!, hash: "f".repeat(64) };
    const result = await verifyChain(chain);
    expect(result.valid).toBe(false);
    expect(result.badIndex).toBe(1);
  });

  it("deleted middle record is caught at the new index 1 via prevHash mismatch", async () => {
    const chain = await buildChain();
    const truncated = [chain[0]!, chain[2]!];
    const result = await verifyChain(truncated);
    expect(result.valid).toBe(false);
    expect(result.badIndex).toBe(1);
    expect(result.reason).toMatch(/prevHash mismatch/);
  });

  it("inserted record is caught via prevHash mismatch", async () => {
    const chain = await buildChain();
    const inserted = await chainRecord(
      synthRecord("r_injected", "2026-05-27T00:00:30Z"),
      "deadbeef".repeat(8),
    );
    const tampered = [chain[0]!, inserted, chain[1]!, chain[2]!];
    const result = await verifyChain(tampered);
    expect(result.valid).toBe(false);
    expect(result.badIndex).toBe(1);
  });

  it("reordered chain is caught (r3 before r2) via prevHash mismatch", async () => {
    const chain = await buildChain();
    const reordered = [chain[0]!, chain[2]!, chain[1]!];
    const result = await verifyChain(reordered);
    expect(result.valid).toBe(false);
    expect(result.badIndex).toBe(1);
  });
});

describe("hashProvenanceRecord — pure hash", () => {
  it("same inputs produce the same hash", async () => {
    const r = synthRecord("r1", "2026-05-27T00:00:00Z");
    const a = await hashProvenanceRecord(r, "");
    const b = await hashProvenanceRecord(r, "");
    expect(a).toBe(b);
  });

  it("a different prevHash produces a different output", async () => {
    const r = synthRecord("r1", "2026-05-27T00:00:00Z");
    const a = await hashProvenanceRecord(r, "");
    const b = await hashProvenanceRecord(r, "deadbeef".repeat(8));
    expect(a).not.toBe(b);
  });

  it("output is 64-char lowercase hex (SHA-256)", async () => {
    const r = synthRecord("r1", "2026-05-27T00:00:00Z");
    const hash = await hashProvenanceRecord(r, "");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
