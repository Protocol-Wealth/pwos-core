// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * Tests for stableJsonString and the hashEntry/verifyChain integration.
 * Parity vs. mcp-tools' peer impl is enforced separately in
 * stable-json-parity.test.ts.
 */
import { describe, expect, it } from "vitest";

import {
  AuditLogger,
  InMemoryAuditStore,
  hashEntry,
  stableJsonString,
  verifyChain,
  type AuditEntry,
} from "../src/index.js";

describe("stableJsonString — key sort", () => {
  it("sorts top-level keys", () => {
    expect(stableJsonString({ b: 1, a: 2 })).toBe(stableJsonString({ a: 2, b: 1 }));
  });

  it("sorts nested keys (the v0.4.0 fix)", () => {
    expect(stableJsonString({ a: { y: 1, x: 2 } })).toBe(
      stableJsonString({ a: { x: 2, y: 1 } }),
    );
  });

  it("sorts at every nesting level (5+ deep)", () => {
    const a = stableJsonString({ a: { b: { c: { d: { f: 6, e: 5 } } } } });
    const b = stableJsonString({ a: { b: { c: { d: { e: 5, f: 6 } } } } });
    expect(a).toBe(b);
  });

  it("sorts inside arrays of objects (per-element)", () => {
    expect(stableJsonString([{ b: 2, a: 1 }, { d: 4, c: 3 }])).toBe(
      stableJsonString([{ a: 1, b: 2 }, { c: 3, d: 4 }]),
    );
  });
});

describe("stableJsonString — array order", () => {
  it("preserves array order — different orders, different output", () => {
    expect(stableJsonString([1, 2, 3])).not.toBe(stableJsonString([3, 2, 1]));
  });

  it("array of objects: order of elements preserved", () => {
    expect(stableJsonString([{ a: 1 }, { b: 2 }])).not.toBe(
      stableJsonString([{ b: 2 }, { a: 1 }]),
    );
  });
});

describe("stableJsonString — primitive handling", () => {
  it("null and undefined both serialize to 'null'", () => {
    expect(stableJsonString(null)).toBe("null");
    expect(stableJsonString(undefined)).toBe("null");
  });

  it("string", () => {
    expect(stableJsonString("hello")).toBe('"hello"');
  });

  it("number", () => {
    expect(stableJsonString(42)).toBe("42");
    expect(stableJsonString(3.14)).toBe("3.14");
  });

  it("boolean", () => {
    expect(stableJsonString(true)).toBe("true");
    expect(stableJsonString(false)).toBe("false");
  });

  it("string escaping handled by JSON.stringify", () => {
    expect(stableJsonString('a"b')).toBe('"a\\"b"');
  });
});

describe("stableJsonString — edge cases", () => {
  it("empty object", () => {
    expect(stableJsonString({})).toBe("{}");
  });

  it("empty array", () => {
    expect(stableJsonString([])).toBe("[]");
  });

  it("unicode keys are sorted by their JSON-escaped form", () => {
    // Sort is on Object.keys order — which yields the unicode characters.
    const a = stableJsonString({ "中": 1, "日": 2 });
    const b = stableJsonString({ "日": 2, "中": 1 });
    expect(a).toBe(b);
  });

  it("round-trips through JSON.parse for object inputs", () => {
    const input = { z: { y: [1, 2, { x: "hello" }] }, a: 1 };
    const out = stableJsonString(input);
    const parsed = JSON.parse(out);
    // Parsed object has same data; only key ordering may differ.
    expect(parsed).toEqual(input);
  });
});

