// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { describe, expect, it } from "vitest";
import {
  detectNewActorOnAdmin,
  detectOffHours,
  detectRapidSequential,
} from "../src/anomaly.js";
import type { AuditEntry } from "../src/types.js";

function makeEntry(overrides: Partial<AuditEntry>): AuditEntry {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    timestamp: overrides.timestamp ?? "2026-05-08T14:00:00.000Z",
    actorId: overrides.actorId ?? "alice",
    action: overrides.action ?? "vendor.update",
    ...overrides,
  };
}

describe("detectOffHours", () => {
  it("flags actions outside business hours (NY tz)", () => {
    // 2026-05-08 04:00 UTC == 2026-05-08 00:00 EDT (off-hours).
    const e = makeEntry({
      id: "e1",
      timestamp: "2026-05-08T04:00:00.000Z",
      actorId: "alice",
      action: "vendor.delete",
    });
    const findings = detectOffHours([e]);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.rule).toBe("off_hours");
    expect(findings[0]!.actorId).toBe("alice");
  });

  it("does not flag actions during business hours", () => {
    // 2026-05-08 14:00 UTC == 10:00 EDT — in business hours.
    const e = makeEntry({
      id: "e1",
      timestamp: "2026-05-08T14:00:00.000Z",
      actorId: "alice",
      action: "vendor.update",
    });
    expect(detectOffHours([e])).toEqual([]);
  });

  it("flags weekend actions even in business hours", () => {
    // 2026-05-09 Saturday 14:00 UTC == 10:00 EDT.
    const e = makeEntry({
      id: "e1",
      timestamp: "2026-05-09T14:00:00.000Z",
      actorId: "alice",
      action: "vendor.update",
    });
    const findings = detectOffHours([e]);
    expect(findings).toHaveLength(1);
  });

  it("ignores non-admin actions", () => {
    const e = makeEntry({
      id: "e1",
      timestamp: "2026-05-08T04:00:00.000Z",
      actorId: "alice",
      action: "client.read",
    });
    expect(detectOffHours([e])).toEqual([]);
  });

  it("deduplicates per actor per local day", () => {
    const a = makeEntry({
      id: "a",
      timestamp: "2026-05-08T04:00:00.000Z",
      action: "vendor.delete",
      actorId: "alice",
    });
    const b = makeEntry({
      id: "b",
      timestamp: "2026-05-08T05:00:00.000Z",
      action: "vendor.delete",
      actorId: "alice",
    });
    const findings = detectOffHours([a, b]);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.sampleEntryIds).toEqual(["a", "b"]);
  });
});

describe("detectRapidSequential", () => {
  it("flags >= threshold actions in window", () => {
    const ts = (offsetMs: number) =>
      new Date(1_700_000_000_000 + offsetMs).toISOString();
    const entries: AuditEntry[] = [];
    for (let i = 0; i < 10; i++) {
      entries.push(
        makeEntry({
          id: `e${i}`,
          timestamp: ts(i * 1000),
          actorId: "bob",
          action: "vendor.update",
        })
      );
    }
    const findings = detectRapidSequential(entries, {
      windowMs: 60_000,
      threshold: 8,
    });
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]!.actorId).toBe("bob");
  });

  it("does not flag below threshold", () => {
    const ts = (offsetMs: number) =>
      new Date(1_700_000_000_000 + offsetMs).toISOString();
    const entries = [0, 5_000, 10_000, 15_000, 20_000].map((o, i) =>
      makeEntry({ id: `e${i}`, timestamp: ts(o), actorId: "bob", action: "vendor.update" })
    );
    expect(detectRapidSequential(entries, { threshold: 8 })).toEqual([]);
  });

  it("partitions by actor", () => {
    const ts = (offsetMs: number) =>
      new Date(1_700_000_000_000 + offsetMs).toISOString();
    const entries: AuditEntry[] = [];
    for (let i = 0; i < 10; i++) {
      entries.push(
        makeEntry({
          id: `b${i}`,
          timestamp: ts(i * 1000),
          actorId: "bob",
          action: "vendor.update",
        })
      );
    }
    for (let i = 0; i < 4; i++) {
      entries.push(
        makeEntry({
          id: `a${i}`,
          timestamp: ts(i * 1000),
          actorId: "alice",
          action: "vendor.update",
        })
      );
    }
    const findings = detectRapidSequential(entries, { threshold: 8 });
    expect(findings.every((f) => f.actorId === "bob")).toBe(true);
  });
});

describe("detectNewActorOnAdmin", () => {
  it("flags first appearance only", () => {
    const a = makeEntry({ id: "a", actorId: "carol", action: "vendor.delete" });
    const b = makeEntry({ id: "b", actorId: "carol", action: "vendor.update" });
    const findings = detectNewActorOnAdmin([a, b], {
      knownActors: new Set(),
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]!.actorId).toBe("carol");
  });

  it("ignores known actors", () => {
    const e = makeEntry({ id: "a", actorId: "carol", action: "vendor.delete" });
    expect(
      detectNewActorOnAdmin([e], { knownActors: new Set(["carol"]) })
    ).toEqual([]);
  });

  it("ignores non-admin actions for first-actor detection", () => {
    const e = makeEntry({ id: "a", actorId: "carol", action: "client.read" });
    expect(detectNewActorOnAdmin([e], { knownActors: new Set() })).toEqual([]);
  });
});
