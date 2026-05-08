// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Idempotency-key replay protection.
 *
 * Webhooks retry. A vendor's "at-least-once delivery" becomes "duplicate
 * email sent" or "duplicate ledger row" if your handler isn't
 * idempotent. The fix: derive a stable key per delivery (vendor's
 * `MessageID` / `event_id` / a hash of the body) and reserve it before
 * any side-effect. Subsequent retries with the same key see
 * `status: "duplicate"` and skip the work.
 *
 * Backend is caller-supplied via `IdempotencyStore` so consumers can
 * back this with Redis SETNX, Postgres `INSERT … ON CONFLICT`, or
 * whatever fits their stack. An in-memory implementation ships for
 * tests and dev.
 */

import { createHash } from "node:crypto";
import type { IdempotencyOutcome, IdempotencyStore } from "./types.js";

/** Hash a body to a stable idempotency key when no vendor id is available. */
export function hashBodyForIdempotency(body: string | Buffer): string {
  const h = createHash("sha256");
  h.update(body);
  return h.digest("hex");
}

/**
 * In-memory store. Suitable for tests and single-process dev. Not safe
 * across multiple workers.
 */
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly seen = new Map<string, number>();

  async reserve(key: string, nowMs: number): Promise<IdempotencyOutcome> {
    const existing = this.seen.get(key);
    if (existing !== undefined) {
      return { status: "duplicate", firstSeenAt: existing };
    }
    this.seen.set(key, nowMs);
    return { status: "fresh" };
  }

  /** Test affordance — clear all reservations. */
  clear(): void {
    this.seen.clear();
  }

  size(): number {
    return this.seen.size;
  }
}
