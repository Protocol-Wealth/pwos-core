// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Eval-harness types.
 *
 * Five categories cover the load-bearing concerns the PW compliance posture
 * has to gate against. Each fixture lives as a JSON file under
 * `fixtures/<category>/` and is validated against `EvalCase` at load time.
 *
 * Predicates intentionally use plain string matching (substring or regex).
 * The harness is the substrate that lets you tell when the answer is wrong;
 * it does NOT decide what "right" means — adopters supply the predicates by
 * authoring fixtures.
 */

/** The five eval categories shipped in this harness. */
export const EVAL_CATEGORIES = [
  "regulatory_hallucination",
  "suitability",
  "marketing_rule_leakage",
  "pii_bypass",
  "prompt_injection",
] as const;

export type EvalCategory = (typeof EVAL_CATEGORIES)[number];

/** Predicate types a fixture can express against a model response. */
export const PREDICATE_TYPES = [
  /** Response must NOT contain this substring (case-insensitive). */
  "must_not_contain",
  /** Response MUST contain this substring (case-insensitive). */
  "must_contain",
  /** Response must NOT match this regex (use `^pattern$` for full-string match). */
  "must_not_match",
  /** Response MUST match this regex. */
  "must_match",
  /** Response, normalized (trim + lowercase), must equal this value. */
  "exact_match_normalized",
] as const;

export type PredicateType = (typeof PREDICATE_TYPES)[number];

/** A single expectation evaluated against a model response. */
export interface Expectation {
  readonly type: PredicateType;
  /** The substring or regex source. */
  readonly value: string;
  /** Operator-visible reason (shows up in failure output). */
  readonly comment: string;
}

/** A single eval case — a JSON fixture file deserializes to this shape. */
export interface EvalCase {
  /** Stable unique identifier across the whole harness. */
  readonly id: string;
  /** Which category the case belongs to. Must match the fixture's directory. */
  readonly category: EvalCategory;
  /** Free-text description; what this case probes. */
  readonly description: string;
  /** The prompt the harness would send to a model. */
  readonly prompt: string;
  /** Optional system message the harness would prepend. */
  readonly system?: string;
  /** Expectations the response must satisfy (AND across the array). */
  readonly expectations: readonly Expectation[];
  /** Optional tags for filtering / reporting. */
  readonly tags?: readonly string[];
}

/** Per-category counts in a run summary. */
export interface CategoryCounts {
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
}

/**
 * Result emitted for a single case.
 *
 * `skipped` is what you get in offline mode: the case loaded and validated
 * cleanly but no model was called, so no pass/fail decision was rendered.
 */
export type EvalResult =
  | {
      readonly caseId: string;
      readonly category: EvalCategory;
      readonly status: "skipped";
      readonly reason: "offline_mode" | "category_filter" | "no_model_supplied";
    }
  | {
      readonly caseId: string;
      readonly category: EvalCategory;
      readonly status: "passed";
      readonly response: string;
    }
  | {
      readonly caseId: string;
      readonly category: EvalCategory;
      readonly status: "failed";
      readonly response: string;
      readonly failed: readonly Expectation[];
    };

/** Aggregate of an entire run. */
export interface RunSummary {
  readonly total: number;
  readonly byCategory: Readonly<Record<EvalCategory, CategoryCounts>>;
  readonly results: readonly EvalResult[];
  /** True iff every category has at least one passing case (live mode only). */
  readonly allCategoriesPassing: boolean;
  /** True iff the run was offline (no model called). */
  readonly offline: boolean;
}

/** Adopter-supplied model invocation. Receives the prompt + optional system. */
export type ModelInvoke = (input: {
  prompt: string;
  system?: string;
}) => Promise<string>;

/** Options for `runEvals`. */
export interface RunOptions {
  /** Absolute or relative path to the fixtures root. Defaults to the bundled `fixtures/`. */
  readonly fixturesDir?: string;
  /**
   * When true, actually call `modelInvoke` and render pass/fail decisions.
   * When false (default), the run is deterministic and hermetic: every case
   * is `skipped: offline_mode`.
   */
  readonly live?: boolean;
  /** Adopter's model invocation. Required when `live: true`. */
  readonly modelInvoke?: ModelInvoke;
  /** Restrict the run to these categories (default: all). */
  readonly categories?: readonly EvalCategory[];
  /** Restrict the run to specific case ids. */
  readonly caseIds?: readonly string[];
}
