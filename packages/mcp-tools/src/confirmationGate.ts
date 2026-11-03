// SPDX-License-Identifier: MIT-0 OR Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * Confirmation gate for write-class LLM tools.
 *
 * A write tool runs in two turns. The first call (no `confirmToken`)
 * returns a deterministic preview and a server-issued token. The second
 * call must present that token. The gate executes only when the token's
 * HMAC verifies under the server secret, the operation, principal, and
 * payload hash match, the token is unexpired, and the store consumes
 * its id exactly once.
 *
 * Promise of this primitive: authenticated, expiring, single-use binding
 * of one issued preview to one execution of the same principal,
 * operation, and payload. It does not prove a human approved. The model
 * can read a token out of a preview and send it back; that only
 * re-confirms the bound payload. A human approval step has to be the
 * thing that decides to submit the token (the UI echoes it after the
 * person approves, or a trusted handler calls `issueConfirmToken` and
 * `store.issue` after that approval). `principalId` and `operationLabel`
 * must come from the server, not from the model.
 *
 * Retries are not replays of the gate. The id is consumed before
 * `execute()`. If `execute()` throws, the token stays spent and the
 * caller previews again. If the write itself must be retry-safe, put an
 * idempotency key in the payload (the payload hash covers it) and dedupe
 * inside `execute()`. This gate does not store or replay `execute()`
 * results.
 *
 * The preview text is produced by the tool, not by the model, so the
 * reviewer reads the operation that will actually run.
 */

import { createHash, randomUUID } from "node:crypto";

import {
  ConfirmGateConfigError,
  assertClock,
  assertPositiveTtl,
  createConfirmToken,
  secretBytes,
  verifyConfirmToken,
  type ConfirmAuthorization,
} from "./confirmToken.js";

export { ConfirmGateConfigError };
export type { ConfirmAuthorization, ConfirmTokenStore, ConsumeResult } from "./confirmToken.js";

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
  const entries = keys.map((k) => `${JSON.stringify(k)}:${stableJsonString(obj[k])}`);
  return `{${entries.join(",")}}`;
}

function hashConfirmPayload(payload: unknown): string {
  return createHash("sha256").update(stableJsonString(payload)).digest("hex");
}

export interface IssueConfirmTokenArgs {
  payload: unknown;
  /** Server operation / tool name. Bound into the HMAC. */
  operation: string;
  /** Server principal or session id. Bound into the HMAC. */
  principalId: string;
  secret: string | Buffer;
  /** Unix epoch milliseconds. The token is valid while `now < expiresAtMs`. */
  expiresAtMs: number;
  /** Defaults to a random UUID. */
  jti?: string;
}

export interface IssuedConfirmToken {
  token: string;
  jti: string;
  expiresAtMs: number;
}

/**
 * Mint a token without registering it. `confirmGate` registers preview
 * tokens in `authorization.store`. A trusted approval handler that mints
 * with this function must call `store.issue` itself; a signed token the
 * store did not issue is rejected.
 */
export function issueConfirmToken(args: IssueConfirmTokenArgs): IssuedConfirmToken {
  secretBytes(args.secret);
  const jti = args.jti ?? randomUUID();
  const token = createConfirmToken(
    {
      exp: args.expiresAtMs,
      jti,
      op: args.operation,
      pay: hashConfirmPayload(args.payload),
      sub: args.principalId,
    },
    args.secret,
  );
  return { token, jti, expiresAtMs: args.expiresAtMs };
}

/** Arguments to the default preview-message formatter. */
export interface PreviewMessageArgs {
  /** Short label like `"create record"`. Surfaced in the preview header. */
  operationLabel: string;
  /** Tool-rendered description of what would happen. */
  previewBody: string;
  /** Token the caller must pass back to authorize execution. */
  confirmToken: string;
  /** Unix epoch milliseconds when the token stops being acceptable. */
  expiresAtMs?: number;
}

