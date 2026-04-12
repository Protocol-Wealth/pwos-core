// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * @pwos/document-gen
 *
 * Document model + renderer interface for advisor reports. The package
 * ships a clean type hierarchy, RFC 4180 CSV generation, and a built-in
 * plain-text renderer. Actual PDF / PPTX / DOCX rendering happens behind
 * the ``DocumentRenderer`` interface — pick a library (pdfkit, docx,
 * pptxgenjs) and wire it up, or use a prebuilt adapter.
 *
 * Minimum usage::
 *
 *     import { PlainTextRenderer, type Document } from "@pwos/document-gen";
 *
 *     const doc: Document = {
 *       title: "Q1 Portfolio Review",
 *       blocks: [
 *         { type: "heading", level: 1, text: "Summary" },
 *         { type: "paragraph", text: "Positive quarter." },
 *         { type: "table",
 *           headers: ["Asset", "Weight"],
 *           rows: [["AAPL", "20%"], ["MSFT", "15%"]] },
 *       ],
 *     };
 *
 *     const text = new PlainTextRenderer().render(doc);
 *
 * CSV usage::
 *
 *     import { objectsToCsv } from "@pwos/document-gen";
 *     const csv = objectsToCsv([{ a: 1, b: 2 }, { a: 3, b: 4 }]);
 *
 * Third-party library integration examples are documented in the package
 * README. Renderers live in user code so only the libraries you actually
 * use end up in your bundle.
 */

export const VERSION = "0.1.0";

export {
  escapeCsvField,
  objectsToCsv,
  rowsToCsv,
  type CsvOptions,
} from "./csv.js";

export {
  PlainTextRenderer,
  type DocumentRenderer,
} from "./renderer.js";

export type {
  Block,
  Document,
  HeadingBlock,
  ImageBlock,
  ListBlock,
  PageBreakBlock,
  ParagraphBlock,
  ParagraphStyle,
  SpacerBlock,
  TableBlock,
} from "./types.js";
