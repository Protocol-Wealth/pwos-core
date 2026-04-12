// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * Input validation and sanitization.
 *
 * First line of defense before any LLM-bound content is scanned or
 * processed. Enforces size limits, strips low-level control characters
 * and invisible Unicode (which can smuggle hidden instructions past
 * reviewers), and removes HTML script tags using index-based parsing
 * (avoiding the CodeQL CWE-116 class of sanitization bypasses).
 */

const DEFAULT_MAX_INPUT_BYTES = 1_048_576; // 1 MB
const DEFAULT_MAX_LINE_COUNT = 50_000;

// Control chars excluding \t (0x09), \n (0x0a), \r (0x0d).
const CONTROL_CHARS = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g;
// Invisible Unicode: zero-width joiners, bidi overrides, word joiners, BOMs.
const INVISIBLE_UNICODE =
  /[\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180e\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\u206a-\u206f\ufeff\ufff9-\ufffb]+/g;
const EXCESSIVE_BLANKS = /\n{4,}/g;
const EXCESSIVE_SPACES = /[^\S\n]{10,}/g;

/** Remove `<script>...</script>` blocks via index walking — defeats regex bypasses. */
function stripScriptTags(input: string): string {
  let result = input;
  let changed = false;
  for (;;) {
    const lower = result.toLowerCase();
    const start = lower.indexOf("<script");
    if (start === -1) break;
    const closeTag = lower.indexOf("</script", start + 7);
    if (closeTag === -1) {
      result = result.slice(0, start);
      changed = true;
      break;
    }
    const closeEnd = result.indexOf(">", closeTag + 8);
    result = result.slice(0, start) + result.slice(closeEnd === -1 ? closeTag + 9 : closeEnd + 1);
    changed = true;
  }
  return changed ? result : input;
}

export interface ValidationOptions {
  maxBytes?: number;
  maxLines?: number;
}

export interface ValidationResult {
  text: string;
  isValid: boolean;
  actions: string[];
  error?: string;
}

/** Validate and sanitize text before further processing. */
export function validateInput(text: string, opts: ValidationOptions = {}): ValidationResult {
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_INPUT_BYTES;
  const maxLines = opts.maxLines ?? DEFAULT_MAX_LINE_COUNT;
  const actions: string[] = [];

  const byteLength = new TextEncoder().encode(text).length;
  if (byteLength > maxBytes) {
    return {
      text,
      isValid: false,
      actions: [],
      error: `Input exceeds ${maxBytes} byte limit`,
    };
  }

  const lineCount = (text.match(/\n/g) || []).length;
  if (lineCount >= maxLines) {
    return {
      text,
      isValid: false,
      actions: [],
      error: `Input exceeds ${maxLines} line limit`,
    };
  }

  let cleaned = text;

  if (CONTROL_CHARS.test(cleaned)) {
    cleaned = cleaned.replace(CONTROL_CHARS, "");
    actions.push("stripped_control_chars");
  }

  if (INVISIBLE_UNICODE.test(cleaned)) {
    cleaned = cleaned.replace(INVISIBLE_UNICODE, "");
    actions.push("stripped_invisible_unicode");
  }

  const afterStrip = stripScriptTags(cleaned);
  if (afterStrip !== cleaned) {
    cleaned = afterStrip;
    actions.push("stripped_script_tags");
  }

  if (EXCESSIVE_BLANKS.test(cleaned)) {
    cleaned = cleaned.replace(EXCESSIVE_BLANKS, "\n\n\n");
    actions.push("normalized_blank_lines");
  }

  if (EXCESSIVE_SPACES.test(cleaned)) {
    cleaned = cleaned.replace(EXCESSIVE_SPACES, " ");
    actions.push("normalized_spaces");
  }

  return { text: cleaned, isValid: true, actions };
}