describe("hashEntry / verifyChain — uses stableJsonString", () => {
  const baseEntry: AuditEntry = {
    id: "evt_1",
    timestamp: "2026-05-12T18:33:06.000Z",
    actorId: "user_a",
    action: "test.action",
    details: { toolName: "x", nested: { y: 1, x: 2 } },
    hash: undefined,
    previousHash: undefined,
  } as AuditEntry;

  it("produces identical hash for nested-key-reordered payloads (the v0.4.0 fix)", async () => {
    const a: AuditEntry = {
      ...baseEntry,
      details: { toolName: "x", nested: { y: 1, x: 2 } },
    } as AuditEntry;
    const b: AuditEntry = {
      ...baseEntry,
      details: { nested: { x: 2, y: 1 }, toolName: "x" },
    } as AuditEntry;
    const ha = await hashEntry(a, "");
    const hb = await hashEntry(b, "");
    expect(ha).toBe(hb);
  });

  it("verifyChain accepts a chain built with the new canonicalizer", async () => {
    const e1: AuditEntry = {
      ...baseEntry,
      id: "evt_1",
      hash: undefined,
      previousHash: "",
    } as AuditEntry;
    const e2: AuditEntry = {
      ...baseEntry,
      id: "evt_2",
      timestamp: "2026-05-12T18:33:07.000Z",
      hash: undefined,
      previousHash: undefined,
    } as AuditEntry;

    e1.hash = await hashEntry(e1, "");
    e2.previousHash = e1.hash;
    e2.hash = await hashEntry(e2, e2.previousHash ?? "");

    const result = await verifyChain([e1, e2]);
    expect(result).toBeNull();
  });
});

describe("verifyChain — tamper detection (linkage)", () => {
  // Build a valid, oldest-first chain using the real logger so the hashes
  // and previousHash links follow the exact write-side convention
  // (genesis previousHash === "").
  async function buildChain(actions: string[]): Promise<AuditEntry[]> {
    const store = new InMemoryAuditStore();
    const logger = new AuditLogger({
      store,
      idProvider: (() => {
        let i = 0;
        return () => `evt_${++i}`;
      })(),
      clock: (() => {
        let t = Date.parse("2026-01-01T00:00:00Z");
        return () => new Date((t += 1000));
      })(),
    });
    for (const action of actions) {
      await logger.log({ actorId: "u1", action });
    }
    // query() is newest-first; reverse → oldest-first, as verifyChain expects.
    return (await store.query({ limit: 100 })).reverse();
  }

  it("(a) intact chain returns null", async () => {
    const chain = await buildChain(["a", "b", "c", "d"]);
    expect(await verifyChain(chain)).toBeNull();
  });

  it("(b) deleting a middle entry is detected", async () => {
    const chain = await buildChain(["a", "b", "c", "d"]);
    // Drop the 3rd entry; the 4th entry's stored link now dangles.
    const tampered = [chain[0], chain[1], chain[3]];
    expect(await verifyChain(tampered)).toBe(chain[3].id);
  });

  it("(c) editing a middle row + recomputing only its own hash is detected", async () => {
    const chain = await buildChain(["a", "b", "c", "d"]);
    const victim = chain[1];
    victim.actorId = "attacker";
    // Attacker recomputes ONLY the victim row's own hash so it is internally
    // self-consistent — the exact case the old verifyChain missed.
    victim.hash = await hashEntry(victim, victim.previousHash ?? "");
    // The victim row itself now passes, but its successor's stored link still
    // points at the pre-edit hash → the break surfaces at the successor.
    expect(await verifyChain(chain)).toBe(chain[2].id);
  });

  it("(d) front-truncating the genesis entry is detected", async () => {
    const chain = await buildChain(["a", "b", "c", "d"]);
    // Drop the genesis; the new first entry's previousHash is non-empty and
    // no longer matches the "" genesis anchor.
    const truncated = chain.slice(1);
    expect(await verifyChain(truncated)).toBe(truncated[0].id);
  });

  it("still flags an edited row whose own hash was NOT recomputed", async () => {
    const chain = await buildChain(["a", "b", "c"]);
    chain[1].actorId = "attacker"; // stale hash — self-hash check catches it
    expect(await verifyChain(chain)).toBe(chain[1].id);
  });
});
