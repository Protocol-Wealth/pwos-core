// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { describe, expect, it } from "vitest";
import { buildFrontendErrorReport } from "../src/errorBoundaryShape.js";

describe("buildFrontendErrorReport", () => {
  const baseInput = {
    error: new Error("render failed"),
    url: "https://app/items/42",
    userAgent: "Mozilla/5.0",
    now: () => 1_700_000_000_000,
  };

  it("serializes core fields", () => {
    const r = buildFrontendErrorReport(baseInput);
    expect(r.action).toBe("frontend_render_error");
    expect(r.message).toBe("render failed");
    expect(r.errorName).toBe("Error");
    expect(r.url).toBe("https://app/items/42");
    expect(r.at).toBe(1_700_000_000_000);
  });

  it("truncates long stacks", () => {
    const big = new Error("x");
    big.stack = "x".repeat(20_000);
    const r = buildFrontendErrorReport({
      ...baseInput,
      error: big,
      stackLimit: 100,
    });
    expect(r.stack?.length).toBeLessThanOrEqual(100 + " …[truncated]".length);
    expect(r.stack?.endsWith("[truncated]")).toBe(true);
  });

  it("handles non-Error inputs without crashing", () => {
    const r = buildFrontendErrorReport({ ...baseInput, error: "string!" });
    expect(r.errorName).toBe("NonError");
    expect(r.message).toBe("string!");
  });

  it("propagates optional context fields", () => {
    const r = buildFrontendErrorReport({
      ...baseInput,
      sessionId: "s1",
      actorId: "a1",
      buildId: "v1.2.3",
    });
    expect(r.sessionId).toBe("s1");
    expect(r.actorId).toBe("a1");
    expect(r.buildId).toBe("v1.2.3");
  });
});
