// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { describe, expect, it } from "vitest";
import {
  ModelEnvUnsetError,
  ModelPrefixViolationError,
  UnknownModelAliasError,
  createModelResolver,
} from "../src/modelAllowlist.js";

describe("createModelResolver", () => {
  const baseConfig = {
    aliases: {
      FRONTIER: "CLAUDE_MODEL_FRONTIER",
      WORKHORSE: "CLAUDE_MODEL_WORKHORSE",
    },
    allowedPrefixes: ["claude-"],
  };

  it("resolves a known alias from injected env", () => {
    const r = createModelResolver({
      ...baseConfig,
      envSource: { CLAUDE_MODEL_FRONTIER: "claude-opus-4-7" },
    });
    expect(r.resolve("FRONTIER")).toBe("claude-opus-4-7");
  });

  it("throws UnknownModelAliasError for an unconfigured alias", () => {
    const r = createModelResolver({ ...baseConfig, envSource: {} });
    expect(() => r.resolve("BOGUS")).toThrow(UnknownModelAliasError);
  });

  it("throws ModelEnvUnsetError when env value is missing", () => {
    const r = createModelResolver({ ...baseConfig, envSource: {} });
    expect(() => r.resolve("FRONTIER")).toThrow(ModelEnvUnsetError);
  });

  it("throws ModelPrefixViolationError when value violates prefix allowlist", () => {
    const r = createModelResolver({
      ...baseConfig,
      envSource: { CLAUDE_MODEL_FRONTIER: "gpt-4o" },
    });
    expect(() => r.resolve("FRONTIER")).toThrow(ModelPrefixViolationError);
  });

  it("disables prefix checking when allowedPrefixes is empty", () => {
    const r = createModelResolver({
      aliases: { CUSTOM: "MODEL_CUSTOM" },
      allowedPrefixes: [],
      envSource: { MODEL_CUSTOM: "anything-goes" },
    });
    expect(r.resolve("CUSTOM")).toBe("anything-goes");
  });

  it("tryResolve returns null instead of throwing", () => {
    const r = createModelResolver({ ...baseConfig, envSource: {} });
    expect(r.tryResolve("FRONTIER")).toBeNull();
  });

  it("aliases() lists configured aliases", () => {
    const r = createModelResolver({ ...baseConfig, envSource: {} });
    expect(r.aliases().sort()).toEqual(["FRONTIER", "WORKHORSE"]);
  });
});
