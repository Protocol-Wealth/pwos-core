// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { describe, expect, it } from "vitest";
import {
  UnauthorizedError,
  UnknownRoleError,
  createRoleGuard,
} from "../src/roleGuard.js";

describe("createRoleGuard (default hierarchy)", () => {
  const guard = createRoleGuard();

  it("allows higher-rank actors", () => {
    expect(guard.isAuthorizedFor("PARTNER", "ADVISOR")).toBe(true);
    expect(guard.isAuthorizedFor("ADVISOR", "ADVISOR")).toBe(true);
  });

  it("denies lower-rank actors", () => {
    expect(guard.isAuthorizedFor("CLIENT", "ADVISOR")).toBe(false);
    expect(guard.isAuthorizedFor("EMPLOYEE", "ADVISOR")).toBe(false);
  });

  it("assertAuthorizedFor throws on denial", () => {
    expect(() => guard.assertAuthorizedFor("CLIENT", "OWNER")).toThrow(
      UnauthorizedError
    );
  });

  it("rankOf throws on unknown role", () => {
    expect(() => guard.rankOf("BOGUS")).toThrow(UnknownRoleError);
  });
});

describe("createRoleGuard (custom hierarchy)", () => {
  it("uses the provided rank table", () => {
    const guard = createRoleGuard({ READER: 1, WRITER: 2, ADMIN: 3 });
    expect(guard.isAuthorizedFor("WRITER", "READER")).toBe(true);
    expect(guard.isAuthorizedFor("READER", "WRITER")).toBe(false);
    expect(guard.isAuthorizedFor("ADMIN", "ADMIN")).toBe(true);
  });
});
