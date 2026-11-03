// SPDX-License-Identifier: MIT-0 OR Apache-2.0
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
  // Transcript predicates. They read a `Transcript` (see below) and can only
  // be scored by `scoreTranscript` / `runTranscriptEvals`; `runEvals` skips a
  // case that uses one, because a single string response cannot answer them.
  /** No tool call with this name (or any tool call, when `value` is "*"). */
  "must_not_call_tool",
  /** No tool call's JSON-serialized input contains this substring (case-insensitive). */
  "tool_input_must_not_contain",
  /**
   * Every URL in the replies has a host in this comma-separated allowlist
   * (subdomains included) or appears verbatim in `Transcript.sources`.
   */
  "urls_only_from",
  /** No outbound model-request body contains this substring (case-insensitive). */
  "outbound_must_not_contain",
  /** No outbound model-request body matches this regex. */
  "outbound_must_not_match",
  /**
   * `Transcript.fields[expectation.field]` equals `value` (numbers compare by
   * value, so "$250,000.00" equals "250000"). An absent or null field passes
   * only when `allow_absent` is true.
   */
  "field_must_equal",
] as const;

export type PredicateType = (typeof PREDICATE_TYPES)[number];

/** Predicate types that need a full `Transcript`, not just a response string. */
export const TRANSCRIPT_PREDICATE_TYPES: readonly PredicateType[] = [
  "must_not_call_tool",
  "tool_input_must_not_contain",
  "urls_only_from",
  "outbound_must_not_contain",
  "outbound_must_not_match",
  "field_must_equal",
];

/** A single expectation evaluated against a model response. */
export interface Expectation {
  readonly type: PredicateType;
  /** The substring or regex source. */
  readonly value: string;
  /** Operator-visible reason (shows up in failure output). */
  readonly comment: string;
  /** Optional adopter failure code reported when this expectation fails (e.g. "F1"). */
  readonly code?: string;
  /**
   * What an unmet expectation means. "fail" (the default) fails the case;
   * "review" marks it for a person to read. A review is never a pass.
   */
  readonly on_fail?: "fail" | "review";
  /** For `field_must_equal`: the key in `Transcript.fields`. */
  readonly field?: string;
  /** For `field_must_equal`: an absent or null field passes (e.g. routed to a person). */
  readonly allow_absent?: boolean;
}

/**
 * Untrusted data a harness hands the system under test alongside the prompt:
 * a document's text, a tool result, a retrieved note. The harness decides how
 * it reaches the model (as a tool result, an attachment, a stubbed upstream).
 */
export interface ContextBlock {
  /** Where the harness puts it, e.g. "tool:get_transactions" or "document". */
  readonly source: string;
  readonly content: string;
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
  /**
   * Follow-up user turns, sent in order after `prompt` (multi-turn cases such
   * as Crescendo-style escalation). Text predicates read every reply.
   */
  readonly turns?: readonly string[];
  /** Untrusted data blocks the harness feeds the system under test. */
  readonly context?: readonly ContextBlock[];
}

/** One tool call the system under test made. */
export interface ToolCallRecord {
  readonly name: string;
  readonly input: unknown;
  /** Zero-based user turn during which the call was made. */
  readonly turn?: number;
}

/**
 * Everything a harness observed while running one case. Leave a field
 * undefined when the harness did not observe it: a transcript predicate that
 * needs a missing field returns "review", never a pass.
 */
export interface Transcript {
  /** The assistant's reply to each user turn, in order. */
  readonly replies: readonly string[];
  readonly toolCalls?: readonly ToolCallRecord[];
  /** Every request body sent to the model provider, serialized. */
  readonly outbound?: readonly string[];
  /** Text the model was legitimately given (tool results, documents). */
  readonly sources?: readonly string[];
  /** Structured values the system produced (e.g. an extracted balance). */
  readonly fields?: Readonly<Record<string, string | number | null | undefined>>;
}

/** The four outcomes of a scored case. Only "pass" is clean. */
export type Verdict = "pass" | "fail" | "review" | "not_run";

/** One unmet (or undecidable) expectation. */
export interface Finding {
  readonly type: PredicateType;
  readonly code?: string;
  readonly comment: string;
  /** True when the predicate could not decide (the transcript lacked what it reads). */
  readonly undecided?: boolean;
}

/** The scored outcome of one case. */
export interface CaseScore {
  readonly caseId: string;
  readonly verdict: Verdict;
  readonly failures: readonly Finding[];
  readonly reviews: readonly Finding[];
  /** Why a case did not run (`verdict === "not_run"`). */
  readonly notRunReason?: string;
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
      readonly reason:
        | "offline_mode"
        | "category_filter"
        | "no_model_supplied"
        | "needs_transcript_runner";
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
  /** True iff every selected category has a passing case and no failures (live mode only). */
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
