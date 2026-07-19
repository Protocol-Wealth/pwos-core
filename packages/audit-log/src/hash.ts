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

// stableJsonString: deep stable serializer for audit-chain hash input.
//
// Canonical peer implementation lives at
//   @protocolwealthos/mcp-tools src/confirmationGate.ts
// (function `stableJsonString`). The two implementations MUST stay
// behavior-identical on the following dimensions:
//
// - Recursive key sort (alphabetic, on the JSON.stringify-escaped key form).
// - Array order preservation (no sort).
// - Primitive handling via JSON.stringify.
// - undefined → "null" literal.
// - NaN/Infinity → "null" via JSON.stringify (JSON-spec-compliant silent
//   coercion). Audit payloads do not contain floats from real callers; this
//   matches mcp-tools' behavior.
// - BigInt → throws TypeError from JSON.stringify.
//
// If you change behavior here, update the peer or the chain hash will
// diverge between callers that use one vs. the other. Parity is enforced
// at test time — see __tests__/stable-json-parity.test.ts in this package.
//
// Why inlined instead of imported from mcp-tools: @protocolwealthos/audit-log
// is a zero-dependency leaf primitive supporting the platform's regulatory
// floor (SEC 17a-4 audit chain). Any code path that needs to write an audit
// row must be able to load this package without dragging in MCP. 10-line
// duplication + parity test is the chosen tradeoff. Revisit if the canonical
// serializer surface grows beyond ~20 lines (Maps, Sets, typed arrays,
// structured cloning) — at that point extract to a shared zero-dep package.
//
// Prior implementation (v0.3.0 and earlier) called
//   JSON.stringify(obj, Object.keys(obj).sort())
// which only sorted top-level keys; nested objects retained insertion order.
// That meant semantically-identical payloads with reordered nested keys
// produced different hashes. v0.4.0 fixes this.
export function stableJsonString(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableJsonString(v)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const entries = keys.map(
    (k) => `${JSON.stringify(k)}:${stableJsonString(obj[k])}`,
  );
  return `{${entries.join(",")}}`;
}

/** Serialize an entry into a canonical UTF-8 string for hashing. */
function canonicalize(entry: AuditEntry, previousHash: string): string {
  const obj: Record<string, unknown> = { previousHash };
  for (const field of CANONICAL_FIELDS) {
    obj[field] = entry[field] ?? null;
  }
  // Deep stable serialization — sorts keys recursively at every nesting
  // level so payloads with reordered nested keys hash identically.
  return stableJsonString(obj);
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
 *
 * Each entry is checked against the RUNNING predecessor hash — the ``hash``
 * of the entry that actually precedes it in the array — not against its own
 * stored ``previousHash``. Two independent checks must both hold:
 *
 *   1. The stored link (``entry.previousHash``) equals the real predecessor
 *      hash. This catches deletion of a middle entry, a front-truncated
 *      genesis, and reordering — even when the surviving rows are each
 *      internally self-consistent.
 *   2. The recomputed hash (over the running predecessor) equals the stored
 *      ``entry.hash``. This catches field edits.
 *
 * Verifying against ``entry.previousHash`` alone (as prior versions did)
 * defeated tamper-evidence: an attacker who dropped or edited a row and
 * recomputed only that row's own hash would still pass. The genesis anchor
 * is the empty string ``""`` — matching the write side (see logger.ts).
 */
export async function verifyChain(entries: AuditEntry[]): Promise<string | null> {
  let previousHash = "";
  for (const entry of entries) {
    if (!entry.hash) return entry.id;
    // The stored link must equal the ACTUAL predecessor hash — otherwise a
    // deleted / reordered / truncated row slips through even when its own
    // hash is internally self-consistent.
    if ((entry.previousHash ?? "") !== previousHash) return entry.id;
    const expected = await hashEntry(entry, previousHash);
    if (expected !== entry.hash) return entry.id;
    previousHash = entry.hash;
  }
  return null;
}
