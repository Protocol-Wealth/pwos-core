// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Pure, fail-closed HITL gate evaluator.
 *
 * The single rule the evaluator enforces:
 *
 *   if the action's class is NOT a key of the policy,
 *   the decision is `requiresApproval: true`.
 *
 * That is the load-bearing invariant: an unknown action class can never
 * proceed unattended. New action classes must be added to the policy
 * explicitly before they can be `optional`.
 */

import type { HitlAction, HitlDecision, HitlPolicy } from "./types.js";

/**
 * Evaluate an action against a policy. Pure — same inputs always produce the
 * same output. No I/O, no clocks, no globals.
 *
 * Decision logic:
 *
 *   policy[action.class] === "mandatory" -> requiresApproval: true,  oversight: "mandatory"
 *   policy[action.class] === "optional"  -> requiresApproval: false, oversight: "optional"
 *   action.class not in policy           -> requiresApproval: true,  oversight: "unknown"
 *
 * The third case is the fail-closed branch.
 */
export function evaluateHitl(action: HitlAction, policy: HitlPolicy): HitlDecision {
  const oversight = policy[action.class];

  if (oversight === undefined) {
    return {
      actionClass: action.class,
      oversight: "unknown",
      requiresApproval: true,
      reason: `Action class "${action.class}" is not present in the HITL policy; gate fails closed (approval required).`,
    };
  }

  if (oversight === "mandatory") {
    return {
      actionClass: action.class,
      oversight: "mandatory",
      requiresApproval: true,
      reason: `Action class "${action.class}" is marked mandatory in the HITL policy; human approval required.`,
    };
  }

  return {
    actionClass: action.class,
    oversight: "optional",
    requiresApproval: false,
    reason: `Action class "${action.class}" is marked optional in the HITL policy; action may proceed without explicit approval (logging recommended).`,
  };
}
