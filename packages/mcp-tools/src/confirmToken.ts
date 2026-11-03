// SPDX-License-Identifier: MIT-0 OR Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * Confirmation-token cryptography and the single-use store contract.
 *
 * A confirm token is an HMAC-SHA256 over a canonical binding
 * (operation, principal, payload hash, expiry, token id), keyed with
 * a server secret. Callers who can see the request body cannot mint a
 * valid token. The store records ids this process issued and accepts
 * each id once. Expiry is part of the signed binding; the gate rejects
 * a token at or after `exp` before it runs the write.
 *
 * This is authenticated binding of one preview to one execution. It is
 * not, by itself, proof a human approved. Issue the token from the
 * trusted side (the gate's preview, or `issueConfirmToken` after an
 * approval you trust) and compare `principalId` to the server session,
 * not to a model-supplied field.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/** Reject oversized tokens before doing any cryptographic work. */
const MAX_TOKEN_CHARS = 4096;
const MAC_HEX_LENGTH = 64;
const MAC_HEX = new RegExp(`^[0-9a-f]{${MAC_HEX_LENGTH}}$`);

export class ConfirmGateConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfirmGateConfigError";
  }
}

export interface ConfirmBinding {
  /** Expiry, unix epoch milliseconds. Valid while `now < exp`. */
  exp: number;
  /** Single-use id. Opaque to the caller; the store keys on it. */
  jti: string;
  /** Server operation / tool name. */
  op: string;
  /** SHA-256 hex of the canonical payload. Not the payload itself. */
  pay: string;
  /** Server principal or session id. */
  sub: string;
}

/**
 * Result of an atomic consume.
 *
 * - `consumed` — this caller won the single use.
 * - `replayed` — the id was already consumed.
 * - `unknown` — this store never issued the id.
 */
export type ConsumeResult = "consumed" | "replayed" | "unknown";

/**
 * Persistence for issued confirmation ids.
 *
 * `issue` and `consume` must each be atomic. Two overlapping calls for
 * the same id must not both observe success. A database unique
 * constraint or an `UPDATE … WHERE consumed_at IS NULL` is the right
 * shape; check-then-await-then-insert is not.
 *
 * The in-memory implementation is for tests and a single process. It
 * does not survive restarts and it is not shared across workers.
 * Production stores should delete rows after `expiresAtMs` so the table
 * does not grow without bound. Deleting an already-consumed id is safe:
 * a later consume returns `unknown`, which the gate still rejects.
 *
 * Sketch (the id is the primary key):
 *
 *     INSERT INTO confirm_tokens (jti, expires_at)
 *     VALUES ($1, $2)
 *     ON CONFLICT DO NOTHING
 *     RETURNING jti;  -- empty result → issue failed
 *
 *     UPDATE confirm_tokens
 *     SET consumed_at = now()
 *     WHERE jti = $1 AND consumed_at IS NULL
 *     RETURNING jti;  -- empty result → replayed or unknown
 */
export interface ConfirmTokenStore {
  issue(jti: string, expiresAtMs: number): Promise<boolean> | boolean;
  consume(jti: string): Promise<ConsumeResult> | ConsumeResult;
}

/**
 * Server-side context the gate requires before it will preview or execute.
 * There is no unkeyed mode.
 */
export interface ConfirmAuthorization {
  /** HMAC secret. Must be non-empty. Keep it off the model path. */
  secret: string | Buffer;
  /**
   * Principal or session the approval is bound to. The gate compares
   * this value to the token; do not take it from the model payload.
   */
  principalId: string;
  /** Shared with every preview and confirm for this deployment. */
  store: ConfirmTokenStore;
  /**
   * Lifetime of a newly issued token, in milliseconds. Required so a
   * deployment chooses its own window. Must be a positive safe integer.
   */
  ttlMs: number;
  /** Clock for issuance and expiry. Default `Date.now`. */
  now?: () => number;
}

type TokenRow = { state: "issued" | "consumed"; expiresAtMs: number };

/**
 * Single-process store. `issue` and `consume` finish their check-and-set
 * before they return, so concurrent `confirmGate` calls on one event
 * loop cannot both consume the same id.
 */
export class InMemoryConfirmTokenStore implements ConfirmTokenStore {
  private readonly rows = new Map<string, TokenRow>();

  issue(jti: string, expiresAtMs: number): boolean {
    if (this.rows.has(jti)) return false;
    this.rows.set(jti, { state: "issued", expiresAtMs });
    return true;
  }

  consume(jti: string): ConsumeResult {
    const row = this.rows.get(jti);
    if (!row) return "unknown";
    if (row.state === "consumed") return "replayed";
    row.state = "consumed";
    return "consumed";
  }

  /** Test affordance. */
  size(): number {
    return this.rows.size;
  }
}

