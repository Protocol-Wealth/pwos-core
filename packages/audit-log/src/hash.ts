// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * Hash chaining for the audit log.
 *
 * Each entry carries a SHA-256 hash of (previous-entry-hash || current-fields).
 * This forms a Merkle-like chain that lets auditors detect tampering: if any
 * historical entry is modified or deleted, every subsequent hash breaks.
 *
 * Hashing runs in the application process — this is an integrity signal,
 * not a cryptographic audit trail. For regulatory-grade immutability, pair
 * this with object-lock storage or a write-once database table.
 */

import type { AuditEntry } from "./types.js";

/** Fields that contribute to the hash. Must stay stable across versions. */
const CANONICAL_FIELDS: Array<keyof AuditEntry> = [
  "id",
  "timestamp",
  "actorId",
  "action",
  "resourceType",
  "resourceId",
  "details",
  "ipAddress",
];

/** Serialize an entry into a canonical UTF-8 string for hashing. */
function canonicalize(entry: AuditEntry, previousHash: string): string {
  const obj: Record<string, unknown> = { previousHash };
  for (const field of CANONICAL_FIELDS) {
    obj[field] = entry[field] ?? null;
  }
  // Sort keys deterministically for stable hashing across runtimes.
  return JSON.stringify(obj, Object.keys(obj).sort());
}

/** Compute SHA-256 hex digest. */
async function sha256Hex(input: string): Promise<string> {
  const g = globalThis as { crypto?: SubtleCryptoLike };
  if (g.crypto?.subtle) {
    const buf = new TextEncoder().encode(input);
    const digest = await g.crypto.subtle.digest("SHA-256", buf);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Node < 19 fallback — dynamic import of the built-in crypto module.
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(input).digest("hex");
}

interface SubtleCryptoLike {
  subtle?: {
    digest(algo: string, data: ArrayBuffer | ArrayBufferView): Promise<ArrayBuffer>;
  };
}

/** Compute the hash for an entry given its predecessor's hash. */
export async function hashEntry(entry: AuditEntry, previousHash: string): Promise<string> {
  return sha256Hex(canonicalize(entry, previousHash));
}

/**
 * Verify a chain of entries. Entries must be passed oldest-first.
 * Returns ``null`` when the chain is intact, or the id of the first bad
 * entry when tampering is detected.
 */
export async function verifyChain(entries: AuditEntry[]): Promise<string | null> {
  let previousHash = "";
  for (const entry of entries) {
    if (!entry.hash) return entry.id;
    const expected = await hashEntry(entry, entry.previousHash ?? previousHash);
    if (expected !== entry.hash) return entry.id;
    previousHash = entry.hash;
  }
  return null;
}
