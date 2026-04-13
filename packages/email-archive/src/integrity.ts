// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * Chain-of-custody hashing for the email archive.
 *
 * Each archived email carries a SHA-256 of the canonical record
 * (fields that affect content / timing / custody) plus the previous
 * record's hash. Tampering with any historical record breaks every
 * downstream hash — the same Merkle-lite pattern @protocolwealthos/audit-log uses.
 *
 * Useful when the underlying storage is not intrinsically WORM (e.g.,
 * a relational DB). Pair with object-lock storage and signed export
 * bundles (@protocolwealthos/compliance BooksAndRecordsBundle) for defensible
 * SEC Rule 17a-4 evidence.
 */

import type { ArchivedEmail } from "./types.js";

/**
 * Fields contributing to the content hash. Order is stable — any
 * change here requires a version bump of archived records to re-chain.
 */
const CANONICAL_FIELDS: Array<keyof ArchivedEmail> = [
  "id",
  "messageId",
  "inReplyTo",
  "threadId",
  "occurredAt",
  "archivedAt",
  "from",
  "to",
  "cc",
  "bcc",
  "subject",
  "bodyText",
  "bodyHtml",
  "attachments",
  "rawHeaders",
  "classification",
  "direction",
];

/** Canonicalize an email record for deterministic hashing. */
export function canonicalize(email: ArchivedEmail, previousHash: string): string {
  const obj: Record<string, unknown> = { previousHash };
  for (const field of CANONICAL_FIELDS) {
    obj[field] = email[field] ?? null;
  }
  return JSON.stringify(obj, sortedReplacer);
}

function sortedReplacer(_key: string, value: unknown): unknown {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const ordered: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      ordered[k] = (value as Record<string, unknown>)[k];
    }
    return ordered;
  }
  return value;
}

/** SHA-256 using Web Crypto API first, Node crypto fallback. */
async function sha256Hex(input: string): Promise<string> {
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

/** Compute the content hash of an email given the prior record's hash. */
export async function hashEmail(email: ArchivedEmail, previousHash: string): Promise<string> {
  return sha256Hex(canonicalize(email, previousHash));
}

/**
 * Finalize a new record before persistence: attach previousHash + contentHash.
 *
 * ``priorLatest`` is the previously-archived record in the same stream
 * (or a fake seed record if you're starting a new stream).
 */
export async function finalizeRecord(
  email: ArchivedEmail,
  priorLatestHash: string = "",
): Promise<ArchivedEmail> {
  const previousHash = priorLatestHash;
  const contentHash = await hashEmail(email, previousHash);
  return { ...email, previousHash, contentHash };
}

/**
 * Verify a chain of archived emails. Pass records in insertion order
 * (oldest first). Returns the id of the first broken record, or null
 * if the chain is intact.
 */
export async function verifyChain(emails: readonly ArchivedEmail[]): Promise<string | null> {
  let previousHash = "";
  for (const email of emails) {
    if (!email.contentHash) return email.id;
    const expected = await hashEmail(email, email.previousHash ?? previousHash);
    if (expected !== email.contentHash) return email.id;
    previousHash = email.contentHash;
  }
  return null;
}
