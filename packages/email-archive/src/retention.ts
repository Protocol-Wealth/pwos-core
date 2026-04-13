// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * Retention helpers for the email archive.
 *
 * SEC Rule 17a-4 requires 3-6 year retention depending on record class
 * (e.g. customer records 6 years, trade confirmations 6 years, internal
 * audit records 3 years). Investment advisers under Rule 204-2 face
 * minimum 5 years. Use ``@protocolwealthos/compliance.RetentionCalculator`` for
 * general retention math; this module is archive-specific: which
 * archived emails can be purged as of ``now``?
 */

import type { ArchivedEmail, ArchiveQuery } from "./types.js";

/** True iff the email may be purged (past retentionUntil AND not under legal hold). */
export function isPurgeable(email: ArchivedEmail, now: Date = new Date()): boolean {
  if (email.legalHold) return false;
  if (!email.retentionUntil) return false;
  return new Date(email.retentionUntil) <= now;
}

/** Return only the emails eligible for purge. */
export function purgeableEmails(
  emails: readonly ArchivedEmail[],
  now: Date = new Date(),
): ArchivedEmail[] {
  return emails.filter((e) => isPurgeable(e, now));
}

// ──────────────────────────────────────────────────────────────────────
// In-memory query evaluator (useful for tests + smoke demos).
// ──────────────────────────────────────────────────────────────────────

/** Evaluate ``query`` against ``emails`` in-memory. Not a replacement for a real search index. */
export function evaluateQuery(
  emails: readonly ArchivedEmail[],
  query: ArchiveQuery,
  now: Date = new Date(),
): ArchivedEmail[] {
  return emails.filter((e) => matchesQuery(e, query, now));
}

function matchesQuery(email: ArchivedEmail, q: ArchiveQuery, now: Date): boolean {
  if (q.from && email.from.address !== q.from) return false;
  if (q.to && !email.to.some((a) => a.address === q.to)) return false;
  if (q.subjectContains) {
    const needle = q.subjectContains.toLowerCase();
    if (!email.subject.toLowerCase().includes(needle)) return false;
  }
  if (q.classification && email.classification !== q.classification) return false;
  if (q.direction && email.direction !== q.direction) return false;
  if (q.threadId && email.threadId !== q.threadId) return false;
  if (q.occurredAfter && email.occurredAt < q.occurredAfter) return false;
  if (q.occurredBefore && email.occurredAt >= q.occurredBefore) return false;

  if (q.withinRetention && isPurgeable(email, now)) {
    if (!(q.includeLegalHolds && email.legalHold)) return false;
  }
  return true;
}
