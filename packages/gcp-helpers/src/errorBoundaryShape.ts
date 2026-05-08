// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Frontend error-boundary log shape.
 *
 * The pattern: in your React app shell, wrap routes in an error
 * boundary that catches uncaught render errors and POSTs a structured
 * payload to a server endpoint that forwards to Cloud Logging. Don't
 * log directly from the browser — that loses correlation with the
 * server-side trace and bypasses your audit boundary.
 *
 * This module ships the *shape* of that payload. The boundary
 * implementation is yours (React class component, Vue errorCaptured,
 * Svelte error handler, vanilla `window.onerror`).
 */

export interface FrontendErrorReport {
  action: "frontend_render_error";
  /** `Error.message`. */
  message: string;
  /** `Error.name`. */
  errorName: string;
  /** `Error.stack`, if present. May be truncated. */
  stack?: string;
  /** React's `componentStack` from `componentDidCatch`, if applicable. */
  componentStack?: string;
  /** Current URL at the time of the error. */
  url: string;
  /** The user agent string (for browser/version debugging). */
  userAgent: string;
  /** Your application's session id, if available. */
  sessionId?: string;
  /** Your application's actor id (no PII — opaque user/account id). */
  actorId?: string;
  /** Your build/version identifier. */
  buildId?: string;
  /** Epoch ms. */
  at: number;
}

/**
 * Build a report from the typical inputs available inside a React
 * error boundary's `componentDidCatch`. Truncates `stack` to a sensible
 * default (8 KB) — long stacks blow up Cloud Logging entries.
 */
export interface BuildReportInput {
  error: unknown;
  componentStack?: string;
  url: string;
  userAgent: string;
  sessionId?: string;
  actorId?: string;
  buildId?: string;
  /** Inject for tests. Defaults to Date.now. */
  now?: () => number;
  /** Stack truncation limit. Default 8192 chars. */
  stackLimit?: number;
}

export function buildFrontendErrorReport(input: BuildReportInput): FrontendErrorReport {
  const limit = input.stackLimit ?? 8192;
  const errLike =
    input.error instanceof Error
      ? input.error
      : { name: "NonError", message: String(input.error), stack: undefined };
  const stack =
    typeof errLike.stack === "string"
      ? errLike.stack.length > limit
        ? errLike.stack.slice(0, limit) + " …[truncated]"
        : errLike.stack
      : undefined;

  return {
    action: "frontend_render_error",
    message: errLike.message,
    errorName: errLike.name,
    ...(stack !== undefined && { stack }),
    ...(input.componentStack !== undefined && { componentStack: input.componentStack }),
    url: input.url,
    userAgent: input.userAgent,
    ...(input.sessionId !== undefined && { sessionId: input.sessionId }),
    ...(input.actorId !== undefined && { actorId: input.actorId }),
    ...(input.buildId !== undefined && { buildId: input.buildId }),
    at: (input.now ?? Date.now)(),
  };
}
