// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * Store abstraction for the audit log.
 *
 * An ``AuditStore`` is any backend that can append and query audit entries.
 * The ship-it-now implementations include an in-memory store (useful for
 * tests and demos) and a helper for wiring Drizzle/Postgres or any other
 * persistent store.
 */

import type { AuditEntry, AuditQuery, NewAuditEntry } from "./types.js";

/** Persistence contract. Implementations must enforce append-only semantics. */
export interface AuditStore {
  append(entry: AuditEntry): Promise<void>;
  query(filter: AuditQuery): Promise<AuditEntry[]>;
  getLatest(): Promise<AuditEntry | null>;
  count(filter?: AuditQuery): Promise<number>;
}

/**
 * In-memory store — for tests and local development only.
 *
 * Not durable across process restarts. Production deployments must use a
 * persistent store (Postgres, DynamoDB, S3 object-lock, etc.) so retention
 * guarantees can actually be met.
 */
export class InMemoryAuditStore implements AuditStore {
  private readonly entries: AuditEntry[] = [];

  async append(entry: AuditEntry): Promise<void> {
    this.entries.push(entry);
  }

  async query(filter: AuditQuery): Promise<AuditEntry[]> {
    let result = [...this.entries];
    if (filter.actorId) result = result.filter((e) => e.actorId === filter.actorId);
    if (filter.action) result = result.filter((e) => e.action === filter.action);
    if (filter.resourceType)
      result = result.filter((e) => e.resourceType === filter.resourceType);
    if (filter.resourceId) result = result.filter((e) => e.resourceId === filter.resourceId);
    if (filter.startTime) result = result.filter((e) => e.timestamp >= filter.startTime!);
    if (filter.endTime) result = result.filter((e) => e.timestamp <= filter.endTime!);

    // Newest first.
    result.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? result.length;
    return result.slice(offset, offset + limit);
  }

  async getLatest(): Promise<AuditEntry | null> {
    if (this.entries.length === 0) return null;
    return this.entries.reduce((latest, current) =>
      current.timestamp > latest.timestamp ? current : latest,
    );
  }

  async count(filter?: AuditQuery): Promise<number> {
    if (!filter) return this.entries.length;
    return (await this.query({ ...filter, limit: undefined, offset: undefined })).length;
  }
}

/** Convenience: append-only store that wraps another store and disallows mutation paths. */
export function readonlyView(store: AuditStore): Pick<AuditStore, "query" | "getLatest" | "count"> {
  return {
    query: (filter) => store.query(filter),
    getLatest: () => store.getLatest(),
    count: (filter) => store.count(filter),
  };
}

/** Re-export for convenience. */
export type { AuditEntry, AuditQuery, NewAuditEntry };