export function secretBytes(secret: string | Buffer): Buffer {
  if (typeof secret === "string") {
    if (secret.length === 0) {
      throw new ConfirmGateConfigError("confirmation secret must be non-empty");
    }
    return Buffer.from(secret, "utf8");
  }
  if (Buffer.isBuffer(secret)) {
    if (secret.length === 0) {
      throw new ConfirmGateConfigError("confirmation secret must be non-empty");
    }
    return secret;
  }
  throw new ConfirmGateConfigError("confirmation secret must be a string or Buffer");
}

function canonicalBinding(binding: ConfirmBinding): string {
  return (
    `{"exp":${JSON.stringify(binding.exp)},` +
    `"jti":${JSON.stringify(binding.jti)},` +
    `"op":${JSON.stringify(binding.op)},` +
    `"pay":${JSON.stringify(binding.pay)},` +
    `"sub":${JSON.stringify(binding.sub)}}`
  );
}

function assertBinding(binding: ConfirmBinding): void {
  if (!Number.isSafeInteger(binding.exp)) {
    throw new ConfirmGateConfigError("token expiry must be a safe integer");
  }
  if (typeof binding.jti !== "string" || binding.jti.length < 8 || binding.jti.length > 128) {
    throw new ConfirmGateConfigError("token id must be 8 to 128 characters");
  }
  if (typeof binding.op !== "string" || binding.op.length === 0 || binding.op.length > 256) {
    throw new ConfirmGateConfigError("operation must be 1 to 256 characters");
  }
  if (typeof binding.sub !== "string" || binding.sub.length === 0 || binding.sub.length > 256) {
    throw new ConfirmGateConfigError("principalId must be 1 to 256 characters");
  }
  if (typeof binding.pay !== "string" || !/^[0-9a-f]{64}$/.test(binding.pay)) {
    throw new ConfirmGateConfigError("payload hash must be 64 hex characters");
  }
}

export function createConfirmToken(binding: ConfirmBinding, secret: string | Buffer): string {
  assertBinding(binding);
  const canonical = canonicalBinding(binding);
  const mac = createHmac("sha256", secretBytes(secret)).update(canonical).digest("hex");
  return `v1.${Buffer.from(canonical, "utf8").toString("base64url")}.${mac}`;
}

export type VerifiedConfirmToken =
  | { ok: true; binding: ConfirmBinding }
  | { ok: false };

function parseBinding(canonical: string): ConfirmBinding | null {
  let value: unknown;
  try {
    value = JSON.parse(canonical);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  if (Object.keys(obj).length !== 5) return null;
  const exp = obj.exp;
  const jti = obj.jti;
  const op = obj.op;
  const pay = obj.pay;
  const sub = obj.sub;
  if (typeof exp !== "number" || !Number.isSafeInteger(exp)) return null;
  if (typeof jti !== "string" || jti.length < 8 || jti.length > 128) return null;
  if (typeof op !== "string" || op.length === 0 || op.length > 256) return null;
  if (typeof sub !== "string" || sub.length === 0 || sub.length > 256) return null;
  if (typeof pay !== "string" || !/^[0-9a-f]{64}$/.test(pay)) return null;
  return { exp, jti, op, pay, sub };
}

/**
 * Verify the HMAC and the canonical binding. A bad mac, a malformed
 * token, and a binding that does not re-canonicalize all fail closed.
 * This function does not check expiry or the store.
 */
export function verifyConfirmToken(token: string, secret: string | Buffer): VerifiedConfirmToken {
  if (typeof token !== "string" || token.length === 0 || token.length > MAX_TOKEN_CHARS) {
    return { ok: false };
  }
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return { ok: false };
  const payloadPart = parts[1] ?? "";
  const macHex = parts[2] ?? "";
  if (!MAC_HEX.test(macHex)) return { ok: false };
  if (!/^[A-Za-z0-9_-]+$/.test(payloadPart)) return { ok: false };

  const canonical = Buffer.from(payloadPart, "base64url").toString("utf8");
  const expected = createHmac("sha256", secretBytes(secret)).update(canonical).digest();
  const provided = Buffer.from(macHex, "hex");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return { ok: false };
  }

  const binding = parseBinding(canonical);
  if (!binding) return { ok: false };
  if (canonicalBinding(binding) !== canonical) return { ok: false };
  return { ok: true, binding };
}

export function assertPositiveTtl(ttlMs: number): void {
  if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0) {
    throw new ConfirmGateConfigError("ttlMs must be a positive safe integer");
  }
}

export function assertClock(nowMs: number): void {
  if (!Number.isSafeInteger(nowMs)) {
    throw new ConfirmGateConfigError("clock must return a safe integer epoch millisecond");
  }
}
