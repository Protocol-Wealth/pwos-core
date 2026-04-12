// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * Document renderer interface.
 *
 * Actual PDF / PPTX / DOCX / HTML generation requires large third-party
 * libraries we don't want as hard dependencies. This module defines the
 * renderer contract; concrete implementations sit behind it as optional
 * packages or user-supplied adapters.
 *
 * The default ``PlainTextRenderer`` ships with the package so users can
 * exercise the document model without any extra deps.
 */

import type { Block, Document, HeadingBlock, ParagraphBlock, TableBlock } from "./types.js";

/** A renderer turns a ``Document`` into a format-specific output. */
export interface DocumentRenderer<TOutput = unknown> {
  /** Human-readable renderer name (e.g. "pdf", "pptx", "plain-text"). */
  readonly format: string;
  /** Render a document to the renderer's native output. */
  render(doc: Document): Promise<TOutput> | TOutput;
}

/** Simple plain-text renderer — no deps, useful for testing and debugging. */
export class PlainTextRenderer implements DocumentRenderer<string> {
  readonly format = "plain-text";

  render(doc: Document): string {
    const out: string[] = [];
    out.push(doc.title);
    if (doc.subtitle) out.push(doc.subtitle);
    if (doc.author) out.push(`By ${doc.author}`);
    out.push("=".repeat(doc.title.length));
    out.push("");

    for (const block of doc.blocks) {
      out.push(this.renderBlock(block));
    }

    return out.join("\n").replace(/\n{3,}/g, "\n\n");
  }

  private renderBlock(block: Block): string {
    switch (block.type) {
      case "heading":
        return this.renderHeading(block);
      case "paragraph":
        return this.renderParagraph(block);
      case "list":
        return block.items
          .map((item, i) => (block.ordered ? `${i + 1}. ${item}` : `- ${item}`))
          .join("\n");
      case "table":
        return this.renderTable(block);
      case "image":
        return `[Image: ${block.altText ?? block.source}]`;
      case "spacer":
        return "\n".repeat(Math.max(1, Math.floor(block.size)));
      case "pageBreak":
        return "\n--- PAGE BREAK ---\n";
    }
  }

  private renderHeading(block: HeadingBlock): string {
    const prefix = "#".repeat(block.level);
    return `\n${prefix} ${block.text}`;
  }

  private renderParagraph(block: ParagraphBlock): string {
    if (block.style === "disclaimer") return `[DISCLAIMER] ${block.text}`;
    if (block.style === "warning") return `[WARNING] ${block.text}`;
    if (block.style === "note") return `[NOTE] ${block.text}`;
    return block.text;
  }

  private renderTable(block: TableBlock): string {
    const widths = block.headers.map((h, i) =>
      Math.max(h.length, ...block.rows.map((r) => String(r[i] ?? "").length)),
    );
    const pad = (s: string, i: number) => s.padEnd(widths[i], " ");
    const lines = [
      block.headers.map(pad).join(" | "),
      widths.map((w) => "-".repeat(w)).join("-+-"),
      ...block.rows.map((row) => row.map((cell, i) => pad(String(cell ?? ""), i)).join(" | ")),
    ];
    if (block.caption) lines.unshift(block.caption);
    return lines.join("\n");
  }
}
