// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * Layer 4: Allow-list — terms and patterns that should NEVER be redacted.
 *
 * Regex patterns catch things like "$1M" or "5.25%" that would otherwise
 * match financial-identifier rules. The term set holds well-known acronyms
 * (401K, CUSIP, FICO) that, if redacted, would produce gibberish for the
 * downstream LLM.
 *
 * This is the default starter list — extend via `appendAllowTerms` /
 * `appendAllowPatterns` before running the scanner in production.
 */

/** Default regex patterns for content that should not be redacted. */
export const DEFAULT_ALLOW_PATTERNS: RegExp[] = [
  // Dollar amounts
  /^\$[\d,]+(?:\.\d{1,2})?[kKmMbB]?$/,
  // Formatted numbers with commas (e.g., 1,000,000)
  /^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/,
  // Percentages
  /^\d+\.?\d*\s*%$/,
  // Common tax bracket percentages
  /^(?:10|12|22|24|32|35|37)\s*%$/,
  // Basis points
  /^\d+\s*(?:bps?|basis\s+points?)$/i,
  // Years 2020-2099
  /^20[2-9]\d$/,
  // Ages
  /^age\s+\d{1,3}$/i,
  // IRS forms / schedules / IRC sections
  /^(?:Form|Schedule|IRC\s*§?)\s*[A-Z0-9§.-]+$/i,
];

/**
 * Default allow-list of well-known financial acronyms. Entries are
 * case-insensitive (matched after .toUpperCase()). Compound terms are
 * stored uppercase with a single space between words.
 */
export const DEFAULT_ALLOW_TERMS: readonly string[] = [
  // Tax/retirement
  "AGI", "MAGI", "QBI", "RMD", "QCD", "NUA", "IRA", "SEP", "SIMPLE",
  "401K", "403B", "457B", "529", "HSA", "FSA", "W2", "W-2", "1099",
  "1040", "1041", "1065", "1120", "990", "8606", "8275",

  // Investment
  "FICO", "CUSIP", "ISIN", "ETF", "NAV", "AUM", "EBITDA",
  "EPS", "ROI", "ROE", "CROIC", "ROIC", "FCF", "DCF",

  // Mortgage / RE
  "LTV", "DTI", "PMI", "PITI", "MIP", "UFMIP", "ARM", "FRM",
  "HELOC", "HEL", "TILA", "RESPA", "ECOA", "HMDA", "TRID",
  "URLA", "QM", "ATR", "DU", "LP", "AUS", "GFE", "LE", "CD",
  "HUD", "ALTA", "CLTA", "CPL", "FNMA", "FHLMC", "GNMA",
  "VOE", "VOD", "VOM", "VOR", "APR", "MERS", "MLS", "HOA",

  // Crypto / DeFi
  "TVL", "APY", "DEX", "CEX", "AMM", "IL",

  // Macro / general
  "DXY", "VIX", "FRED",

  // Multi-word (stored uppercase, single-spaced)
  "FANNIE MAE", "FREDDIE MAC", "GINNIE MAE",
];

/**
 * Allow-list instance that callers can extend at runtime.
 *
 * Typical use::
 *
 *     const guard = new AllowList();
 *     guard.appendTerms(['MY_FIRM_ACRONYM']);
 *     guard.appendPatterns([/^internal-\d+$/]);
 *     if (!guard.isAllowed(entity.text)) { ... }
 */
export class AllowList {
  private readonly terms: Set<string>;
  private readonly patterns: RegExp[];

  constructor(opts?: { terms?: Iterable<string>; patterns?: Iterable<RegExp> }) {
    this.terms = new Set(
      [...(opts?.terms ?? DEFAULT_ALLOW_TERMS)].map((t) => t.toUpperCase()),
    );
    this.patterns = [...(opts?.patterns ?? DEFAULT_ALLOW_PATTERNS)];
  }

  appendTerms(terms: Iterable<string>): void {
    for (const t of terms) this.terms.add(t.toUpperCase());
  }

  appendPatterns(patterns: Iterable<RegExp>): void {
    for (const p of patterns) this.patterns.push(p);
  }

  /** Returns true if the input should NOT be redacted. */
  isAllowed(text: string): boolean {
    const trimmed = text.trim();
    if (this.terms.has(trimmed.toUpperCase())) return true;
    return this.patterns.some((p) => p.test(trimmed));
  }
}

/** Default singleton for quick usage without constructing a custom list. */
const DEFAULT_ALLOW_LIST = new AllowList();

/** Convenience function using the default allow-list. */
export function isAllowed(text: string): boolean {
  return DEFAULT_ALLOW_LIST.isAllowed(text);
}
