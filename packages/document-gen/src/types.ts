// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * Document model types shared across generators.
 *
 * A ``Document`` is a hierarchy of ``Block``s describing the content you
 * want to render in any output format (PDF, PPTX, DOCX, HTML, CSV).
 * Generators are adapters that map the block tree to their native format.
 */

export interface Document {
  /** Title rendered in the document header / footer / metadata. */
  title: string;
  /** Optional subtitle or cover-page byline. */
  subtitle?: string;
  /** Author or firm name. */
  author?: string;
  /** ISO-8601 creation timestamp. Defaults to now when rendering. */
  createdAt?: string;
  /** Top-level content blocks. */
  blocks: Block[];
  /** Arbitrary metadata (regulatory flags, retention period, etc.). */
  metadata?: Record<string, unknown>;
}

export type Block =
  | HeadingBlock
  | ParagraphBlock
  | ListBlock
  | TableBlock
  | ImageBlock
  | SpacerBlock
  | PageBreakBlock;

export interface HeadingBlock {
  type: "heading";
  /** 1-6 (h1 being largest). */
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
}

export interface ParagraphBlock {
  type: "paragraph";
  text: string;
  /** Optional inline formatting hints. */
  style?: ParagraphStyle;
}

export type ParagraphStyle = "normal" | "note" | "warning" | "disclaimer";

export interface ListBlock {
  type: "list";
  ordered: boolean;
  items: string[];
}

export interface TableBlock {
  type: "table";
  headers: string[];
  rows: Array<Array<string | number>>;
  /** Visual hint — generators decide how to express it. */
  caption?: string;
}

export interface ImageBlock {
  type: "image";
  /** Base64 data URL or absolute URL. */
  source: string;
  altText?: string;
  caption?: string;
  /** Desired width in document units (generator-specific defaults apply). */
  width?: number;
  height?: number;
}

export interface SpacerBlock {
  type: "spacer";
  /** Generator-relative spacing (e.g. lines or points). */
  size: number;
}

export interface PageBreakBlock {
  type: "pageBreak";
}
