// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * PII patterns refused inside cache keys.
 *
 * Why: a cache key like `client:user@example.com:profile` puts an email
 * address into Redis with whatever retention the cache is configured
 * for — independent of, and usually less strict than, the database
 * retention policy. Worse, cache eviction logs and metrics labels often
 * carry the key verbatim into observability stores, multiplying the
 * surface area.
 *
 * Refuse the keys at *write time* and force callers to hash or tokenize
 * the identifying portion. The patterns below are the deliberately
 * boring set: shapes any RIA's compliance officer would recognize.
 */

export interface PiiPattern {
  name: string;
  regex: RegExp;
  description: string;
}

export const DEFAULT_PII_PATTERNS: readonly PiiPattern[] = Object.freeze([
  {
    name: "email",
    regex: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
    description: "RFC-shaped email address",
  },
  {
    name: "ssn",
    regex: /\b\d{3}-\d{2}-\d{4}\b/,
    description: "US Social Security number (dashed)",
  },
  {
    name: "credit_card",
    regex: /\b(?:\d[ -]?){13,19}\b/,
    description: "Long digit run consistent with a credit-card number",
  },
  {
    name: "phone_us",
    regex: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/,
    description: "US-shaped phone number",
  },
  {
    name: "uuid",
    regex: /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/,
    description: "UUIDv4 — refuse in keys; hash or use a stable surrogate",
  },
]);
