// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/** Outcome of a verification check. */
export interface VerificationOk {
  ok: true;
}
export interface VerificationFail {
  ok: false;
  /** Stable code suitable for log/metric labels (no PII). */
  code: string;
  /** Human-friendly detail; safe to log. */
  detail: string;
}
export type VerificationResult = VerificationOk | VerificationFail;

/**
 * Handle persisted by the idempotency store. The body of a webhook is
 * processed at most once per `key`; subsequent calls with the same key
 * see `status: "duplicate"` and skip side-effects.
 */
export type IdempotencyOutcome =
  | { status: "fresh" }
  | { status: "duplicate"; firstSeenAt: number };

/** Storage backend for idempotency keys. Caller-supplied. */
export interface IdempotencyStore {
  /**
   * Reserve a key. Returns `fresh` if the key was newly inserted (caller
   * proceeds with side-effects), `duplicate` if it was already present.
   *
   * Implementations should write atomically (Redis SETNX, Postgres
   * INSERT … ON CONFLICT DO NOTHING, etc.) and return whether the
   * insertion happened.
   */
  reserve(key: string, nowMs: number): Promise<IdempotencyOutcome>;
}