/**
 * Default preview-message format. Override via
 * `ConfirmGateOptions.formatPreview` if you need different wording.
 */
export function formatPreviewMessage(args: PreviewMessageArgs): string {
  const expiry =
    args.expiresAtMs === undefined
      ? ""
      : `The token expires at ${new Date(args.expiresAtMs).toISOString()} and can be used once.\n`;
  return (
    `**Preview — ${args.operationLabel}**\n\n` +
    `${args.previewBody}\n\n` +
    `---\n` +
    `This tool writes data. To proceed, call again with the SAME payload and:\n` +
    `  confirm_token: "${args.confirmToken}"\n\n` +
    expiry +
    `The token is bound to this operation, principal, and payload. ` +
    `If any of those change, or the token is expired or already used, the call is rejected.`
  );
}

/** Options to {@link confirmGate}. */
export interface ConfirmGateOptions<P, R> {
  /** Validated payload the tool will act on. */
  payload: P;
  /** Token from the prior preview turn, or undefined on first call. */
  confirmToken?: string;
  /**
   * Server-side operation / tool name. Bound into the token. Do not
   * take this from model-controlled input.
   */
  operationLabel: string;
  /** Required HMAC secret, principal, store, and lifetime. */
  authorization: ConfirmAuthorization;
  /**
   * Render a deterministic preview of the operation. MUST be a pure
   * function of the payload — never call the upstream API here.
   */
  renderPreview: (payload: P) => string;
  /** Execute the operation. Only invoked after the token is consumed. */
  execute: (payload: P) => Promise<R>;
  /**
   * Optional override for the preview message format. Default is
   * {@link formatPreviewMessage}.
   */
  formatPreview?: (args: PreviewMessageArgs) => string;
}

export type ConfirmRejectionCode =
  | "confirm_token_mismatch"
  | "confirm_token_expired"
  | "confirm_token_replayed"
  | "confirm_token_not_issued";

/**
 * Outcome of a {@link confirmGate} call. Discriminated by `phase`:
 *
 * - `preview` — first call. Surface `previewMessage` to the reviewer.
 *   `confirmToken` is the value a later call must send back.
 * - `executed` — the token was verified and consumed, then `execute()` ran.
 * - `rejected` — the token was not accepted. `execute()` was not called.
 */
export type ConfirmGateOutcome<R> =
  | { phase: "preview"; previewMessage: string; confirmToken: string; expiresAtMs: number }
  | { phase: "executed"; result: R }
  | { phase: "rejected"; code: ConfirmRejectionCode; error: string };

const TOKEN_MISMATCH_ERROR =
  "confirm_token does not match this principal, operation, and payload. " +
  "Re-run the tool without a confirm_token to get a fresh preview.";

const TOKEN_EXPIRED_ERROR =
  "confirm_token has expired. Re-run the tool without a confirm_token to get a fresh preview.";

const TOKEN_REPLAYED_ERROR =
  "confirm_token was already used. Re-run the tool without a confirm_token to get a fresh preview. " +
  "A failed execution is not retried with the same token; put an idempotency key in the payload and dedupe inside execute().";

const TOKEN_NOT_ISSUED_ERROR =
  "confirm_token was not issued by this gate's store. A signature alone is not acceptance.";

function readClock(authorization: ConfirmAuthorization): number {
  const now = authorization.now ? authorization.now() : Date.now();
  assertClock(now);
  return now;
}

