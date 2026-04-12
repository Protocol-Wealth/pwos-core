// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * Layer 1: Deterministic regex patterns for PII detection.
 *
 * Patterns cover common categories seen in financial-services content:
 * credentials/tokens, cryptocurrency, tax/financial identifiers, personal
 * information, mortgage/RE identifiers, and platform/CRM IDs. All patterns
 * use capture groups where appropriate so the caller can redact just the
 * sensitive portion (e.g. the token value, not the `Bearer ` prefix).
 *
 * Scores (0-1) indicate redaction priority when entities overlap — higher
 * scores win merges. Calibrate against your own false-positive rate.
 */

export interface PatternDef {
  name: string;
  regex: RegExp;
  score: number;
  /** 0 = full match, 1+ = capture group */
  group: number;
}

export const LAYER1_PATTERNS: PatternDef[] = [
  // ─── Credentials & Tokens ───
  { name: "JWT", regex: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, score: 1.0, group: 0 },
  {
    name: "DB_URL",
    regex: /(?:postgres|mysql|mongodb|redis):\/\/[^:\s]+:[^@\s]+@[^\s]*/g,
    score: 0.95,
    group: 0,
  },
  {
    name: "BEARER_TOKEN",
    regex: /Bearer\s+([A-Za-z0-9._-]{20,})/g,
    score: 0.9,
    group: 1,
  },
  {
    name: "API_KEY",
    regex: /(?:api[_-]?key|apikey)\s*[=:]\s*["']?([A-Za-z0-9._-]{10,})["']?/gi,
    score: 0.85,
    group: 1,
  },
  {
    name: "PASSWORD",
    regex: /(?:password|passwd)\s*[=:]\s*["']?([^"'\s,}]{3,})["']?/gi,
    score: 0.9,
    group: 1,
  },
  {
    name: "SECRET_VALUE",
    regex:
      /(?:client_secret|secret_access_key|secret_key|secret|private_key|credential)\s*[=:]\s*["']?([A-Za-z0-9._+/=-]{10,})["']?/gi,
    score: 0.85,
    group: 1,
  },
  {
    name: "AUTH_TOKEN",
    regex:
      /(?:access_token|refresh_token|id_token|session_id|csrf_token)\s*[=:]\s*["']?([A-Za-z0-9._-]{20,})["']?/gi,
    score: 0.85,
    group: 1,
  },

  // ─── Crypto ───
  { name: "CRYPTO_PRIVATE_KEY", regex: /\b0x[a-fA-F0-9]{64}\b/g, score: 0.95, group: 0 },
  { name: "CRYPTO_ADDRESS", regex: /\b0x[a-fA-F0-9]{40}\b/g, score: 0.85, group: 0 },
  {
    name: "CRYPTO_SEED",
    regex: /(?:seed\s*phrase|mnemonic|recovery\s*(?:phrase|words?))[:\s=]*["'](.+?)["']/gi,
    score: 0.95,
    group: 1,
  },

  // ─── Financial Identifiers ───
  { name: "CREDIT_CARD", regex: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, score: 0.95, group: 0 },
  { name: "US_SSN", regex: /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/g, score: 0.9, group: 0 },
  { name: "EIN", regex: /\b\d{2}-\d{7}\b/g, score: 0.8, group: 0 },
  {
    name: "ACCOUNT_NUMBER",
    regex: /(?:account|acct?)\.?\s*(?:#|no\.?|number)?:?\s*(\d{6,17})\b/gi,
    score: 0.85,
    group: 1,
  },
  {
    name: "US_ROUTING",
    regex: /(?:routing|aba|transit)\s*(?:(?:#|no\.?|number)\s*)?:?\s*([0-3]\d{8})\b/gi,
    score: 0.8,
    group: 1,
  },

  // ─── Personal Info ───
  { name: "EMAIL", regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, score: 0.95, group: 0 },
  {
    name: "DATE_OF_BIRTH",
    regex:
      /(?:DOB|born|birthday|birth.?date|date.?of.?birth)[:\s=]*(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/gi,
    score: 0.85,
    group: 1,
  },
  { name: "US_PHONE", regex: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, score: 0.8, group: 0 },
  {
    name: "DRIVERS_LICENSE",
    regex: /(?:driver'?s?\s*(?:license|lic\.?)|DL)\s*(?:[#:]\s*)?([A-Za-z]\d{7,14})\b/gi,
    score: 0.75,
    group: 1,
  },
  {
    name: "STREET_ADDRESS",
    regex:
      /\b\d{1,5}\s+(?:[A-Za-z]+\s+){1,3}(?:St|Street|Ave|Avenue|Blvd|Boulevard|Dr|Drive|Ln|Lane|Rd|Road|Ct|Court|Way|Pl|Place|Cir|Circle)\.?\b(?:\s+(?:#|Ste|Suite|Apt|Unit)\s+\w+)?/gi,
    score: 0.7,
    group: 0,
  },

  // ─── Mortgage & RE ───
  {
    name: "NMLS_ID",
    regex: /(?:NMLS|MLO)\s*(?:(?:#|no\.?|number|id)\s*)?(?:[#:=]\s*)?(\d{5,12})\b/gi,
    score: 0.8,
    group: 1,
  },
  {
    name: "LOAN_NUMBER",
    regex: /(?:loan|mortgage|note)\s*(?:(?:#|no\.?|number|id)\s*)?(?:[#:=]\s*)?([A-Z0-9][-A-Z0-9]{7,19})\b/gi,
    score: 0.8,
    group: 1,
  },
  { name: "MERS_MIN", regex: /(?:MERS|MIN)\s*(?:[#:=]\s*)?(\d{18})\b/gi, score: 0.85, group: 1 },
  {
    name: "FHA_CASE_NUMBER",
    regex: /(?:FHA|VA|USDA)\s*(?:case)?\s*(?:[#:=]\s*)?(\d{3}-\d{7}(?:-\d{3})?)\b/gi,
    score: 0.85,
    group: 1,
  },
  {
    name: "PARCEL_NUMBER",
    regex:
      /(?:APN|parcel|tax\s+(?:parcel|id|lot)|property\s+(?:index|id|PIN)|assessor)\s+(?:(?:#|no\.?|number)\s+)?(?:[#:=]\s+)?([A-Z0-9][-A-Z0-9./]{4,24})\b/gi,
    score: 0.8,
    group: 1,
  },
  {
    name: "MLS_NUMBER",
    regex: /(?:MLS|listing)\s*(?:(?:#|no\.?|number|id)\s*)?(?:[#:=]\s*)?([A-Z0-9]{6,15})\b/gi,
    score: 0.75,
    group: 1,
  },
  {
    name: "FILE_REFERENCE",
    regex:
      /(?:escrow|title|closing|instrument|recording|document)\s*(?:(?:#|no\.?|number)\s*)?(?:[#:=]\s*)?([A-Z0-9][-A-Z0-9]{5,19})\b/gi,
    score: 0.75,
    group: 1,
  },

  // ─── Platform & CRM IDs ───
  {
    name: "CRM_ID",
    regex:
      /(?:crm|contact[_\s]?id|client[_\s]?id|customer[_\s]?id|lead[_\s]?id|record[_\s]?id|advisor[_\s]?id)\s*(?:[#:=]\s*)?(\d{4,10})\b/gi,
    score: 0.85,
    group: 1,
  },
  {
    name: "PLATFORM_ID",
    regex:
      /(?:org[_\s]?id|sub[_\s]?org|tenant[_\s]?id|workspace[_\s]?id|vault[_\s]?id|signer[_\s]?id|key[_\s]?id|wallet[_\s]?id)\s*(?:[#:=]\s*)?([a-f0-9][a-f0-9-]{19,})\b/gi,
    score: 0.75,
    group: 1,
  },
];

export interface DetectedEntity {
  entityType: string;
  text: string;
  start: number;
  end: number;
  score: number;
  source: "regex" | "ner" | "financial";
}

/**
 * Run all Layer 1 patterns against input text and return matched entities.
 * Iterates each pattern independently — overlapping matches are resolved
 * later by the scanner's merge step.
 */
export function detectRegex(input: string): DetectedEntity[] {
  const entities: DetectedEntity[] = [];

  for (const pattern of LAYER1_PATTERNS) {
    // Clone the regex so global-state `.lastIndex` doesn't leak across calls.
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(input)) !== null) {
      const text = pattern.group > 0 && match[pattern.group] ? match[pattern.group] : match[0];
      const start =
        pattern.group > 0 && match[pattern.group]
          ? match.index + match[0].indexOf(match[pattern.group])
          : match.index;

      entities.push({
        entityType: pattern.name,
        text,
        start,
        end: start + text.length,
        score: pattern.score,
        source: "regex",
      });
    }
  }

  return entities;
}
