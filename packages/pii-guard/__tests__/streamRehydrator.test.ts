// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
//
// Unit tests for the streaming rehydrator — the PII rehydrator that
// swaps `<TYPE_N>` placeholders in streamed text back to the original
// values. Focus is the tricky part: placeholders that split across
// chunk boundaries.
import { describe, expect, it } from "vitest";

import {
  createStreamRehydrator,
  type RedactionManifest,
} from "../src/index.js";

function manifest(
  entries: Array<[string, string, string]>,
): RedactionManifest {
  return {
    version: "1.0",
    redactionId: "test",
    placeholders: entries.map(([placeholder, entityType, original]) => ({
      placeholder,
      entityType,
      original,
      start: 0,
      end: 0,
      score: 1,
    })),
    stats: {
      entitiesFound: entries.length,
      entitiesByType: {},
      textLengthOriginal: 0,
      textLengthSanitized: 0,
    },
  };
}

function collect(): {
  received: string[];
  downstream: (t: string) => void;
} {
  const received: string[] = [];
  return {
    received,
    downstream: (t: string) => {
      received.push(t);
    },
  };
}

describe("createStreamRehydrator", () => {
  it("null manifest is a passthrough", () => {
    const { received, downstream } = collect();
    const r = createStreamRehydrator(null, downstream);
    r.push("hello world");
    r.flush();
    expect(received.join("")).toBe("hello world");
  });

  it("empty manifest is a passthrough", () => {
    const { received, downstream } = collect();
    const r = createStreamRehydrator(manifest([]), downstream);
    r.push("abc");
    r.push("def");
    r.flush();
    expect(received.join("")).toBe("abcdef");
  });

  it("rehydrates a complete placeholder within one chunk", () => {
    const { received, downstream } = collect();
    const r = createStreamRehydrator(
      manifest([["<NAME_1>", "name", "Ada Lovelace"]]),
      downstream,
    );
    r.push("Hello <NAME_1>, how are you?");
    r.flush();
    expect(received.join("")).toBe("Hello Ada Lovelace, how are you?");
  });

  it("buffers a placeholder split across two chunks", () => {
    const { received, downstream } = collect();
    const r = createStreamRehydrator(
      manifest([["<NAME_1>", "name", "Ada"]]),
      downstream,
    );
    r.push("Hello <NA");
    // The `<NA` tail must be buffered — it could grow into a placeholder.
    // Only "Hello " is safe to emit.
    expect(received).toEqual(["Hello "]);
    r.push("ME_1>, good day");
    r.flush();
    expect(received.join("")).toBe("Hello Ada, good day");
  });

  it("handles a placeholder split across three chunks", () => {
    const { received, downstream } = collect();
    const r = createStreamRehydrator(
      manifest([["<SSN_1>", "ssn", "123-45-6789"]]),
      downstream,
    );
    r.push("Your <SS");
    r.push("N_");
    r.push("1> is on file.");
    r.flush();
    expect(received.join("")).toBe("Your 123-45-6789 is on file.");
  });

  it("emits a `<` that turns out not to be a placeholder", () => {
    const { received, downstream } = collect();
    const r = createStreamRehydrator(
      manifest([["<NAME_1>", "name", "Ada"]]),
      downstream,
    );
    // Math expression with `<` — not a placeholder. Should be emitted once
    // the body exceeds the max placeholder length.
    r.push("If x < 10 and y is greater than zero ");
    r.push("then the formula produces a positive result.");
    r.flush();
    expect(received.join("")).toBe(
      "If x < 10 and y is greater than zero then the formula produces a positive result.",
    );
  });

  it("emits a terminal `<` on flush even if no `>` arrives", () => {
    const { received, downstream } = collect();
    const r = createStreamRehydrator(
      manifest([["<NAME_1>", "name", "Ada"]]),
      downstream,
    );
    r.push("Content before <NA");
    // Stream ends mid-placeholder — flush emits the buffered tail verbatim.
    r.flush();
    expect(received.join("")).toBe("Content before <NA");
  });

  it("handles multiple placeholders in one chunk", () => {
    const { received, downstream } = collect();
    const r = createStreamRehydrator(
      manifest([
        ["<NAME_1>", "name", "Ada"],
        ["<NAME_2>", "name", "Grace"],
      ]),
      downstream,
    );
    r.push("Meeting notes: <NAME_1> and <NAME_2> discussed the proposal.");
    r.flush();
    expect(received.join("")).toBe(
      "Meeting notes: Ada and Grace discussed the proposal.",
    );
  });

  it("preserves content order when multiple pushes arrive with placeholders", () => {
    const { received, downstream } = collect();
    const r = createStreamRehydrator(
      manifest([
        ["<NAME_1>", "name", "Ada"],
        ["<SSN_1>", "ssn", "123-45-6789"],
      ]),
      downstream,
    );
    r.push("Client ");
    r.push("<NAME_1>");
    r.push(" has SSN ");
    r.push("<SSN_1>");
    r.push(".");
    r.flush();
    expect(received.join("")).toBe("Client Ada has SSN 123-45-6789.");
  });

  it("rehydrates same placeholder across repeated chunks (single entry, multiple sites)", () => {
    const { received, downstream } = collect();
    const r = createStreamRehydrator(
      manifest([["<EMAIL_1>", "email", "ada@example.com"]]),
      downstream,
    );
    r.push("Email <EMAIL_1>; CC <EMAIL_1>.");
    r.flush();
    expect(received.join("")).toBe(
      "Email ada@example.com; CC ada@example.com.",
    );
  });

  it("falls back to passthrough when rehydrate throws (defensive)", () => {
    const { received, downstream } = collect();
    // Tampered placeholder shape — rehydrate() rejects it, applyManifest
    // catches and returns the text as-is. Stream continues; no crash.
    const m: RedactionManifest = {
      version: "1.0",
      redactionId: "test",
      placeholders: [
        {
          placeholder: "<bogus>", // fails VALID_PLACEHOLDER regex in scanner.rehydrate
          entityType: "x",
          original: "y",
          start: 0,
          end: 0,
          score: 1,
        },
      ],
      stats: {
        entitiesFound: 1,
        entitiesByType: {},
        textLengthOriginal: 0,
        textLengthSanitized: 0,
      },
    };
    const r = createStreamRehydrator(m, downstream);
    r.push("Some <bogus> text and <other> stuff.");
    r.flush();
    // Output equals input because rehydrate threw and we passed through.
    expect(received.join("")).toBe("Some <bogus> text and <other> stuff.");
  });
});
