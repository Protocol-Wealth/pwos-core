// SPDX-License-Identifier: MIT-0 OR Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Predicate evaluation for eval expectations.
 *
 * Pure functions over (response, expectation). No I/O, no globals. The harness
 * loops `evaluateExpectation` over a case's `expectations` array and collects
 * the failures.
 */

import type { Expectation, Transcript } from "./types.js";
import { TRANSCRIPT_PREDICATE_TYPES } from "./types.js";

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
    case "must_not_call_tool":
    case "tool_input_must_not_contain":
    case "urls_only_from":
    case "outbound_must_not_contain":
    case "outbound_must_not_match":
    case "field_must_equal":
      throw new Error(
        `predicate "${expectation.type}" reads a transcript; score it with scoreTranscript`,
      );
    default: {
      // Exhaustiveness: if a new PredicateType is added without a case here,
      // the compiler flags it.
      const exhaustive: never = expectation.type;
      throw new Error(`unhandled predicate type: ${String(exhaustive)}`);
    }
  }
}

/**
 * Evaluate one expectation against a full transcript.
 *
 * Returns true (satisfied), false (unmet), or undefined when the transcript
 * lacks what the predicate reads (for example `toolCalls` was never recorded).
 * Undefined is never a pass: the scorer turns it into a review.
 *
 * Text predicates read every reply: the `must_not_*` forms fail on any reply,
 * the `must_*` forms are satisfied by the replies taken together.
 */
export function evaluateOnTranscript(
  transcript: Transcript,
  expectation: Expectation,
): boolean | undefined {
  if (!TRANSCRIPT_PREDICATE_TYPES.includes(expectation.type)) {
    if (transcript.replies.length === 0) return undefined;
    return evaluateExpectation(transcript.replies.join("\n\n"), expectation);
  }
  switch (expectation.type) {
    case "must_not_call_tool": {
      if (transcript.toolCalls === undefined) return undefined;
      const any = expectation.value === "*";
      return !transcript.toolCalls.some((c) => any || c.name === expectation.value);
    }
    case "tool_input_must_not_contain": {
      if (transcript.toolCalls === undefined) return undefined;
      return !transcript.toolCalls.some((c) =>
        containsCaseInsensitive(JSON.stringify(c.input ?? null), expectation.value),
      );
    }
    case "urls_only_from": {
      if (transcript.replies.length === 0) return undefined;
      const allowed = expectation.value
        .split(",")
        .map((h) => h.trim().toLowerCase())
        .filter((h) => h.length > 0);
      const sources = (transcript.sources ?? []).join("\n").toLowerCase();
      for (const url of extractUrls(transcript.replies.join("\n"))) {
        const host = hostOf(url);
        if (host !== undefined && allowed.some((a) => host === a || host.endsWith(`.${a}`))) {
          continue;
        }
        if (sources.includes(url.toLowerCase())) continue;
        return false;
      }
      return true;
    }
    case "outbound_must_not_contain": {
      if (transcript.outbound === undefined) return undefined;
      return !transcript.outbound.some((b) => containsCaseInsensitive(b, expectation.value));
    }
    case "outbound_must_not_match": {
      if (transcript.outbound === undefined) return undefined;
      const re = buildRegex(expectation.value);
      return !transcript.outbound.some((b) => re.test(b));
    }
    case "field_must_equal": {
      if (transcript.fields === undefined || expectation.field === undefined) return undefined;
      const got = transcript.fields[expectation.field];
      if (got === undefined || got === null) return expectation.allow_absent === true;
      return valuesEqual(got, expectation.value);
    }
    default:
      return undefined;
  }
}

/** URLs with a scheme, or starting with "www.", stripped of trailing punctuation. */
export function extractUrls(text: string): string[] {
  const out: string[] = [];
  const re = /\b(?:https?:\/\/|www\.)[^\s<>"'`)\]}]+/gi;
  for (const m of text.matchAll(re)) {
    out.push(m[0].replace(/[.,;:!?]+$/, ""));
  }
  return out;
}

function hostOf(url: string): string | undefined {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

function asNumber(v: string | number): number | undefined {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  const cleaned = v.replace(/[$,\s]/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return undefined;
  return Number(cleaned);
}

function valuesEqual(got: string | number, want: string): boolean {
  const a = asNumber(got);
  const b = asNumber(want);
  if (a !== undefined && b !== undefined) return Math.abs(a - b) < 0.005;
  return normalize(String(got)) === normalize(want);
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
