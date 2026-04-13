// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * @pwos/compliance
 *
 * Compliance primitives for SEC-registered investment advisers:
 * retention policy calculator, Books-and-Records (Rule 204-2) export
 * bundler with chain-of-custody hashes, AI tool inventory types, PII
 * incident classifier/summary, compliance calendar evaluator, and
 * policy/vendor review status helpers.
 *
 * The package is storage-agnostic — no database or HTTP framework is
 * assumed. Downstream projects assemble data from their stores and
 * pass arrays into these helpers.
 *
 * Defensive patent: USPTO #64/034,215.
 */

export const VERSION = "0.1.0";

export {
  type BundleOptions,
  BooksAndRecordsBundle,
  verifyBundle,
} from "./booksAndRecords.js";

export {
  type EvaluatedEvent,
  type EventStatus,
  classifyStatus,
  evaluateCalendar,
  nextOccurrence,
  upcomingOrOverdue,
} from "./calendar.js";

export {
  type IncidentSummary,
  classifySeverity,
  notifiableIncidents,
  summarize,
} from "./incidents.js";

export {
  policiesNeedingReview,
  policyStatus,
  vendorStatus,
  vendorsNeedingReview,
} from "./policyVendorReview.js";

export {
  DEFAULT_POLICIES,
  RetentionCalculator,
} from "./retention.js";

export type {
  AIInventoryEntry,
  BooksAndRecordsExport,
  BooksAndRecordsManifest,
  ComplianceEvent,
  IncidentSeverity,
  PIIIncident,
  PolicyReview,
  PolicyStatus,
  RecurrencePattern,
  RetentionCategory,
  RetentionPolicy,
  ToolAccessTier,
  VendorAssessment,
} from "./types.js";
