// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * Confirmation gate framework for write-class LLM tools.
 *
 * Pattern: a write tool runs in two turns. On the first call (no
 * `confirm_token`) it returns a deterministic preview of what *would*
 * happen plus a token bound to the exact payload. On the second call
 * the token is required and recomputed from the resubmitted payload;
 * if the payload mutated by even one byte the recomputed token won't
 * match and the gate refuses to execute.
 *
 * Why hash-of-payload, not opaque server-issued token:
 *   - Server-side state means another moving part. With hash-binding
 *     the gate is stateless — the token IS the contract.
 *   - The token can't be reused for a *different* payload, since any
 *     change produces a new hash. There is no "confirm anything"
 *     credential to leak.
 *   - The model can read the token off the preview and pass it back —
 *     that's intended. The point isn't secrecy; it's that the model
 *     cannot silently fudge values between preview and execution
 *     without invalidating the binding.
 *
 * Why deterministic preview text (not model-rendered):
 *   - The human reviewer needs to read the *actual* operation, not a
 *     model paraphrase. The preview MUST be produced by the tool
 *     itself, never by the LLM. That way the chat surface shows the
 *     literal payload the reviewer is approving.
 *
 * Stability: the confirm token is sha256 over a key-sorted JSON
 * serialization, then the first 16 hex chars (64 bits of binding).
 * Far more entropy than the chat budget can spend brute-forcing, and
 * short tokens copy cleanly into a second tool_use input.
 */

import { createHash } from "node:crypto";

/** Length (in hex chars) of the truncated confirm token. */
export const CONFIRM_TOKEN_LENGTH = 16;

/**
 * Stable JSON: object keys sorted recursively so two semantically equal
 * payloads produce the same string regardless of key insertion order.
 * Arrays are NOT reordered — array order is semantic.
 *
 * `null` and `undefined` both serialize to the literal `"null"` so the
 * caller can't distinguish them from the hash; this matches JSON's own
 * lossy treatment of `undefined` and keeps the gate's contract simple.
 */
export function stableJsonString(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableJsonString(v)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const entries = keys.map(
    (k) => `${JSON.stringify(k)}:${stableJsonString(obj[k])}`,
  );
  return `{${entries.join(",")}}`;
}

/**
 * Compute the confirm token for a payload. Pure function — same input
 * always yields the same output, regardless of key insertion order.
 */
export function computeConfirmToken(payload: unknown): string {
  return createHash("sha256")
    .update(stableJsonString(payload))
    .digest("hex")
    .slice(0, CONFIRM_TOKEN_LENGTH);
}

/** Arguments to the default preview-message formatter. */
export interface PreviewMessageArgs {
  /** Short label like `"create record"`. Surfaced in the preview header. */
  operationLabel: string;
  /** Tool-rendered description of what would happen. */
  previewBody: string;
  /** Token the caller must pass back to authorize execution. */
  confirmToken: string;
}

/**
 * Default preview-message format. Override via
 * `ConfirmGateOptions.formatPreview` if you need different wording.
 */
export function formatPreviewMessage(args: PreviewMessageArgs): string {
  return (
    `**Preview — ${args.operationLabel}**\n\n` +
    `${args.previewBody}\n\n` +
    `---\n` +
    `This tool writes data. To proceed, call again with the SAME payload and:\n` +
    `  confirm_token: "${args.confirmToken}"\n\n` +
    `If any field of the payload changes, the token will no longer match and the call will be rejected.`
  );
}

/** Options to {@link confirmGate}. */
export interface ConfirmGateOptions<P, R> {
  /** Validated payload the tool will act on. */
  payload: P;
  /** Token from the prior preview turn, or undefined on first call. */
  confirmToken?: string;
  /** Short label like `"create record"`. Surfaced in the preview header. */
  operationLabel: string;
  /**
   * Render a deterministic preview of the operation. MUST be a pure
   * function of the payload — never call the upstream API here.
   */
  renderPreview: (payload: P) => string;
  /** Execute the operation. Only invoked after token validation passes. */
  execute: (payload: P) => Promise<R>;
  /**
   * Optional override for the preview message format. Default is
   * {@link formatPreviewMessage}. Override to localize, theme, or
   * shorten the wording.
   */
  formatPreview?: (args: PreviewMessageArgs) => string;
}

/**
 * Outcome of a {@link confirmGate} call. Discriminated by `phase`:
 *
 * - `preview` — first call. Caller should surface `previewMessage` to
 *   the user/LLM. The bound `confirmToken` is included so the caller
 *   can echo it explicitly if their UI needs it.
 * - `executed` — confirm token validated; the wrapped `execute()` ran
 *   and `result` holds whatever it returned.
 * - `rejected` — confirm token didn't match the payload's hash. No
 *   side effects. The caller should surface `error` to the LLM so it
 *   can re-request a fresh preview.
 */
export type ConfirmGateOutcome<R> =
  | { phase: "preview"; previewMessage: string; confirmToken: string }
  | { phase: "executed"; result: R }
  | { phase: "rejected"; code: "confirm_token_mismatch"; error: string };

const TOKEN_MISMATCH_ERROR =
  "confirm_token does not match the current payload. " +
  "The payload changed since the preview, or the token was copied from a different operation. " +
  "Re-run the tool without a confirm_token to get a fresh preview.";

/**
 * Wrap a write-class tool's handler so the first call returns a
 * preview + confirm token, and the second call (with matching token)
 * executes. Mismatched tokens fail with a structured outcome so the
 * caller can refuse cleanly.
 *
 * The function is fully generic over both the payload `P` and the
 * execute result `R` — it does NOT prescribe a `ToolResult` shape.
 * Adapt the returned outcome to whatever envelope your tool surface
 * uses (Anthropic content blocks, MCP results, etc.).
 *
 * @example
 * const outcome = await confirmGate({
 *   payload,
 *   confirmToken: input.confirm_token,
 *   operationLabel: "create record",
 *   renderPreview: (p) => `Will create "${p.name}" with amount ${p.amount}.`,
 *   execute: (p) => upstream.createRecord(p),
 * });
 *
 * switch (outcome.phase) {
 *   case "preview":  return { ok: true, content: outcome.previewMessage };
 *   case "executed": return { ok: true, content: JSON.stringify(outcome.result) };
 *   case "rejected": return { ok: false, error: outcome.error, code: outcome.code };
 * }
 */
export async function confirmGate<P, R>(
  opts: ConfirmGateOptions<P, R>,
): Promise<ConfirmGateOutcome<R>> {
  const expected = computeConfirmToken(opts.payload);

  if (!opts.confirmToken) {
    const previewBody = opts.renderPreview(opts.payload);
    const formatter = opts.formatPreview ?? formatPreviewMessage;
    const previewMessage = formatter({
      operationLabel: opts.operationLabel,
      previewBody,
      confirmToken: expected,
    });
    return { phase: "preview", previewMessage, confirmToken: expected };
  }

  if (opts.confirmToken !== expected) {
    return {
      phase: "rejected",
      code: "confirm_token_mismatch",
      error: TOKEN_MISMATCH_ERROR,
    };
  }

  const result = await opts.execute(opts.payload);
  return { phase: "executed", result };
}
