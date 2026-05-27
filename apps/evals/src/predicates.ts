// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Predicate evaluation for eval expectations.
 *
 * Pure functions over (response, expectation). No I/O, no globals. The harness
 * loops `evaluateExpectation` over a case's `expectations` array and collects
 * the failures.
 */

import type { Expectation } from "./types.js";

/**
 * Evaluate one expectation against a response. Returns true when the
 * expectation is satisfied; false when it fails.
 */
export function evaluateExpectation(response: string, expectation: Expectation): boolean {
  switch (expectation.type) {
    case "must_not_contain":
      return !containsCaseInsensitive(response, expectation.value);
    case "must_contain":
      return containsCaseInsensitive(response, expectation.value);
    case "must_not_match":
      return !buildRegex(expectation.value).test(response);
    case "must_match":
      return buildRegex(expectation.value).test(response);
    case "exact_match_normalized":
      return normalize(response) === normalize(expectation.value);
    default: {
      // Exhaustiveness: if a new PredicateType is added without a case here,
      // the compiler flags it.
      const exhaustive: never = expectation.type;
      throw new Error(`unhandled predicate type: ${String(exhaustive)}`);
    }
  }
}

function containsCaseInsensitive(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function buildRegex(source: string): RegExp {
  // Adopters supply the regex source. Allow common flags via the standard
  // `/pattern/flags` form, otherwise default to case-insensitive.
  const m = /^\/(.+)\/([dgimsuy]*)$/.exec(source);
  if (m) {
    return new RegExp(m[1]!, m[2]);
  }
  return new RegExp(source, "i");
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}
