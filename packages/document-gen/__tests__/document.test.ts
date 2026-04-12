// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
import { describe, expect, it } from "vitest";

import {
  PlainTextRenderer,
  escapeCsvField,
  objectsToCsv,
  rowsToCsv,
  type Document,
} from "../src/index.js";

describe("CSV", () => {
  it("emits simple rows", () => {
    const csv = rowsToCsv([
      ["a", 1],
      ["b", 2],
    ]);
    expect(csv).toBe("a,1\r\nb,2");
  });

  it("quotes fields with commas, quotes, and newlines", () => {
    expect(escapeCsvField('hello, "world"')).toBe('"hello, ""world"""');
    expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
  });

  it("emits headers when provided", () => {
    const csv = rowsToCsv([["x", 1]], { headers: ["name", "value"] });
    expect(csv).toContain("name,value");
  });

  it("prepends BOM when requested", () => {
    const csv = rowsToCsv([["a"]], { bom: true });
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("objectsToCsv uses keys of first object", () => {
    const csv = objectsToCsv([
      { name: "Alice", age: 30 },
      { name: "Bob", age: 25 },
    ]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("name,age");
    expect(lines[1]).toBe("Alice,30");
  });
});

describe("PlainTextRenderer", () => {
  it("renders a simple document", () => {
    const doc: Document = {
      title: "Review",
      blocks: [
        { type: "heading", level: 1, text: "Summary" },
        { type: "paragraph", text: "Positive quarter." },
        { type: "list", ordered: false, items: ["a", "b"] },
      ],
    };
    const text = new PlainTextRenderer().render(doc);
    expect(text).toContain("Review");
    expect(text).toContain("# Summary");
    expect(text).toContain("Positive quarter.");
    expect(text).toContain("- a");
    expect(text).toContain("- b");
  });

  it("renders a table with aligned columns", () => {
    const doc: Document = {
      title: "Tbl",
      blocks: [
        {
          type: "table",
          headers: ["Asset", "Weight"],
          rows: [
            ["AAPL", "20%"],
            ["MSFT", "15%"],
          ],
        },
      ],
    };
    const text = new PlainTextRenderer().render(doc);
    expect(text).toContain("Asset");
    expect(text).toContain("Weight");
    expect(text).toContain("AAPL");
  });

  it("distinguishes paragraph styles", () => {
    const doc: Document = {
      title: "Styles",
      blocks: [
        { type: "paragraph", text: "Standard disclosure.", style: "disclaimer" },
        { type: "paragraph", text: "Warning here.", style: "warning" },
      ],
    };
    const text = new PlainTextRenderer().render(doc);
    expect(text).toContain("[DISCLAIMER]");
    expect(text).toContain("[WARNING]");
  });
});
