// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Zod schemas for the HITL gate.
 *
 * The policy schema accepts any string key (so adopters can add classes), but
 * `safeParse` enforces the value of every key to be a valid `OversightLevel`.
 * The action schema is intentionally minimal — `class` is a free-form string,
 * not an enum, so the evaluator's fail-closed handling kicks in on unknown
 * classes rather than failing at parse time.
 */

import { z } from "zod";

import type { HitlAction, HitlPolicy, OversightLevel } from "./types.js";

export const oversightLevelSchema = z.enum(["mandatory", "optional"]);

/**
 * The policy is a record of string -> oversight level. Zod's `z.record` with
 * a single value schema enforces every value but allows any key string.
 *
 * The default PW policy is exported as `DEFAULT_POLICY` alongside.
 */
export const hitlPolicySchema: z.ZodType<HitlPolicy> = z.record(
  z.string().min(1),
  oversightLevelSchema,
);

export const hitlActionSchema: z.ZodType<HitlAction> = z.object({
  id: z.string().min(1),
  class: z.string().min(1),
  label: z.string().optional(),
});

/**
 * Canonical default policy.
 *
 * Adopters may extend the policy by adding more keys, or override these two
 * via `{ ...DEFAULT_POLICY, my_class: "mandatory" }`.
 */
export const DEFAULT_POLICY: HitlPolicy = {
  client_facing_deliverable: "mandatory",
  internal_research: "optional",
};

/**
 * Parse a value as a policy, returning the typed result or throwing
 * `ZodError`. Use `hitlPolicySchema.safeParse` when you'd prefer to handle
 * the validation result yourself.
 */
export function parseHitlPolicy(input: unknown): HitlPolicy {
  return hitlPolicySchema.parse(input);
}

/**
 * Resolve a policy from input, falling back to `DEFAULT_POLICY` when no input
 * is supplied. Throws on any input that does not validate.
 */
export function resolveHitlPolicy(input?: unknown): HitlPolicy {
  if (input === undefined || input === null) return DEFAULT_POLICY;
  return parseHitlPolicy(input);
}

export type { OversightLevel };
