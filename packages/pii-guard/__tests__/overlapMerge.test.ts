// SPDX-License-Identifier: MIT-0 OR Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
import { describe, expect, it } from "vitest";

import { AllowList, rehydrate, scan, type DetectedEntity } from "../src/index.js";

/**
 * Coverage invariant: after the allow-list drops intentionally unprotected
 * detections, every remaining character a detector flagged is masked.
 * Score and source choose a label. They must not shrink the union.
 */
function coverage(length: number, spans: Array<{ start: number; end: number }>): boolean[] {
  const covered = Array.from({ length }, () => false);
  for (const span of spans) {
    for (let i = span.start; i < span.end; i++) covered[i] = true;
  }
  return covered;
}

function expectUnionMasked(
  input: string,
  sanitized: string,
  manifestSpans: Array<{ start: number; end: number }>,
  protectedSpans: Array<{ start: number; end: number }>,
): void {
  const expected = coverage(input.length, protectedSpans);
  const actual = coverage(input.length, manifestSpans);
  for (let i = 0; i < input.length; i++) {
    if (!expected[i]) continue;
    expect(actual[i], `manifest missed index ${i} (${JSON.stringify(input[i])})`).toBe(true);
    expect(sanitized.includes(input[i]!), `clear character ${JSON.stringify(input[i])} at ${i}`).toBe(
      false,
    );
  }
}

function nerEntity(
  input: string,
  start: number,
  end: number,
  score: number,
  entityType: string,
): DetectedEntity {
  return {
    entityType,
    text: input.slice(start, end),
    start,
    end,
    score,
    source: "ner",
  };
}

