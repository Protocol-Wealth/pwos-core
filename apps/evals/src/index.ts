// SPDX-License-Identifier: MIT-0 OR Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * @protocolwealthos/evals
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
 *
 * Attack tests that need more than one string response (multi-turn cases,
 * untrusted context blocks, tool calls, outbound request bodies, stored
 * values) record a `Transcript` and score it with `scoreTranscript` or
 * `runTranscriptEvals`. Run `runScorerSelfTest()` first: it fails canned bad
 * answers, and a run must stop if any of them scores as a pass.
 */

export { runEvals } from "./runner.js";
export { evaluateExpectation, evaluateOnTranscript, extractUrls } from "./predicates.js";
export {
  countVerdicts,
  needsTranscript,
  notRun,
  runTranscriptEvals,
  scoreTranscript,
} from "./score.js";
export type {
  Scorable,
  TranscriptInvoke,
  TranscriptOutcome,
  VerdictCounts,
} from "./score.js";
export { runScorerSelfTest, SELF_TEST_CASES } from "./selfTest.js";
export type { SelfTestCase, SelfTestReport, SelfTestResult } from "./selfTest.js";
export { loadFixtures, validateCase } from "./loadFixtures.js";
export { createHttpChatCompletionsInvoke } from "./httpChatCompletions.js";
export type { HttpChatCompletionsOptions } from "./httpChatCompletions.js";
export type {
  CaseScore,
  CategoryCounts,
  ContextBlock,
  Finding,
  ToolCallRecord,
  Transcript,
  Verdict,
  EvalCase,
  EvalCategory,
  EvalResult,
  Expectation,
  ModelInvoke,
  PredicateType,
  RunOptions,
  RunSummary,
} from "./types.js";
export { EVAL_CATEGORIES, PREDICATE_TYPES, TRANSCRIPT_PREDICATE_TYPES } from "./types.js";
