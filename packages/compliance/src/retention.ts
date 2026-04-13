// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * Retention-policy calculator.
 *
 * Given a set of policies and a record event (creation date, last
 * activity, etc.), compute the retention deadline. Helpers also flag
 * records that are past retention (safe to delete) or within a grace
 * window (must not be deleted yet).
 *
 * Default policies ship minimum values aligned with SEC Rule 204-2
 * (5 years for advisory records, with the first two at the firm's
 * principal office). Extend or override for your firm's retention
 * program.
 */

import type { RetentionCategory, RetentionPolicy } from "./types.js";

// ──────────────────────────────────────────────────────────────────────
// Default policies — SEC Rule 204-2 minimums. NOT legal advice.
// ──────────────────────────────────────────────────────────────────────

export const DEFAULT_POLICIES: readonly RetentionPolicy[] = [
  {
    id: "advisory_record_5y",
    category: "advisory_record",
    retentionYears: 5,
    triggerEvent: "last_activity",
    regulatoryBasis: "SEC Rule 204-2(a)",
    description: "General advisory records including client agreements, ADV, and correspondence.",
  },
  {
    id: "audit_log_7y",
    category: "audit_log",
    retentionYears: 7,
    triggerEvent: "creation",
    regulatoryBasis: "SEC Rule 204-2(e)(1) / best practice",
    description: "Immutable audit logs of system actions.",
  },
  {
    id: "client_communication_5y",
    category: "client_communication",
    retentionYears: 5,
    triggerEvent: "creation",
    regulatoryBasis: "SEC Rule 204-2(a)(7)",
    description: "Written communications received and sent.",
  },
  {
    id: "marketing_5y",
    category: "marketing",
    retentionYears: 5,
    triggerEvent: "creation",
    regulatoryBasis: "SEC Rule 206(4)-1 / 204-2(a)(11)",
    description: "Advertisements and testimonial-related records.",
  },
  {
    id: "performance_5y",
    category: "performance",
    retentionYears: 5,
    triggerEvent: "creation",
    regulatoryBasis: "SEC Rule 204-2(a)(16)",
    description: "Performance calculation support.",
  },
  {
    id: "pii_5y",
    category: "pii",
    retentionYears: 5,
    triggerEvent: "client_termination",
    description: "PII tied to client records — retain per advisory minimum, then purge.",
  },
  {
    id: "tax_7y",
    category: "tax",
    retentionYears: 7,
    triggerEvent: "creation",
    regulatoryBasis: "IRS recommendation",
    description: "Tax-related correspondence and workpapers.",
  },
];

// ──────────────────────────────────────────────────────────────────────
// Calculator
// ──────────────────────────────────────────────────────────────────────

export class RetentionCalculator {
  private readonly policies: Map<RetentionCategory, RetentionPolicy>;

  constructor(policies: readonly RetentionPolicy[] = DEFAULT_POLICIES) {
    this.policies = new Map();
    for (const p of policies) {
      // Last registered wins — callers can layer overrides.
      this.policies.set(p.category, p);
    }
  }

  /** Policy for a category, or undefined if none registered. */
  policyFor(category: RetentionCategory): RetentionPolicy | undefined {
    return this.policies.get(category);
  }

  /**
   * Compute the retention deadline for an event.
   *
   * Returns ``undefined`` when no policy is registered for the category.
   * The returned date is the earliest date after which the record may
   * be purged, subject to any legal hold.
   */
  retentionDeadline(
    category: RetentionCategory,
    eventAt: Date | string,
  ): Date | undefined {
    const policy = this.policies.get(category);
    if (!policy) return undefined;
    const base = eventAt instanceof Date ? eventAt : new Date(eventAt);
    const deadline = new Date(base);
    deadline.setUTCFullYear(deadline.getUTCFullYear() + policy.retentionYears);
    return deadline;
  }

  /** Is a record eligible for deletion as of ``now``? */
  isPurgeable(
    category: RetentionCategory,
    eventAt: Date | string,
    now: Date = new Date(),
  ): boolean {
    const deadline = this.retentionDeadline(category, eventAt);
    if (!deadline) return false;
    return now >= deadline;
  }

  /** Days remaining until a record reaches retention. Negative = past deadline. */
  daysUntilPurgeable(
    category: RetentionCategory,
    eventAt: Date | string,
    now: Date = new Date(),
  ): number | undefined {
    const deadline = this.retentionDeadline(category, eventAt);
    if (!deadline) return undefined;
    const ms = deadline.getTime() - now.getTime();
    return Math.floor(ms / (1000 * 60 * 60 * 24));
  }

  /** All registered policies. */
  list(): RetentionPolicy[] {
    return [...this.policies.values()];
  }
}
