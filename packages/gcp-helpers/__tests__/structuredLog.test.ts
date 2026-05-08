// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { describe, expect, it } from "vitest";
import {
  createCloudLogger,
  serializeError,
} from "../src/structuredLog.js";

function captureLines(): { lines: string[]; sink: (l: string) => void } {
  const lines: string[] = [];
  return { lines, sink: (l: string) => lines.push(l) };
}

describe("createCloudLogger", () => {
  it("emits a JSON line with severity and message", () => {
    const { lines, sink } = captureLines();
    const log = createCloudLogger({ sink });
    log.info("hello", { foo: 1 });
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]!);
    expect(parsed).toMatchObject({ severity: "INFO", message: "hello", foo: 1 });
  });

  it("merges defaultFields onto every entry", () => {
    const { lines, sink } = captureLines();
    const log = createCloudLogger({
      sink,
      defaultFields: { requestId: "r1", actorId: "a1" },
    });
    log.warn("hmm");
    const parsed = JSON.parse(lines[0]!);
    expect(parsed.requestId).toBe("r1");
    expect(parsed.actorId).toBe("a1");
    expect(parsed.severity).toBe("WARNING");
  });

  it("withFields returns a child logger that adds + overrides defaults", () => {
    const { lines, sink } = captureLines();
    const log = createCloudLogger({
      sink,
      defaultFields: { service: "api" },
    });
    const child = log.withFields({ service: "worker", traceId: "t1" });
    child.info("x");
    const parsed = JSON.parse(lines[0]!);
    expect(parsed.service).toBe("worker");
    expect(parsed.traceId).toBe("t1");
  });
});

describe("serializeError", () => {
  it("serializes a plain Error", () => {
    const e = new Error("boom");
    const out = serializeError(e);
    expect(out.name).toBe("Error");
    expect(out.message).toBe("boom");
    expect(typeof out.stack).toBe("string");
  });

  it("recurses into Error.cause", () => {
    const e = new Error("outer", { cause: new Error("inner") });
    const out = serializeError(e);
    expect(out.cause?.message).toBe("inner");
  });

  it("falls back for non-Error inputs", () => {
    expect(serializeError("string error")).toEqual({
      name: "NonError",
      message: "string error",
    });
  });
});