describe("overlapping detection coverage", () => {
  it("masks the union when a shorter higher score shares a start with a longer span", async () => {
    const input = "abcdefghijkl";
    const result = await scan(input, {
      ner: () => [
        nerEntity(input, 0, 4, 0.95, "SHORT"),
        nerEntity(input, 0, 12, 0.9, "LONG"),
      ],
    });

    expectUnionMasked(input, result.sanitizedText, result.manifest.placeholders, [
      { start: 0, end: 12 },
    ]);
    expect(result.manifest.placeholders).toHaveLength(1);
    expect(result.manifest.placeholders[0]?.start).toBe(0);
    expect(result.manifest.placeholders[0]?.end).toBe(12);
    expect(result.manifest.placeholders[0]?.entityType).toBe("SHORT");
    expect(rehydrate(result.sanitizedText, result.manifest)).toBe(input);
    expect(result.sanitizedText).not.toContain("efghijkl");
  });

  it("masks containment when the inner span starts later", async () => {
    const input = "abcdefghijkl";
    const result = await scan(input, {
      ner: () => [
        nerEntity(input, 0, 12, 0.4, "OUTER"),
        nerEntity(input, 2, 6, 0.99, "INNER"),
      ],
    });

    expectUnionMasked(input, result.sanitizedText, result.manifest.placeholders, [
      { start: 0, end: 12 },
    ]);
    expect(result.manifest.placeholders[0]?.entityType).toBe("INNER");
    expect(rehydrate(result.sanitizedText, result.manifest)).toBe(input);
  });

  it("masks a partial overlap that neither span contains", async () => {
    const input = "abcdefghijkl";
    const result = await scan(input, {
      ner: () => [
        nerEntity(input, 0, 5, 0.99, "LEFT"),
        nerEntity(input, 3, 10, 0.4, "RIGHT"),
      ],
    });

    expectUnionMasked(input, result.sanitizedText, result.manifest.placeholders, [
      { start: 0, end: 10 },
    ]);
    expect(result.manifest.placeholders).toHaveLength(1);
    expect(result.manifest.placeholders[0]?.end).toBe(10);
    expect(result.sanitizedText).toBe(`<LEFT_1>${input.slice(10)}`);
    expect(rehydrate(result.sanitizedText, result.manifest)).toBe(input);
  });

  it("collapses a chain of overlaps into one covered span", async () => {
    const input = "abcdefghijkl";
    const result = await scan(input, {
      ner: () => [
        nerEntity(input, 0, 5, 0.5, "A"),
        nerEntity(input, 4, 9, 0.6, "B"),
        nerEntity(input, 8, 12, 0.7, "C"),
      ],
    });

    expectUnionMasked(input, result.sanitizedText, result.manifest.placeholders, [
      { start: 0, end: 12 },
    ]);
    expect(result.manifest.placeholders).toHaveLength(1);
    expect(result.manifest.placeholders[0]?.entityType).toBe("C");
    expect(rehydrate(result.sanitizedText, result.manifest)).toBe(input);
  });

  it("keeps adjacent detections separate and still masks both", async () => {
    const input = "aaaabbbbcccc";
    const result = await scan(input, {
      ner: () => [
        nerEntity(input, 0, 4, 0.8, "LEFT"),
        nerEntity(input, 4, 8, 0.9, "RIGHT"),
      ],
    });

    expect(result.manifest.placeholders.map((entry) => [entry.start, entry.end])).toEqual([
      [0, 4],
      [4, 8],
    ]);
    expectUnionMasked(input, result.sanitizedText, result.manifest.placeholders, [
      { start: 0, end: 4 },
      { start: 4, end: 8 },
    ]);
    expect(result.sanitizedText).toContain("cccc");
    expect(rehydrate(result.sanitizedText, result.manifest)).toBe(input);
  });

  it("collapses duplicate spans to one placeholder", async () => {
    const input = "abcdefghijkl";
    const result = await scan(input, {
      ner: () => [
        nerEntity(input, 0, 12, 0.5, "DUP"),
        nerEntity(input, 0, 12, 0.5, "DUP"),
      ],
    });

    expect(result.manifest.placeholders).toHaveLength(1);
    expectUnionMasked(input, result.sanitizedText, result.manifest.placeholders, [
      { start: 0, end: 12 },
    ]);
  });

  it("lets the longer equal-score span name the union", async () => {
    const input = "abcdefghijkl";
    const result = await scan(input, {
      ner: () => [
        nerEntity(input, 0, 4, 0.8, "SHORT"),
        nerEntity(input, 0, 12, 0.8, "LONG"),
      ],
    });

    expect(result.manifest.placeholders[0]?.entityType).toBe("LONG");
    expect(result.manifest.placeholders[0]?.end).toBe(12);
    expectUnionMasked(input, result.sanitizedText, result.manifest.placeholders, [
      { start: 0, end: 12 },
    ]);
  });

  it("prefers a regex label on an equal score and equal length, without dropping coverage", async () => {
    const input = "123-45-6789";
    const result = await scan(input, {
      context: "financial_notes",
      ner: (text) => [nerEntity(text, 0, text.length, 0.9, "PERSON")],
    });

    expect(result.categories).toContain("US_SSN");
    expect(result.manifest.placeholders.some((entry) => entry.entityType === "US_SSN")).toBe(true);
    expect(result.sanitizedText).not.toContain("123-45-6789");
    expect(rehydrate(result.sanitizedText, result.manifest)).toBe(input);
  });

  it("does not let an allow-listed wrapper suppress an overlapping detection", async () => {
    const input = "ACCT 123-45-6789";
    const allowList = new AllowList();
    allowList.appendTerms([input]);
    const result = await scan(input, {
      allowList,
      ner: (text) => [nerEntity(text, 0, text.length, 0.99, "WRAPPER")],
    });

    expect(result.sanitizedText).toContain("ACCT ");
    expect(result.sanitizedText).not.toContain("123-45-6789");
    expect(result.categories).toContain("US_SSN");
    expect(result.categories).not.toContain("WRAPPER");
    expect(rehydrate(result.sanitizedText, result.manifest)).toBe(input);
  });

  it("leaves an allow-listed term visible when it does not overlap other detections", async () => {
    const input = "EBITDA 123-45-6789";
    const result = await scan(input, {
      ner: (text) => [nerEntity(text, 0, "EBITDA".length, 0.99, "TERM")],
    });

    expect(result.sanitizedText.startsWith("EBITDA ")).toBe(true);
    expect(result.sanitizedText).not.toContain("123-45-6789");
    expect(result.categories).not.toContain("TERM");
    expect(rehydrate(result.sanitizedText, result.manifest)).toBe(input);
  });

  it("keeps manifest originals out of the sanitized string a hosted model would see", async () => {
    const input = "abcdefghijkl";
    const result = await scan(input, {
      ner: () => [nerEntity(input, 0, 12, 0.9, "LONG")],
    });
    const hostedRequest = { text: result.sanitizedText };

    expect(JSON.stringify(hostedRequest)).not.toContain(input);
    expect(result.manifest.placeholders[0]?.original).toBe(input);
    expect(rehydrate(result.sanitizedText, result.manifest)).toBe(input);
  });
});