function assertAuthorization(authorization: ConfirmAuthorization, operationLabel: string): void {
  if (!authorization || typeof authorization !== "object") {
    throw new ConfirmGateConfigError("authorization is required");
  }
  secretBytes(authorization.secret);
  assertPositiveTtl(authorization.ttlMs);
  if (typeof operationLabel !== "string" || operationLabel.length === 0 || operationLabel.length > 256) {
    throw new ConfirmGateConfigError("operation must be 1 to 256 characters");
  }
  if (
    typeof authorization.principalId !== "string" ||
    authorization.principalId.length === 0 ||
    authorization.principalId.length > 256
  ) {
    throw new ConfirmGateConfigError("principalId must be 1 to 256 characters");
  }
  if (
    !authorization.store ||
    typeof authorization.store.issue !== "function" ||
    typeof authorization.store.consume !== "function"
  ) {
    throw new ConfirmGateConfigError("authorization.store must implement issue and consume");
  }
}

/**
 * Wrap a write-class tool's handler so the first call returns a
 * preview plus a single-use token, and a later call executes only
 * when that token still matches and has not been consumed.
 *
 * The function is generic over the payload `P` and the execute result
 * `R`. Adapt the outcome to whatever envelope your tool surface uses.
 *
 * @example
 * const outcome = await confirmGate({
 *   payload,
 *   confirmToken: input.confirm_token,
 *   operationLabel: "create record",
 *   authorization: {
 *     secret,
 *     principalId: session.sub,
 *     store,
 *     ttlMs,
 *   },
 *   renderPreview: (p) => `Will create "${p.name}" with amount ${p.amount}.`,
 *   execute: (p) => upstream.createRecord(p),
 * });
 */
export async function confirmGate<P, R>(
  opts: ConfirmGateOptions<P, R>,
): Promise<ConfirmGateOutcome<R>> {
  assertAuthorization(opts.authorization, opts.operationLabel);
  const now = readClock(opts.authorization);

  if (!opts.confirmToken) {
    const expiresAtMs = now + opts.authorization.ttlMs;
    if (!Number.isSafeInteger(expiresAtMs)) {
      throw new ConfirmGateConfigError("token expiry is outside the safe integer range");
    }
    const previewBody = opts.renderPreview(opts.payload);
    const issued = issueConfirmToken({
      payload: opts.payload,
      operation: opts.operationLabel,
      principalId: opts.authorization.principalId,
      secret: opts.authorization.secret,
      expiresAtMs,
    });
    const accepted = await opts.authorization.store.issue(issued.jti, issued.expiresAtMs);
    if (!accepted) {
      throw new ConfirmGateConfigError("confirmation store refused to issue the token id");
    }
    const formatter = opts.formatPreview ?? formatPreviewMessage;
    const previewMessage = formatter({
      operationLabel: opts.operationLabel,
      previewBody,
      confirmToken: issued.token,
      expiresAtMs,
    });
    return { phase: "preview", previewMessage, confirmToken: issued.token, expiresAtMs };
  }

  const verified = verifyConfirmToken(opts.confirmToken, opts.authorization.secret);
  if (!verified.ok) {
    return { phase: "rejected", code: "confirm_token_mismatch", error: TOKEN_MISMATCH_ERROR };
  }

  const boundPayload = hashConfirmPayload(opts.payload);
  if (
    verified.binding.op !== opts.operationLabel ||
    verified.binding.sub !== opts.authorization.principalId ||
    verified.binding.pay !== boundPayload
  ) {
    return { phase: "rejected", code: "confirm_token_mismatch", error: TOKEN_MISMATCH_ERROR };
  }

  if (now >= verified.binding.exp) {
    await opts.authorization.store.consume(verified.binding.jti);
    return { phase: "rejected", code: "confirm_token_expired", error: TOKEN_EXPIRED_ERROR };
  }

  const consumed = await opts.authorization.store.consume(verified.binding.jti);
  if (consumed === "unknown") {
    return { phase: "rejected", code: "confirm_token_not_issued", error: TOKEN_NOT_ISSUED_ERROR };
  }
  if (consumed !== "consumed") {
    return { phase: "rejected", code: "confirm_token_replayed", error: TOKEN_REPLAYED_ERROR };
  }

  const result = await opts.execute(opts.payload);
  return { phase: "executed", result };
}
