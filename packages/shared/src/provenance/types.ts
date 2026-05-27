// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Provenance record types.
 *
 * A provenance record captures the load-bearing facts about a single AI
 * generation: which model produced it, what the prompt was (hashed —
 * never raw), what retrieved sources were stitched into the prompt, what
 * the PII-redaction pipeline summarized, who (if anyone) approved the
 * output, and when. Records are then hash-chained so any after-the-fact
 * edit of a historical record causes every subsequent hash to break.
 *
 * Wiring this into the production audit trail (`audit_log` / `ai_audit_log`
 * in the private estate) is OUT OF SCOPE for this module. See HANDOFF.md.
 */

/** The model that produced the generation. */
export interface ProvenanceModel {
  /** e.g. "anthropic" | "openai" | "google" | "self_hosted". */
  readonly provider: string;
  /** Provider's model name (e.g. "claude-sonnet-4-6"). */
  readonly name: string;
  /** Pinned version of the model. */
  readonly version: string;
}

/** Summary of what the PII pipeline did on this generation's input/output. */
export interface ProvenanceRedactionSummary {
  /** Number of PII layers applied (e.g. 4 for `@protocolwealthos/pii-guard`). */
  readonly layerCount: number;
  /** Count of distinct redactions made across all layers. */
  readonly redactedCount: number;
  /** Distinct masking categories applied (e.g. ["ssn", "account_number"]). */
  readonly masksApplied: readonly string[];
}

/**
 * Identity of the human (if any) who approved the generation before it
 * proceeded.
 *
 * Optional because not every record is gated by a human (e.g. internal
 * research per the HITL default policy). When present, the approver should
 * be set BEFORE hashing — otherwise the chain hash will diverge between the
 * pre-approval and post-approval records.
 */
export interface ProvenanceApprover {
  /** Caller-supplied identifier (user id, advisor id). */
  readonly id: string;
  /** Optional display name (advisor name). */
  readonly displayName?: string;
  /** ISO-8601 datetime of the approval. */
  readonly approvedAt: string;
}

/**
 * The unhashed shape — what a caller passes in to be chained. `id` and
 * `timestamp` are required; everything below is content. The caller does
 * NOT supply `prevHash` or `hash` — `chainRecord` populates those.
 */
export interface NewProvenanceRecord {
  /** Caller-supplied unique id (UUID recommended). */
  readonly id: string;
  /** ISO-8601 datetime when the generation occurred. */
  readonly timestamp: string;
  /** Model identity at generation time. */
  readonly model: ProvenanceModel;
  /** SHA-256 hex of the *raw* prompt the model received. Never the raw prompt. */
  readonly promptHash: string;
  /** Caller-supplied ids of the documents / records retrieved into the prompt. */
  readonly retrievedSourceIds: readonly string[];
  /** Summary of the redaction pipeline's effect on this generation. */
  readonly redactionSummary: ProvenanceRedactionSummary;
  /** Approver, when the HITL gate required one. */
  readonly approver?: ProvenanceApprover;
}

/**
 * A chained record — `NewProvenanceRecord` plus the two chain fields
 * populated by `chainRecord` / `chainAll`.
 *
 * `prevHash` is the empty string for the genesis record.
 * `hash` is the SHA-256 hex of the canonical serialization of (prevHash +
 * the content fields). Any post-write edit to any record forces every
 * downstream `hash` to diverge from the recomputed expected value, which
 * is what `verifyChain` detects.
 */
export interface ProvenanceRecord extends NewProvenanceRecord {
  /** Hash of the previous record. Empty string for the genesis. */
  readonly prevHash: string;
  /** SHA-256 hex of this record's canonical form. */
  readonly hash: string;
}

/** Detailed result of `verifyChain`. */
export interface VerifyChainResult {
  /** True iff every record's hash matches the recomputed expected value. */
  readonly valid: boolean;
  /** Index of the first bad record, when `valid` is false. */
  readonly badIndex?: number;
  /** Id of the first bad record, when `valid` is false. */
  readonly badId?: string;
  /** Plain-English description of the failure mode. */
  readonly reason?: string;
}
