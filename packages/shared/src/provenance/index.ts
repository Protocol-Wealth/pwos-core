// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * @protocolwealthos/shared/provenance
 *
 * SHA-256 hash-chained provenance records.
 *
 * Use `chainAll` to seal a sequence of unhashed `NewProvenanceRecord`s into
 * a chained `ProvenanceRecord[]`. Use `verifyChain` later to detect tampering
 * — any post-hoc edit to a sealed record breaks the recomputed hash and
 * `verifyChain` returns `{ valid: false, badIndex, badId, reason }`.
 *
 * Wiring this into the production audit trail (the private estate's
 * `audit_log` / `ai_audit_log` surface) is OUT OF SCOPE for this module.
 * See HANDOFF.md at the repo root.
 */

export {
  chainAll,
  chainRecord,
  hashProvenanceRecord,
  stableJsonString,
  verifyChain,
} from "./hashChain.js";

export type {
  NewProvenanceRecord,
  ProvenanceApprover,
  ProvenanceModel,
  ProvenanceRecord,
  ProvenanceRedactionSummary,
  VerifyChainResult,
} from "./types.js";
