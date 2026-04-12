// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * Audit logger — the main entry point.
 *
 * Users construct a logger with a store and optionally an id/clock source.
 * Every ``log()`` call:
 *   1. Generates an id + timestamp.
 *   2. Fetches the latest entry's hash to chain against.
 *   3. Computes the new entry's hash.
 *   4. Appends to the store.
 *
 * The store is the single source of truth for ordering — the logger does
 * not cache the chain. This keeps concurrent writers safe (assuming the
 * backing store serializes appends, e.g. via a SERIALIZABLE transaction).
 */

import { hashEntry } from "./hash.js";
import type { AuditStore } from "./store.js";
import type { AuditEntry, AuditQuery, NewAuditEntry } from "./types.js";

export interface AuditLoggerOptions {
  store: AuditStore;
  /** Override for testing or deterministic ID generation. */
  idProvider?: () => string;
  /** Override for testing or deterministic timestamps. */
  clock?: () => Date;
}

export class AuditLogger {
  private readonly store: AuditStore;
  private readonly idProvider: () => string;
  private readonly clock: () => Date;

  constructor(opts: AuditLoggerOptions) {
    this.store = opts.store;
    this.idProvider = opts.idProvider ?? defaultIdProvider;
    this.clock = opts.clock ?? (() => new Date());
  }

  /** Append a new audit entry. Returns the fully-populated record. */
  async log(input: NewAuditEntry): Promise<AuditEntry> {
    const timestamp = input.timestamp ?? this.clock().toISOString();
    const previous = await this.store.getLatest();
    const previousHash = previous?.hash ?? "";

    const draft: AuditEntry = {
      id: this.idProvider(),
      timestamp,
      actorId: input.actorId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      details: input.details,
      ipAddress: input.ipAddress,
      previousHash,
    };

    draft.hash = await hashEntry(draft, previousHash);
    await this.store.append(draft);
    return draft;
  }

  /** Query the audit log. Results are newest-first unless the store says otherwise. */
  query(filter: AuditQuery): Promise<AuditEntry[]> {
    return this.store.query(filter);
  }

  count(filter?: AuditQuery): Promise<number> {
    return this.store.count(filter);
  }
}

function defaultIdProvider(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  // Non-cryptographic fallback for unusual runtimes.
  return `audit_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
