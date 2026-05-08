// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { describe, expect, it } from "vitest";
import {
  InMemoryIdempotencyStore,
  hashBodyForIdempotency,
} from "../src/idempotency.js";

describe("hashBodyForIdempotency", () => {
  it("returns a stable 64-char hex digest", () => {
    expect(hashBodyForIdempotency("hello")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashBodyForIdempotency("hello")).toBe(hashBodyForIdempotency("hello"));
  });

  it("differs for different content", () => {
    expect(hashBodyForIdempotency("a")).not.toBe(hashBodyForIdempotency("b"));
  });
});

describe("InMemoryIdempotencyStore", () => {
  it("first reserve returns fresh", async () => {
    const store = new InMemoryIdempotencyStore();
    const r = await store.reserve("k1", 1000);
    expect(r.status).toBe("fresh");
  });

  it("subsequent reserves return duplicate with firstSeenAt", async () => {
    const store = new InMemoryIdempotencyStore();
    await store.reserve("k1", 1000);
    const r = await store.reserve("k1", 2000);
    expect(r).toEqual({ status: "duplicate", firstSeenAt: 1000 });
  });

  it("clear empties the store", async () => {
    const store = new InMemoryIdempotencyStore();
    await store.reserve("k1", 1000);
    expect(store.size()).toBe(1);
    store.clear();
    expect(store.size()).toBe(0);
  });
});
