// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Disclosure-card types.
 *
 * A disclosure card is the machine-readable record an RIA (or any operator of
 * an AI-assisted system) publishes to document what the system is, what model
 * sits behind it, how data is handled, what human oversight applies, and
 * which regulatory rules the operator is operating under.
 *
 * The shape is open-ended on string fields so adopters can fill in their own
 * jurisdiction / model / firm details; the Zod schema constrains the *shape*,
 * not the *settings*.
 */

/** Permitted human-oversight tiers. */
export const HUMAN_OVERSIGHT_TIERS = [
  "human_in_the_loop",
  "human_on_the_loop",
  "no_human_oversight",
] as const;

export type HumanOversightTier = (typeof HUMAN_OVERSIGHT_TIERS)[number];

/** PII-handling modes; aligned with `@protocolwealthos/pii-guard`. */
export const PII_HANDLING_MODES = ["off", "warn", "block", "redact"] as const;

export type PiiHandlingMode = (typeof PII_HANDLING_MODES)[number];

export interface OperatorBlock {
  /** Legal name of the operator firm. */
  readonly firm: string;
  /** CRD number for SEC-registered firms; empty string permitted for non-RIA operators. */
  readonly crd: string;
}

export interface ModelBlock {
  /** e.g. "anthropic" | "openai" | "google" | "self_hosted". */
  readonly provider: string;
  /** Provider's model name (e.g. "claude-sonnet-4-6"). */
  readonly name: string;
  /** Provider's model version pin (often equal to name; sometimes a date or hash). */
  readonly version: string;
}

export interface DataRetentionBlock {
  /** Days the operator retains the prompt (input). 0 = not retained beyond the request. */
  readonly inputRetentionDays: number;
  /** Days the operator retains the model output. 0 = not retained beyond the request. */
  readonly outputRetentionDays: number;
  /**
   * Whether the operator's contract with the model provider permits the
   * provider to train on this data. PW's stance is `false` (ZDR).
   */
  readonly trainingUse: boolean;
}

export interface HumanOversightBlock {
  /** Oversight tier from `HUMAN_OVERSIGHT_TIERS`. */
  readonly tier: HumanOversightTier;
  /**
   * Whether client-facing deliverables require explicit human (advisor)
   * approval before being sent. The HITL gate primitive
   * (`@protocolwealthos/shared/hitl`) is the canonical enforcement point.
   */
  readonly clientFacingRequiresApproval: boolean;
  /** Free-form description of what oversight covers. */
  readonly scope: string;
}

export interface PiiHandlingBlock {
  /** PII-handling mode from `PII_HANDLING_MODES`. */
  readonly mode: PiiHandlingMode;
  /**
   * Number of distinct PII-detection layers applied (e.g. PW's pii-guard
   * has 4: regex, NER, financial recognizers, allow-list).
   */
  readonly layerCount: number;
}

export interface AuditTrailBlock {
  /** Canonical regulatory rule the audit trail satisfies. */
  readonly rule: "SEC 204-2";
  /** Whether the trail uses hash-chaining or another tamper-evident shape. */
  readonly tamperEvident: boolean;
}

/**
 * The full disclosure card.
 *
 * `regulatoryBasis` is an array of free-form rule citations
 * (e.g. "SEC Rule 204-2", "Reg S-P §248.30"). Operators uncertain of a
 * citation should append `" [VERIFY]"` to the string rather than guessing.
 *
 * `knownLimitations` is operator-supplied: enumerate scenarios the system is
 * known not to handle well.
 */
export interface DisclosureCard {
  readonly systemName: string;
  readonly version: string;
  readonly operator: OperatorBlock;
  /** ISO-8601 datetime, e.g. "2026-05-27T13:45:00Z". */
  readonly generatedAt: string;
  readonly model: ModelBlock;
  /** e.g. "us_east", "eu_west_1", "gcp_us_central1". */
  readonly inferenceJurisdiction: string;
  readonly dataRetention: DataRetentionBlock;
  readonly humanOversight: HumanOversightBlock;
  readonly piiHandling: PiiHandlingBlock;
  readonly knownLimitations: readonly string[];
  /** Citations to specific regulatory rules. Use " [VERIFY]" suffix for any rule not independently verified. */
  readonly regulatoryBasis: readonly string[];
  readonly auditTrail: AuditTrailBlock;
}
