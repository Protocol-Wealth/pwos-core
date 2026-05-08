// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { describe, expect, it } from "vitest";
import {
  CachedPiiError,
  assertNoPiiInCachedPrefix,
  cacheControlMarker,
  markCacheable,
} from "../src/promptCache.js";

describe("cacheControlMarker", () => {
  it("returns the ephemeral marker", () => {
    expect(cacheControlMarker()).toEqual({ type: "ephemeral" });
  });
});

describe("markCacheable", () => {
  it("returns an empty array for an empty input", () => {
    expect(markCacheable([])).toEqual([]);
  });

  it("sets cache_control on the last block only", () => {
    const blocks = [
      { type: "text", text: "system prefix part 1" },
      { type: "text", text: "system prefix part 2" },
    ];
    const out = markCacheable(blocks);
    expect(out[0]!.cache_control).toBeUndefined();
    expect(out[1]!.cache_control).toEqual({ type: "ephemeral" });
  });

  it("does not mutate the input", () => {
    const blocks = [{ type: "text", text: "a" }];
    const out = markCacheable(blocks);
    expect(out).not.toBe(blocks);
    expect(blocks[0]!.cache_control).toBeUndefined();
  });
});

describe("assertNoPiiInCachedPrefix", () => {
  const isClean = (b: { text?: string }) =>
    typeof b.text === "string" && /\d{3}-\d{2}-\d{4}/.test(b.text)
      ? ({ ok: false, reason: "ssn-shaped string" } as const)
      : ({ ok: true } as const);

  it("passes when every block is clean", () => {
    const blocks = [{ text: "system policy" }, { text: "tool guidance" }];
    expect(() => assertNoPiiInCachedPrefix(blocks, isClean)).not.toThrow();
  });

  it("throws CachedPiiError on the first dirty block", () => {
    const blocks = [
      { text: "fine" },
      { text: "patient SSN 123-45-6789 leaked into prefix" },
    ];
    let caught: unknown;
    try {
      assertNoPiiInCachedPrefix(blocks, isClean);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(CachedPiiError);
    expect((caught as CachedPiiError).index).toBe(1);
  });
});
