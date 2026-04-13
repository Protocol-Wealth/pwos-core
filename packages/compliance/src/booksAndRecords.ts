// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * Books-and-Records export bundler.
 *
 * SEC Rule 204-2 requires registered investment advisers to maintain
 * and produce specific categories of records on demand for SEC
 * examiners. This module produces a standard export bundle that
 * examiners can ingest:
 *
 *   - Top-level manifest with firm identity, date range, section counts,
 *     and SHA-256 hashes for chain-of-custody.
 *   - Named sections (audit log, communications, advisory records, etc.)
 *     each carrying the raw records the firm maintains.
 *
 * The builder does not query data itself — the caller assembles section
 * arrays from whatever stores they use (Drizzle, Prisma, raw SQL). The
 * builder's job is to package + hash consistently.
 */

import type {
  BooksAndRecordsExport,
  BooksAndRecordsManifest,
} from "./types.js";

// ──────────────────────────────────────────────────────────────────────
// Bundle builder
// ──────────────────────────────────────────────────────────────────────

export interface BundleOptions {
  /** ISO-8601 start of the period being exported. */
  periodStart: string;
  /** ISO-8601 end of the period being exported. */
  periodEnd: string;
  /** Who requested the export (user id or role label). */
  requestedBy?: string;
  /** Firm identity fields. */
  firm?: BooksAndRecordsManifest["firm"];
  /** Clock override for deterministic tests. */
  now?: () => Date;
  /** Hashing override — default uses SubtleCrypto / node:crypto. */
  sha256?: (input: string) => Promise<string>;
}

export class BooksAndRecordsBundle {
  private readonly sections: Map<string, unknown[]> = new Map();
  private readonly opts: BundleOptions;

  constructor(opts: BundleOptions) {
    this.opts = opts;
  }

  /** Add a section (may be called once per section name). */
  addSection(name: string, records: unknown[]): this {
    if (this.sections.has(name)) {
      throw new Error(`Section "${name}" already added`);
    }
    this.sections.set(name, [...records]);
    return this;
  }

  /** Produce the final immutable export object with manifest + hashes. */
  async build(): Promise<BooksAndRecordsExport> {
    const sectionHashes: Record<string, string> = {};
    const counts: Record<string, number> = {};
    const hashFn = this.opts.sha256 ?? defaultSha256;

    for (const [name, records] of this.sections.entries()) {
      counts[name] = records.length;
      sectionHashes[name] = await hashFn(canonicalize(records));
    }

    const manifest: BooksAndRecordsManifest = {
      version: "1.0",
      generatedAt: (this.opts.now?.() ?? new Date()).toISOString(),
      requestedBy: this.opts.requestedBy,
      periodStart: this.opts.periodStart,
      periodEnd: this.opts.periodEnd,
      counts,
      firm: this.opts.firm,
      sectionHashes,
    };

    const sections: Record<string, unknown[]> = {};
    for (const [name, records] of this.sections.entries()) {
      sections[name] = records;
    }

    return { manifest, sections };
  }
}

// ──────────────────────────────────────────────────────────────────────
// Integrity helpers
// ──────────────────────────────────────────────────────────────────────

/**
 * Verify a bundle's manifest hashes match the current section payloads.
 *
 * Returns the first mismatched section name, or ``null`` if the bundle
 * is intact. Catches tampering between export time and ingestion.
 */
export async function verifyBundle(
  bundle: BooksAndRecordsExport,
  sha256: (input: string) => Promise<string> = defaultSha256,
): Promise<string | null> {
  const hashes = bundle.manifest.sectionHashes;
  if (!hashes) return null;
  for (const [name, records] of Object.entries(bundle.sections)) {
    const expected = hashes[name];
    if (!expected) continue;
    const actual = await sha256(canonicalize(records));
    if (actual !== expected) return name;
  }
  return null;
}

// ──────────────────────────────────────────────────────────────────────
// Internals
// ──────────────────────────────────────────────────────────────────────

/** Serialize with sorted keys for deterministic hashing across runtimes. */
function canonicalize(value: unknown): string {
  return JSON.stringify(value, canonicalReplacer);
}

function canonicalReplacer(_key: string, value: unknown): unknown {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const ordered: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      ordered[k] = (value as Record<string, unknown>)[k];
    }
    return ordered;
  }
  return value;
}

async function defaultSha256(input: string): Promise<string> {
  const g = globalThis as { crypto?: SubtleCryptoLike };
  if (g.crypto?.subtle) {
    const buf = new TextEncoder().encode(input);
    const digest = await g.crypto.subtle.digest("SHA-256", buf);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(input).digest("hex");
}

interface SubtleCryptoLike {
  subtle?: {
    digest(algo: string, data: ArrayBuffer | ArrayBufferView): Promise<ArrayBuffer>;
  };
}
