// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * Core types for the audit log.
 *
 * The audit log is append-only and intended to satisfy SEC Rule 204-2
 * "Books and Records" retention requirements (5 years for RIAs). Every
 * mutating action in the application — creating a client, updating a
 * portfolio, sending an email — produces an audit entry.
 */

/** A single audit log entry. */
export interface AuditEntry {
  /** Stable identifier (UUID recommended). */
  id: string;
  /** ISO-8601 timestamp of when the event occurred. */
  timestamp: string;
  /** Who performed the action — typically a user id, email, or service name. */
  actorId: string;
  /** What action was performed — short, stable, machine-readable (e.g., "client.create"). */
  action: string;
  /** Logical resource type (e.g., "client", "portfolio", "message"). */
  resourceType?: string;
  /** Stable id of the resource acted on. */
  resourceId?: string;
  /** Arbitrary structured payload. Avoid storing PII here. */
  details?: unknown;
  /** Originating IP or client identifier for traceability. */
  ipAddress?: string;
  /** Hash of the prior entry + current fields — used for tamper detection. */
  hash?: string;
  /** The prior entry's hash, recorded for chain verification. */
  previousHash?: string;
}

/** Append-time input — omits computed / generated fields. */
export type NewAuditEntry = Omit<AuditEntry, "id" | "timestamp" | "hash" | "previousHash"> & {
  /** Override timestamp if you need to backdate (e.g., importing historical data). */
  timestamp?: string;
};

/** Query filter for retrieving entries. */
export interface AuditQuery {
  actorId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  startTime?: string;
  endTime?: string;
  limit?: number;
  offset?: number;
}
