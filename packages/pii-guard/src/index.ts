/**
 * @pwos/pii-guard
 *
 * 4-layer PII scanning pipeline for LLM-bound content.
 *
 * Protocol Wealth original work. See USPTO #64/034,215.
 *
 * Layers:
 *   1. Regex (31 deterministic patterns)
 *   2. NER (named entity recognition)
 *   3. Financial Recognizers (CUSIP, account refs, policy numbers)
 *   4. Allow-list (60+ finance terms that should never redact)
 *
 * Copyright 2026 Protocol Wealth, LLC
 * Licensed under Apache 2.0
 */

export const VERSION = "0.1.0";
