// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
import { describe, expect, it } from "vitest";

import { AuditLogger, InMemoryAuditStore, hashEntry, verifyChain } from "../src/index.js";

function freshLogger() {
  const store = new InMemoryAuditStore();
  const logger = new AuditLogger({
    store,
    // Deterministic IDs + clock for reproducible tests.
    idProvider: (() => {
      let i = 0;
      return () => `id_${++i}`;
    })(),
    clock: (() => {
      let t = Date.parse("2026-01-01T00:00:00Z");
      return () => new Date((t += 1000));
    })(),
  });
  return { logger, store };
}

describe("AuditLogger", () => {
  it("appends entries with monotonic timestamps", async () => {
    const { logger } = freshLogger();
    const a = await logger.log({ actorId: "u1", action: "client.create" });
    const b = await logger.log({ actorId: "u1", action: "client.update" });
    expect(a.timestamp < b.timestamp).toBe(true);
  });

  it("chains hash across entries", async () => {
    const { logger } = freshLogger();
    const a = await logger.log({ actorId: "u1", action: "a" });
    const b = await logger.log({ actorId: "u1", action: "b" });
    expect(a.previousHash).toBe("");
    expect(b.previousHash).toBe(a.hash);
  });

  it("verifyChain returns null for intact chain", async () => {
    const { logger } = freshLogger();
    await logger.log({ actorId: "u1", action: "a" });
    await logger.log({ actorId: "u1", action: "b" });
    await logger.log({ actorId: "u1", action: "c" });
    const entries = (await logger.query({ limit: 100 })).reverse();
    expect(await verifyChain(entries)).toBeNull();
  });

  it("verifyChain flags tampered entry", async () => {
    const { logger, store } = freshLogger();
    await logger.log({ actorId: "u1", action: "a" });
    await logger.log({ actorId: "u1", action: "b" });

    // Directly mutate — simulating tampering.
    const entries = (await store.query({ limit: 100 })).reverse();
    entries[0].actorId = "u2";

    const badId = await verifyChain(entries);
    expect(badId).not.toBeNull();
  });

  it("hashEntry is deterministic for the same input", async () => {
    const entry = {
      id: "id_1",
      timestamp: "2026-01-01T00:00:00Z",
      actorId: "u1",
      action: "client.create",
    };
    const h1 = await hashEntry(entry, "");
    const h2 = await hashEntry(entry, "");
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("query filters by actor and action", async () => {
    const { logger } = freshLogger();
    await logger.log({ actorId: "u1", action: "a" });
    await logger.log({ actorId: "u2", action: "a" });
    await logger.log({ actorId: "u1", action: "b" });

    const u1a = await logger.query({ actorId: "u1", action: "a" });
    expect(u1a).toHaveLength(1);
    const u1All = await logger.query({ actorId: "u1" });
    expect(u1All).toHaveLength(2);
  });

  it("count respects filters", async () => {
    const { logger } = freshLogger();
    await logger.log({ actorId: "u1", action: "a" });
    await logger.log({ actorId: "u1", action: "a" });
    await logger.log({ actorId: "u2", action: "a" });

    expect(await logger.count()).toBe(3);
    expect(await logger.count({ actorId: "u1" })).toBe(2);
  });
});
