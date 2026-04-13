// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * @protocolwealthos/pii-guard
 *
 * 4-layer PII scanning pipeline for LLM-bound content. Defensive patent:
 * USPTO #64/034,215.
 *
 * Layers:
 *   1. Regex — deterministic patterns for credentials, financial
 *      identifiers, personal info, mortgage/RE IDs, platform IDs.
 *   2. NER — optional provider hook (local models, hosted, cloud).
 *   3. Financial recognizers — context-aware CUSIP, account refs, policies.
 *   4. Allow-list — well-known acronyms & patterns that must not redact.
 *
 * Quick start::
 *
 *     import { scan, rehydrate } from "@protocolwealthos/pii-guard";
 *
 *     const result = await scan("Account #12345678 for John Doe");
 *     // result.sanitizedText: "Account #<ACCOUNT_NUMBER_1> for <EMAIL_1>"
 *
 *     const original = rehydrate(result.sanitizedText, result.manifest);
 */

export const VERSION = "0.1.0";

export {
  AllowList,
  DEFAULT_ALLOW_PATTERNS,
  DEFAULT_ALLOW_TERMS,
  isAllowed,
} from "./allowList.js";

export {
  detectFinancial,
  type DocumentContext,
} from "./financialRecognizers.js";

export {
  DEFAULT_INJECTION_THRESHOLD,
  detectInjection,
  type DetectInjectionOptions,
  type InjectionDetection,
  type InjectionResult,
} from "./injectionDetector.js";

export {
  validateInput,
  type ValidationOptions,
  type ValidationResult,
} from "./inputValidator.js";

export {
  LAYER1_PATTERNS,
  detectRegex,
  type DetectedEntity,
  type PatternDef,
} from "./regexPatterns.js";

export {
  rehydrate,
  scan,
  type NerDetector,
  type PlaceholderEntry,
  type RedactionManifest,
  type ScanOptions,
  type ScanResult,
} from "./scanner.js";
