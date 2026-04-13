// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * Response filter pipeline for MCP tool outputs.
 *
 * Filters run left-to-right against a tool's response before it returns
 * to the caller. Typical uses:
 *
 *   1. PII redaction (for CLIENT_FILTERED tier, mask names / accounts)
 *   2. Tier-based sanitization (public tier gets language-softened output)
 *   3. Disclaimer attachment (SEC Rule 206(4)-1 compliance)
 *   4. Audit logging (out-of-band — filter observes only)
 *
 * Filters are pure functions of (toolName, response, auth) → response.
 * They may be async. Throwing from a filter aborts the pipeline, so
 * filters that must not block the caller should swallow their own errors.
 */

import type { AuthContext, ToolResult } from "./types.js";
import { ToolTier } from "./types.js";

/** Response filter callback. */
export type ResponseFilter = (
  toolName: string,
  response: ToolResult,
  auth: AuthContext,
) => ToolResult | Promise<ToolResult>;

/** Run a sequence of filters in order and return the final response. */
export async function applyFilters(
  toolName: string,
  response: ToolResult,
  filters: readonly ResponseFilter[],
  auth: AuthContext = {},
): Promise<ToolResult> {
  let current = response;
  for (const filter of filters) {
    current = await filter(toolName, current, auth);
  }
  return current;
}

// ──────────────────────────────────────────────────────────────────────
// Built-in filters
// ──────────────────────────────────────────────────────────────────────

/**
 * Append a ``disclaimer`` field to every successful tool response.
 *
 * Typical disclaimer text should be short, regulatory-compliant, and
 * reviewed by legal. The default here is a generic educational-use
 * statement — replace it with your approved text before shipping.
 */
export function disclaimerFilter(disclaimer: string): ResponseFilter {
  return (_tool, response) => {
    if (!response.ok) return response;
    const meta = { ...(response.meta ?? {}), disclaimer };
    return { ...response, meta };
  };
}

/**
 * Redact PII from ``response.data`` using a caller-supplied scanner.
 *
 * Only runs when the caller's tier is ``CLIENT_FILTERED`` — sensitive
 * tier implies consent was captured upstream, public tier shouldn't
 * have seen PII to begin with.
 *
 * Pair this with ``@pwos/pii-guard.scan`` in the downstream project.
 */
export function piiRedactionFilter(
  scan: (text: string) => Promise<{ sanitizedText: string; hasPII: boolean }>,
): ResponseFilter {
  return async (_tool, response, auth) => {
    if (!response.ok) return response;
    if (auth.tier !== ToolTier.CLIENT_FILTERED) return response;
    if (typeof response.data !== "string") return response;

    const { sanitizedText, hasPII } = await scan(response.data);
    if (!hasPII) return response;

    return {
      ...response,
      data: sanitizedText as unknown as typeof response.data,
      meta: { ...(response.meta ?? {}), pii_redacted: true },
    };
  };
}

/**
 * For PUBLIC tier callers, replace strong directive language with neutral
 * phrasing ("STRONG BUY" → "STRONG"). Prevents public-tier consumers from
 * receiving outputs that sound like investment advice (Rule 206(4)-1).
 *
 * Accepts a map of patterns to replacements. Empty map = no-op.
 */
export function publicTierSanitizer(
  replacements: ReadonlyMap<RegExp, string>,
): ResponseFilter {
  return (_tool, response, auth) => {
    if (!response.ok) return response;
    if (auth.tier !== undefined && auth.tier !== ToolTier.PUBLIC) return response;
    if (typeof response.data !== "string") return response;

    let sanitized = response.data;
    for (const [pattern, replacement] of replacements) {
      sanitized = sanitized.replace(pattern, replacement);
    }
    if (sanitized === response.data) return response;
    return {
      ...response,
      data: sanitized as unknown as typeof response.data,
      meta: { ...(response.meta ?? {}), public_tier_sanitized: true },
    };
  };
}

/**
 * Pass responses to an observer for side effects (audit logging, metrics).
 *
 * Observer cannot modify the response. Errors thrown in the observer are
 * swallowed — audit failures must not break tool responses.
 */
export function observerFilter(
  observe: (tool: string, response: ToolResult, auth: AuthContext) => void | Promise<void>,
): ResponseFilter {
  return async (tool, response, auth) => {
    try {
      await observe(tool, response, auth);
    } catch {
      // Intentionally swallow — observers must not block the response path.
    }
    return response;
  };
}
