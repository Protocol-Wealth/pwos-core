// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { describe, expect, it } from "vitest";
import {
  WorkspaceMismatchError,
  assertWorkspace,
  assertWorkspaceFromEnv,
} from "../src/zdrAssertion.js";

describe("assertWorkspace", () => {
  it("returns ok on match", () => {
    const r = assertWorkspace({ expected: "ws_zdr", actual: "ws_zdr" });
    expect(r.ok).toBe(true);
    expect(r.posture).toBe("block");
  });

  it("throws WorkspaceMismatchError on mismatch with default posture", () => {
    expect(() =>
      assertWorkspace({ expected: "ws_zdr", actual: "ws_other" })
    ).toThrow(WorkspaceMismatchError);
  });

  it("throws when actual is undefined", () => {
    expect(() =>
      assertWorkspace({ expected: "ws_zdr", actual: undefined })
    ).toThrow(/expected "ws_zdr", got "<unset>"/);
  });

  it("returns ok:false in warn posture instead of throwing", () => {
    const r = assertWorkspace({
      expected: "ws_zdr",
      actual: "ws_other",
      posture: "warn",
    });
    expect(r.ok).toBe(false);
    expect(r.posture).toBe("warn");
    expect(r.message).toContain("ws_other");
  });
});

describe("assertWorkspaceFromEnv", () => {
  it("reads from process.env on success", () => {
    const key = "PWOS_TEST_WORKSPACE_ID_OK";
    process.env[key] = "ws_zdr";
    try {
      const r = assertWorkspaceFromEnv("ws_zdr", key);
      expect(r.ok).toBe(true);
    } finally {
      delete process.env[key];
    }
  });

  it("throws when env is unset", () => {
    const key = "PWOS_TEST_WORKSPACE_ID_UNSET";
    delete process.env[key];
    expect(() => assertWorkspaceFromEnv("ws_zdr", key)).toThrow(
      WorkspaceMismatchError
    );
  });
});
