// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * Layer 3: Context-aware financial recognizers.
 *
 * Some identifiers have weak base patterns but become high-confidence PII
 * when surrounding words provide the right context — e.g. a 9-character
 * alphanumeric is a poor standalone signal, but "CUSIP: ABC123XY4" clearly
 * is. These recognizers score lower than Layer 1 regex but get a score
 * boost when relevant context words appear near (or anywhere in) the text.
 */

import type { DetectedEntity } from "./regexPatterns.js";

interface FinancialPattern {
  name: string;
  regex: RegExp;
  score: number;
  contextWords: string[];
}

const FINANCIAL_PATTERNS: FinancialPattern[] = [
  {
    name: "CUSIP",
    regex: /\b[A-Z0-9]{6}[A-Z0-9]{2}[0-9]\b/g,
    score: 0.6,
    contextWords: ["cusip", "security", "holding", "fund", "isin", "ticker", "bond"],
  },
  {
    name: "ACCOUNT_REF_ENDING",
    regex: /(?:account|acct)\s+ending\s+in\s+(\d{4,})/gi,
    score: 0.8,
    contextWords: [],
  },
  {
    name: "POLICY_NUMBER",
    regex: /(?:policy|plan|contract)[\s#:]*([A-Z0-9]{6,20})/gi,
    score: 0.6,
    contextWords: ["policy", "plan", "contract", "insurance", "annuity"],
  },
];

/** Callers can tell the scanner what kind of document they're dealing with. */
export type DocumentContext =
  | "general"
  | "meeting_transcript"
  | "tax_return"
  | "financial_notes"
  | "mortgage"
  | "real_estate";

function hasContext(text: string, contextWords: string[]): boolean {
  if (contextWords.length === 0) return true;
  const lower = text.toLowerCase();
  return contextWords.some((word) => lower.includes(word));
}

/**
 * Detect context-aware financial entities. Score is boosted by 0.25 when
 * context words are present. Matches under 0.5 are dropped.
 */
export function detectFinancial(
  input: string,
  context: DocumentContext = "general",
): DetectedEntity[] {
  const entities: DetectedEntity[] = [];
  // `context` is accepted for API compatibility; individual patterns can
  // read it via contextWords. It's reserved for future context-specific
  // tuning (e.g., tax returns have different base scores than notes).
  void context;

  for (const pattern of FINANCIAL_PATTERNS) {
    const scoreBoost = hasContext(input, pattern.contextWords) ? 0.25 : 0;
    const effectiveScore = Math.min(pattern.score + scoreBoost, 1.0);
    if (effectiveScore < 0.5) continue;

    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(input)) !== null) {
      const text = match[1] || match[0];
      const start = match[1] ? match.index + match[0].indexOf(match[1]) : match.index;

      entities.push({
        entityType: pattern.name,
        text,
        start,
        end: start + text.length,
        score: effectiveScore,
        source: "financial",
      });
    }
  }

  return entities;
}
