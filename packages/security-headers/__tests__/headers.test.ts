// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { describe, expect, it } from "vitest";
import {
  buildHsts,
  buildPermissionsPolicy,
  buildSecurityHeaders,
} from "../src/headers.js";
import { strictBaseline } from "../src/cspBuilder.js";

describe("buildHsts", () => {
  it("emits the preload-eligible default", () => {
    expect(buildHsts()).toBe(
      "max-age=63072000; includeSubDomains; preload"
    );
  });

  it("respects overrides", () => {
    expect(
      buildHsts({ maxAgeSeconds: 3600, includeSubDomains: false, preload: false })
    ).toBe("max-age=3600");
  });
});

describe("buildPermissionsPolicy", () => {
  it("serializes mixed directive shapes", () => {
    const out = buildPermissionsPolicy({
      camera: "()",
      geolocation: "*",
      microphone: ["self"],
    });
    expect(out).toBe('camera=(), geolocation=*, microphone=("self")');
  });
});

describe("buildSecurityHeaders", () => {
  const csp = strictBaseline();

  it("omits HSTS in development mode", () => {
    const h = buildSecurityHeaders({ mode: "development", csp });
    expect(h["Strict-Transport-Security"]).toBeUndefined();
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
  });

  it("includes HSTS in production mode by default", () => {
    const h = buildSecurityHeaders({ mode: "production", csp });
    expect(h["Strict-Transport-Security"]).toContain("preload");
  });

  it("can suppress HSTS even in production", () => {
    const h = buildSecurityHeaders({ mode: "production", csp, hsts: false });
    expect(h["Strict-Transport-Security"]).toBeUndefined();
  });

  it("locks down sensitive Permissions-Policy directives by default", () => {
    const h = buildSecurityHeaders({ mode: "production", csp });
    expect(h["Permissions-Policy"]).toContain("camera=()");
    expect(h["Permissions-Policy"]).toContain("microphone=()");
    expect(h["Permissions-Policy"]).toContain("geolocation=()");
  });
});
