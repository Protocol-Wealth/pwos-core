// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * Tool tier utilities.
 *
 * The four-tier access model (PUBLIC / ADVISOR / CLIENT_FILTERED /
 * SENSITIVE) mirrors the pattern used by the PW MCP OAuth server. The
 * bare enum is defined in ``types.ts``; this module carries the ordering
 * and authorization helpers.
 */

import { ToolTier } from "./types.js";

/** Tier hierarchy, from least to most privileged. */
const TIER_ORDER: ToolTier[] = [
  ToolTier.PUBLIC,
  ToolTier.ADVISOR,
  ToolTier.CLIENT_FILTERED,
  ToolTier.SENSITIVE,
];

/** Numeric rank for a tier — higher = more privileged. */
export function tierRank(tier: ToolTier): number {
  return TIER_ORDER.indexOf(tier);
}

/**
 * Does ``grantedTier`` authorize invoking a tool classified at ``requiredTier``?
 *
 * SENSITIVE > CLIENT_FILTERED > ADVISOR > PUBLIC. Granting a higher tier
 * implicitly covers all lower tiers.
 */
export function isAuthorizedFor(grantedTier: ToolTier, requiredTier: ToolTier): boolean {
  return tierRank(grantedTier) >= tierRank(requiredTier);
}

/** Filter a tool list down to tools the given tier is authorized to invoke. */
export function tierFilter<T extends { tier?: ToolTier }>(
  tools: readonly T[],
  grantedTier: ToolTier,
): T[] {
  return tools.filter((t) => isAuthorizedFor(grantedTier, t.tier ?? ToolTier.PUBLIC));
}
