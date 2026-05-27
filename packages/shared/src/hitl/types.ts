// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Human-in-the-loop (HITL) gate types.
 *
 * The HITL gate maps an action's *class* to a required oversight level. The
 * canonical PW shape is two classes (client_facing_deliverable | internal_research),
 * but the policy accepts any string keys — adopters can extend the taxonomy.
 *
 * The evaluator is fail-closed: an action whose class is not present in the
 * policy is treated as if its oversight level were "mandatory", so the
 * decision is always to require human approval.
 */

/** Canonical action classes used by the default policy. */
export const KNOWN_ACTION_CLASSES = [
  "client_facing_deliverable",
  "internal_research",
] as const;

/** Type alias for the canonical action class strings. */
export type KnownActionClass = (typeof KNOWN_ACTION_CLASSES)[number];

/**
 * Required oversight for an action class.
 *
 * - `mandatory`: human approval REQUIRED before the action proceeds.
 * - `optional`:  human approval recommended but not required; the action
 *                may proceed and should be logged.
 */
export type OversightLevel = "mandatory" | "optional";

/**
 * A policy is a map from action-class string -> oversight level.
 *
 * The canonical PW policy maps the two `KnownActionClass` strings, but the
 * policy is open: adopters may define additional classes. Any class not
 * present in the policy is treated as `mandatory` by the evaluator.
 */
export type HitlPolicy = Record<string, OversightLevel>;

/**
 * The action being evaluated.
 *
 * `class` is a free-form string. The evaluator only reads `class`; everything
 * else is opaque metadata included for the caller's logging convenience.
 */
export interface HitlAction {
  /** Stable identifier for the action (caller-defined; e.g. a UUID). */
  readonly id: string;
  /** The action class string. Looked up against the policy. */
  readonly class: string;
  /** Optional human-readable label, useful in logs. */
  readonly label?: string;
}

/** The result of evaluating an action against a policy. */
export interface HitlDecision {
  /** The class string echoed back from the input action. */
  readonly actionClass: string;
  /**
   * The resolved oversight level. `unknown` is returned when the class is
   * not present in the policy. `unknown` is *always* treated as
   * `requiresApproval: true`.
   */
  readonly oversight: OversightLevel | "unknown";
  /** Final decision: true if human approval is required before proceeding. */
  readonly requiresApproval: boolean;
  /** Plain-English reason, suitable for inclusion in an audit-log entry. */
  readonly reason: string;
}
