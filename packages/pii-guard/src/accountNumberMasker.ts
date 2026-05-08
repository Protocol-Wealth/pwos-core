// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Account-number masker — the "show last 4" pattern.
 *
 * Most consumer-facing fintech surfaces display account numbers as
 * `•••• 1234` so the trailing four digits are recognizable but the
 * full identifier never appears in logs, screenshots, or AI tool
 * outputs. This module ships that primitive.
 *
 * Two operations:
 *   - `maskAccountNumber(value, options?)` — masks a single string
 *   - `maskAccountNumbersInText(text, options?)` — finds and masks
 *     account-number-shaped runs inside free text
 *
 * The shape detector is deliberately simple: 8–20 contiguous digits
 * (optionally with internal hyphens or spaces). Tighter detectors
 * (Luhn check for credit cards, ABA routing for US banks) live in
 * the financial recognizers.
 */

export interface MaskOptions {
  /** Number of trailing digits to reveal. Default 4. */
  reveal?: number;
  /** Mask character. Default `•` (U+2022). */
  maskChar?: string;
  /** Length of the mask prefix. Default 4. */
  maskLength?: number;
  /** Separator between mask and revealed digits. Default `" "`. */
  separator?: string;
}

const DEFAULT_OPTIONS: Required<MaskOptions> = {
  reveal: 4,
  maskChar: "•",
  maskLength: 4,
  separator: " ",
};

function withDefaults(options?: MaskOptions): Required<MaskOptions> {
  return { ...DEFAULT_OPTIONS, ...(options ?? {}) };
}

/**
 * Mask a single account-number value. Strips internal whitespace and
 * hyphens before measuring. Returns the masked form on success, or
 * `null` if the input doesn't look like an account number (too short
 * or contains non-digit / non-separator characters).
 */
export function maskAccountNumber(
  value: string,
  options?: MaskOptions
): string | null {
  const opts = withDefaults(options);
  const digitsOnly = value.replace(/[\s-]/g, "");
  if (!/^\d+$/.test(digitsOnly)) return null;
  if (digitsOnly.length < opts.reveal + 1) return null;
  const tail = digitsOnly.slice(-opts.reveal);
  const mask = opts.maskChar.repeat(opts.maskLength);
  return `${mask}${opts.separator}${tail}`;
}

/**
 * Find and mask account-number-shaped runs inside free text. The
 * detector matches 8–20 digit runs with optional internal hyphens or
 * single spaces. Surrounding text is preserved verbatim.
 *
 * For richer detection (CUSIP / IBAN / SSN), use the full
 * `scan()` pipeline; this function is the lightweight first-line
 * defense for tool outputs and structured-log redaction.
 */
export function maskAccountNumbersInText(
  text: string,
  options?: MaskOptions
): string {
  const opts = withDefaults(options);
  // Match runs of 8–20 digits, optionally with single-character
  // internal separators (hyphen or space).
  const pattern = /\b(?:\d[\s-]?){7,19}\d\b/g;
  return text.replace(pattern, (match) => {
    const masked = maskAccountNumber(match, opts);
    return masked ?? match;
  });
}
