// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { describe, expect, it } from "vitest";
import {
  applyDevOverrides,
  buildCspHeader,
  sha256Hex,
  strictBaseline,
  toHashSource,
} from "../src/cspBuilder.js";

describe("buildCspHeader", () => {
  it("serializes directives with semicolon separators", () => {
    const out = buildCspHeader({
      defaultSrc: ["'self'"],
      objectSrc: ["'none'"],
    });
    expect(out).toBe("default-src 'self'; object-src 'none'");
  });

  it("emits upgrade-insecure-requests as a bare directive", () => {
    expect(
      buildCspHeader({ defaultSrc: ["'self'"], upgradeInsecureRequests: true })
    ).toBe("default-src 'self'; upgrade-insecure-requests");
  });

  it("omits empty arrays", () => {
    expect(buildCspHeader({ defaultSrc: ["'self'"], scriptSrc: [] })).toBe(
      "default-src 'self'"
    );
  });
});

describe("strictBaseline", () => {
  it("sets self/none defaults and emits upgrade-insecure-requests by default", () => {
    const out = buildCspHeader(strictBaseline());
    expect(out).toContain("default-src 'self'");
    expect(out).toContain("object-src 'none'");
    expect(out).toContain("frame-ancestors 'none'");
    expect(out).toContain("upgrade-insecure-requests");
    expect(out).not.toContain("'unsafe-inline'");
  });

  it("incorporates script and style hashes", () => {
    const hash = sha256Hex("console.log('hi')");
    const out = buildCspHeader(strictBaseline({ scriptHashes: [hash] }));
    expect(out).toMatch(/script-src 'self' 'sha256-[A-Za-z0-9+/=]+'/);
  });

  it("supports report-uri", () => {
    const out = buildCspHeader(
      strictBaseline({ reportUri: "/csp-report" })
    );
    expect(out).toContain("report-uri /csp-report");
  });
});

describe("applyDevOverrides", () => {
  it("adds 'unsafe-inline' and the HMR ws origin and disables upgrade-insecure-requests", () => {
    const base = strictBaseline();
    const dev = applyDevOverrides(base, { wsOrigin: "ws://localhost:5173" });
    const out = buildCspHeader(dev);
    expect(out).toContain("'unsafe-inline'");
    expect(out).toContain("ws://localhost:5173");
    expect(out).not.toContain("upgrade-insecure-requests");
  });
});

describe("toHashSource", () => {
  it("converts a hex digest to a sha256 base64 source", () => {
    const hex = sha256Hex("x");
    const src = toHashSource(hex);
    expect(src).toMatch(/^'sha256-[A-Za-z0-9+/=]+'$/);
  });

  it("passes a base64 digest through unchanged", () => {
    const src = toHashSource("ABCD/+==");
    expect(src).toBe("'sha256-ABCD/+=='");
  });
});
