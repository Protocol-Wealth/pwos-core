// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { describe, expect, it } from "vitest";
import {
  WorkspaceDomainError,
  assertWorkspaceDomain,
  isInWorkspaceDomain,
} from "../src/workspaceDomainGuard.js";

describe("isInWorkspaceDomain", () => {
  const allowed = ["example.com", "advisor.example"];

  it("matches case-insensitively", () => {
    expect(isInWorkspaceDomain("ANYONE@EXAMPLE.COM", allowed)).toBe(true);
    expect(isInWorkspaceDomain("anyone@example.com", allowed)).toBe(true);
  });

  it("trims whitespace", () => {
    expect(isInWorkspaceDomain("  user@example.com  ", allowed)).toBe(true);
  });

  it("rejects emails outside the allowed domains", () => {
    expect(isInWorkspaceDomain("user@gmail.com", allowed)).toBe(false);
  });

  it("does NOT auto-allow subdomains", () => {
    expect(isInWorkspaceDomain("user@marketing.example.com", allowed)).toBe(false);
  });

  it("rejects malformed inputs", () => {
    expect(isInWorkspaceDomain("notanemail", allowed)).toBe(false);
    expect(isInWorkspaceDomain("user@", allowed)).toBe(false);
    expect(isInWorkspaceDomain("@example.com", ["example.com"])).toBe(true);
  });
});

describe("assertWorkspaceDomain", () => {
  it("throws WorkspaceDomainError when domain is not allowed", () => {
    expect(() =>
      assertWorkspaceDomain("user@gmail.com", ["example.com"])
    ).toThrow(WorkspaceDomainError);
  });
});
