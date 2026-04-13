// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * Core compliance types for SEC-registered investment advisers.
 *
 * These shapes mirror the recordkeeping requirements of SEC Rule 204-2
 * (Books and Records) and the oversight requirements of SEC Rule
 * 206(4)-7 (Compliance Rule). The package is intentionally
 * storage-agnostic — persistence happens in caller-supplied stores.
 */

// ──────────────────────────────────────────────────────────────────────
// Retention
// ──────────────────────────────────────────────────────────────────────

/** Category of record governed by a retention policy. */
export type RetentionCategory =
  | "advisory_record"
  | "audit_log"
  | "client_communication"
  | "internal_communication"
  | "pii"
  | "performance"
  | "marketing"
  | "financial"
  | "regulatory_filing"
  | "tax"
  | "other";

/** Retention policy for a category of records. */
export interface RetentionPolicy {
  /** Stable identifier. */
  id: string;
  /** Category this policy applies to. */
  category: RetentionCategory;
  /** Minimum retention period in years. */
  retentionYears: number;
  /** Start of the retention window — typically "creation" or "last_activity". */
  triggerEvent: "creation" | "last_activity" | "client_termination" | "policy_effective_date";
  /** Regulatory citation justifying this policy (SEC rule number, etc.). */
  regulatoryBasis?: string;
  /** Optional description of what this covers. */
  description?: string;
}

// ──────────────────────────────────────────────────────────────────────
// AI Tool Inventory (SEC examiners increasingly ask for this)
// ──────────────────────────────────────────────────────────────────────

/** Access tier a tool is available at — matches @protocolwealthos/mcp-tools ToolTier. */
export type ToolAccessTier = "public" | "advisor" | "client_filtered" | "sensitive";

/** Record describing one AI tool the firm uses. */
export interface AIInventoryEntry {
  /** Stable tool identifier. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Short description of what the tool does. */
  description: string;
  /** Tier the tool runs at. */
  tier: ToolAccessTier;
  /** Does the tool read PII? */
  readsPii: boolean;
  /** Does the tool write PII to persistent storage? */
  writesPii: boolean;
  /** External services this tool depends on (e.g. "Anthropic", "OpenAI"). */
  externalServices?: readonly string[];
  /** Data categories this tool accesses. */
  dataCategories?: readonly string[];
  /** Whether advisor review is required before output reaches clients. */
  requiresReview: boolean;
  /** ISO-8601 date the tool was added to the inventory. */
  addedAt: string;
  /** Free-form extension field. */
  notes?: string;
}

// ──────────────────────────────────────────────────────────────────────
// PII Incidents
// ──────────────────────────────────────────────────────────────────────

/** Severity buckets for PII incidents. */
export type IncidentSeverity = "low" | "medium" | "high" | "critical";

/** Record of a detected PII exposure. */
export interface PIIIncident {
  id: string;
  /** ISO-8601 timestamp of detection. */
  detectedAt: string;
  /** Actor whose action exposed the PII. */
  actorId?: string;
  /** What happened, in plain English. */
  description: string;
  /** Severity classification. */
  severity: IncidentSeverity;
  /** Tool or surface that exposed the PII. */
  source?: string;
  /** Was this automatically blocked, redacted, or did it reach an AI/external system? */
  disposition: "blocked" | "redacted" | "warned" | "exposed";
  /** Number of records affected. */
  affectedRecords?: number;
  /** Was this reported to clients / regulators? */
  reportedToClient?: boolean;
  reportedToRegulator?: boolean;
  /** Remediation taken. */
  remediation?: string;
}

// ──────────────────────────────────────────────────────────────────────
// Compliance Calendar
// ──────────────────────────────────────────────────────────────────────

/** Recurrence pattern for a calendar event. */
export type RecurrencePattern =
  | { type: "once" }
  | { type: "annual"; month: number; day: number }
  | { type: "quarterly"; offsetDays: number }
  | { type: "monthly"; day: number }
  | { type: "custom"; description: string };

/** A recurring compliance obligation. */
export interface ComplianceEvent {
  id: string;
  /** Short title — appears in notifications. */
  title: string;
  /** Detail — what's required, who's responsible. */
  description: string;
  /** Regulatory citation or internal policy reference. */
  reference?: string;
  /** When this falls due. */
  recurrence: RecurrencePattern;
  /** Who owns the obligation. */
  owner?: string;
  /** Priority level. */
  priority: "low" | "medium" | "high" | "critical";
  /** ISO-8601 date the event was last completed. */
  lastCompletedAt?: string;
}

// ──────────────────────────────────────────────────────────────────────
// Policy & Vendor Review
// ──────────────────────────────────────────────────────────────────────

/** Review status of a written policy. */
export type PolicyStatus = "current" | "review_due" | "overdue" | "draft" | "retired";

export interface PolicyReview {
  id: string;
  policyName: string;
  /** How often this policy must be reviewed (in months). */
  reviewCadenceMonths: number;
  /** ISO-8601 date of the last review. */
  lastReviewedAt?: string;
  /** ISO-8601 effective date of the current version. */
  effectiveDate?: string;
  /** Current version string (e.g., "v3.1"). */
  version?: string;
  owner?: string;
  status: PolicyStatus;
}

export interface VendorAssessment {
  id: string;
  vendorName: string;
  /** What the vendor provides. */
  servicesProvided: string;
  /** Types of data the vendor handles. */
  dataCategories: readonly string[];
  /** How critical the vendor is to operations. */
  criticality: "low" | "medium" | "high" | "critical";
  /** Last risk review date (ISO-8601). */
  lastReviewedAt?: string;
  /** How often the vendor must be reviewed (in months). */
  reviewCadenceMonths: number;
  /** SOC 2 / ISO 27001 / similar attestations on file? */
  attestationsOnFile?: readonly string[];
  /** Whether a DPA (data processing agreement) is signed. */
  dpaSigned?: boolean;
  /** Status: "current", "review_due", "overdue". */
  status: "current" | "review_due" | "overdue";
}

// ──────────────────────────────────────────────────────────────────────
// Books & Records Export (SEC Rule 204-2)
// ──────────────────────────────────────────────────────────────────────

/** Metadata wrapped around an exam-ready export. */
export interface BooksAndRecordsManifest {
  version: string;
  /** ISO-8601 timestamp the export was generated. */
  generatedAt: string;
  /** Who requested it. */
  requestedBy?: string;
  /** Coverage window. */
  periodStart: string;
  periodEnd: string;
  /** Counts by section, for examiner review. */
  counts: Record<string, number>;
  /** Firm identity fields. */
  firm?: {
    name: string;
    crd?: string;
    sec?: string;
    state?: string;
  };
  /** SHA-256 hashes of each section payload — for chain-of-custody verification. */
  sectionHashes?: Record<string, string>;
}

/** A complete Books-and-Records export bundle. */
export interface BooksAndRecordsExport {
  manifest: BooksAndRecordsManifest;
  /** Named payload sections — each is a list of records of any shape. */
  sections: Record<string, unknown[]>;
}
