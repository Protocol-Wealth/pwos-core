// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * @pwos/audit-log
 *
 * Append-only audit log with SHA-256 hash chaining, intended to satisfy
 * SEC Rule 204-2 Books-and-Records retention. Defensive patent:
 * USPTO #64/034,215.
 *
 * Minimum usage::
 *
 *     import { AuditLogger, InMemoryAuditStore } from "@pwos/audit-log";
 *
 *     const logger = new AuditLogger({ store: new InMemoryAuditStore() });
 *     await logger.log({
 *       actorId: "user_123",
 *       action: "client.create",
 *       resourceType: "client",
 *       resourceId: "client_456",
 *     });
 *
 * Wire a real store (Postgres, DynamoDB, etc.) in production by
 * implementing the ``AuditStore`` interface.
 */

export const VERSION = "0.1.0";

export { hashEntry, verifyChain } from "./hash.js";
export { AuditLogger, type AuditLoggerOptions } from "./logger.js";
export { InMemoryAuditStore, readonlyView, type AuditStore } from "./store.js";
export type { AuditEntry, AuditQuery, NewAuditEntry } from "./types.js";
