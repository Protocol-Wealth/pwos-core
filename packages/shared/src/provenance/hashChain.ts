// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * SHA-256 hash chaining for provenance records.
 *
 * Each record's hash inputs are (canonical(record content) ++ prevHash). The
 * genesis record uses prevHash = "". Any post-hoc edit anywhere in the chain
 * causes the recomputed hash to differ from the stored hash on the edited
 * record AND on every record after it — so `verifyChain` flags the first
 * divergent record.
 *
 * Canonical serialization (`stableJsonString`) mirrors the same shape used by
 * `@protocolwealthos/audit-log`'s hash chain — deep alphabetical key sort,
 * array order preserved, primitives via JSON.stringify, undefined → "null".
 * The implementation is duplicated rather than imported so this module
 * stays self-contained (no cross-package dep). Parity with the audit-log
 * serializer is asserted by an internal test
 * (`__tests__/provenance.test.ts`).
 */

import type {
  NewProvenanceRecord,
  ProvenanceRecord,
  VerifyChainResult,
} from "./types.js";

/** Fields that contribute to the hash. Must stay stable across versions. */
const CONTENT_FIELDS: Array<keyof NewProvenanceRecord> = [
  "id",
  "timestamp",
  "model",
  "promptHash",
  "retrievedSourceIds",
  "redactionSummary",
  "approver",
];

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

function canonicalize(record: NewProvenanceRecord, prevHash: string): string {
  const obj: Record<string, unknown> = { prevHash };
  for (const field of CONTENT_FIELDS) {
    obj[field] = record[field] ?? null;
  }
  return stableJsonString(obj);
}

interface SubtleCryptoLike {
  subtle?: {
    digest(algo: string, data: ArrayBuffer | ArrayBufferView): Promise<ArrayBuffer>;
  };
}

async function sha256Hex(input: string): Promise<string> {
  const g = globalThis as { crypto?: SubtleCryptoLike };
  if (g.crypto?.subtle) {
    const buf = new TextEncoder().encode(input);
    const digest = await g.crypto.subtle.digest("SHA-256", buf);
    return [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(input).digest("hex");
}

/** Compute the hash a record would carry, given its predecessor's hash. */
export async function hashProvenanceRecord(
  record: NewProvenanceRecord,
  prevHash: string,
): Promise<string> {
  return sha256Hex(canonicalize(record, prevHash));
}

/**
 * Chain a single record onto a predecessor's hash, returning the fully-populated
 * record. Pass `prevHash = ""` to mint the genesis record.
 */
export async function chainRecord(
  record: NewProvenanceRecord,
  prevHash: string,
): Promise<ProvenanceRecord> {
  const hash = await hashProvenanceRecord(record, prevHash);
  return { ...record, prevHash, hash };
}

/**
 * Chain a sequence of unhashed records into a verified chain. The first
 * record becomes the genesis (prevHash = ""). Subsequent records chain off
 * their predecessor's hash. Output preserves input order.
 */
export async function chainAll(
  records: readonly NewProvenanceRecord[],
): Promise<ProvenanceRecord[]> {
  const out: ProvenanceRecord[] = [];
  let prev = "";
  for (const record of records) {
    const chained = await chainRecord(record, prev);
    out.push(chained);
    prev = chained.hash;
  }
  return out;
}

/**
 * Verify a chain. Returns `valid: true` when every record's stored `hash`
 * matches the value recomputed from its content + the previous record's
 * `hash`. On failure, returns the index, id, and a reason for the first
 * divergent record.
 *
 * Records must be passed oldest-first.
 */
export async function verifyChain(
  records: readonly ProvenanceRecord[],
): Promise<VerifyChainResult> {
  let expectedPrev = "";
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    if (record === undefined) {
      return {
        valid: false,
        badIndex: i,
        reason: `Record at index ${i} is undefined (sparse array).`,
      };
    }
    if (record.prevHash !== expectedPrev) {
      return {
        valid: false,
        badIndex: i,
        badId: record.id,
        reason: `prevHash mismatch at index ${i} (record id ${record.id}); expected "${expectedPrev}", got "${record.prevHash}".`,
      };
    }
    const recomputed = await hashProvenanceRecord(record, record.prevHash);
    if (recomputed !== record.hash) {
      return {
        valid: false,
        badIndex: i,
        badId: record.id,
        reason: `hash mismatch at index ${i} (record id ${record.id}); record content has been edited since the chain was sealed.`,
      };
    }
    expectedPrev = record.hash;
  }
  return { valid: true };
}
