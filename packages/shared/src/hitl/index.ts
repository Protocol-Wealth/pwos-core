// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * @protocolwealthos/shared/hitl
 *
 * Human-in-the-loop (HITL) gate primitives.
 *
 * Two-class default policy:
 *   - client_facing_deliverable -> mandatory
 *   - internal_research         -> optional
 *
 * Pure, fail-closed evaluator. Adopters can extend the policy with additional
 * classes; any class not present in the policy is gated by mandatory approval.
 *
 * Wiring this into a production tool orchestrator is OUT OF SCOPE for this
 * package — see HANDOFF.md at the repo root for the wiring contract the
 * private-estate consumer is expected to honor.
 */

export {
  DEFAULT_POLICY,
  hitlActionSchema,
  hitlPolicySchema,
  oversightLevelSchema,
  parseHitlPolicy,
  resolveHitlPolicy,
} from "./schema.js";

export { evaluateHitl } from "./evaluator.js";

export type {
  HitlAction,
  HitlDecision,
  HitlPolicy,
  KnownActionClass,
  OversightLevel,
} from "./types.js";

export { KNOWN_ACTION_CLASSES } from "./types.js";
