// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { describe, expect, it } from "vitest";
import {
  InMemorySecretLoader,
  createCachingSecretLoader,
} from "../src/secretManager.js";

describe("InMemorySecretLoader", () => {
  it("loads stored values", async () => {
    const m = new InMemorySecretLoader({ k: "v" });
    expect(await m.load("k")).toBe("v");
  });

  it("throws on missing", async () => {
    const m = new InMemorySecretLoader();
    await expect(m.load("missing")).rejects.toThrow(/secret not found/);
  });
});

describe("createCachingSecretLoader", () => {
  it("caches within TTL and re-reads after expiry", async () => {
    let now = 1_000;
    let calls = 0;
    const inner = {
      load: async (_: string) => {
        calls += 1;
        return "v" + calls;
      },
    };
    const cache = createCachingSecretLoader({
      inner,
      ttlMs: 100,
      now: () => now,
    });
    expect(await cache.load("k")).toBe("v1");
    expect(await cache.load("k")).toBe("v1");
    expect(calls).toBe(1);
    now += 200;
    expect(await cache.load("k")).toBe("v2");
    expect(calls).toBe(2);
  });

  it("invalidate clears just one key", async () => {
    const inner = new InMemorySecretLoader({ a: "1", b: "2" });
    const cache = createCachingSecretLoader({ inner });
    await cache.load("a");
    await cache.load("b");
    expect(cache.size()).toBe(2);
    cache.invalidate("a");
    expect(cache.size()).toBe(1);
  });
});
