// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { describe, expect, it } from "vitest";
import {
  CachePiiError,
  CacheKeyShapeError,
  createCacheKeyBuilder,
  hashedIdentifier,
} from "../src/keyBuilder.js";

describe("createCacheKeyBuilder.build", () => {
  const b = createCacheKeyBuilder();

  it("constructs a vendor:resource:identifier key", () => {
    expect(b.build("app", "quote", "msft")).toBe("app:quote:msft");
  });

  it("refuses an email-shaped identifier", () => {
    expect(() => b.build("app", "user", "advisor@example.com")).toThrow(CachePiiError);
  });

  it("refuses an SSN-shaped identifier", () => {
    expect(() => b.build("app", "user", "123-45-6789")).toThrow(CachePiiError);
  });

  it("refuses a UUID-shaped identifier", () => {
    expect(() =>
      b.build("app", "user", "550e8400-e29b-41d4-a716-446655440000")
    ).toThrow(CachePiiError);
  });

  it("refuses badly-shaped vendor or resource segments", () => {
    expect(() => b.build("APP", "quote", "x")).toThrow(CacheKeyShapeError);
    expect(() => b.build("app", "with space", "x")).toThrow(CacheKeyShapeError);
  });

  it("refuses an empty identifier", () => {
    expect(() => b.build("app", "quote", "")).toThrow(CacheKeyShapeError);
  });

  it("refuses identifiers over the configured max length", () => {
    const long = "x".repeat(300);
    expect(() => b.build("app", "blob", long)).toThrow(/max length 200/);
  });
});

describe("tryBuild + hashed", () => {
  it("tryBuild returns null on rejection", () => {
    const b = createCacheKeyBuilder();
    expect(b.tryBuild("app", "user", "a@b.com")).toBeNull();
    expect(b.tryBuild("app", "user", "ok")).toBe("app:user:ok");
  });

  it("hashed bypasses PII checks by hashing the value", () => {
    const b = createCacheKeyBuilder();
    const k = b.hashed("app", "user", "advisor@example.com");
    expect(k).toMatch(/^app:user:[0-9a-f]{32}$/);
  });
});

describe("hashedIdentifier", () => {
  it("returns a stable 32-char hex prefix", () => {
    expect(hashedIdentifier("x")).toMatch(/^[0-9a-f]{32}$/);
    expect(hashedIdentifier("x")).toBe(hashedIdentifier("x"));
  });
});
