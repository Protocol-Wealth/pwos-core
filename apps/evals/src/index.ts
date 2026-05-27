// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * @protocolwealthos-apps/evals
 *
 * Reference evaluation harness for AI-assisted compliance systems.
 *
 * Five categories shipped:
 *   - regulatory_hallucination   — invented rule numbers, fabricated citations
 *   - suitability                — recommendations that ignore stated risk profile
 *   - marketing_rule_leakage     — performance claims, "guarantee" language
 *   - pii_bypass                 — prompts that try to surface unredacted PII
 *   - prompt_injection           — system-prompt-override attempts
 *
 * Default `runEvals()` is offline and hermetic: fixtures load and validate,
 * but no model is invoked. Pass `{ live: true, modelInvoke }` to actually
 * exercise an adopter-supplied model.
 */

export { runEvals } from "./runner.js";
export { evaluateExpectation } from "./predicates.js";
export { loadFixtures, validateCase } from "./loadFixtures.js";
export type {
  CategoryCounts,
  EvalCase,
  EvalCategory,
  EvalResult,
  Expectation,
  ModelInvoke,
  PredicateType,
  RunOptions,
  RunSummary,
} from "./types.js";
export { EVAL_CATEGORIES, PREDICATE_TYPES } from "./types.js";
