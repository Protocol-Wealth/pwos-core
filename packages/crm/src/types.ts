// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * Core CRM types for advisor relationship management.
 *
 * Covers contacts, households, interactions, opportunities, and tasks
 * — the usual nouns of an advisor CRM. The types are intentionally
 * light-weight Pydantic-style dataclasses; consumers map them to
 * whatever storage schema they use (Drizzle / Prisma / Postgres raw).
 *
 * No vendor SDK types — if you want Wealthbox or Redtail adapters,
 * write a thin translator next to the vendor client.
 */

// ──────────────────────────────────────────────────────────────────────
// Contacts & households
// ──────────────────────────────────────────────────────────────────────

export type ContactKind = "prospect" | "client" | "past_client" | "lead" | "professional" | "other";

export type LifecycleStage =
  | "aware"
  | "interested"
  | "discovery"
  | "proposal"
  | "onboarding"
  | "active"
  | "review"
  | "disengaged"
  | "terminated";

/** Relationship someone has to a household — spouse, child, etc. */
export type RelationshipType =
  | "primary"
  | "spouse"
  | "partner"
  | "child"
  | "parent"
  | "sibling"
  | "trust_beneficiary"
  | "business_partner"
  | "professional_advisor"
  | "other";

export interface Contact {
  /** Stable identifier. */
  id: string;
  /** Legal first name. */
  firstName: string;
  /** Legal last name. */
  lastName: string;
  /** Preferred display name (used in letters, reports). */
  displayName?: string;
  /** Contact classification. */
  kind: ContactKind;
  /** Where in the relationship lifecycle. */
  lifecycleStage?: LifecycleStage;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** ISO-8601 last-activity timestamp — drives dormancy detection. */
  lastActivityAt?: string;
  /** Email / phone / address — treat as PII. */
  email?: string;
  phone?: string;
  /** Household this contact is linked to. */
  householdId?: string;
  /** Relationship within the household. */
  relationshipType?: RelationshipType;
  /** Free-form tags. */
  tags?: readonly string[];
  /** Arbitrary extension fields. */
  metadata?: Record<string, unknown>;
}

export interface Household {
  id: string;
  /** Household display name, usually "Lastname Family" or similar. */
  name: string;
  /** Primary contact id. */
  primaryContactId?: string;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** Total household AUM in USD (if tracked). */
  aum?: number;
  /** Free-form tags. */
  tags?: readonly string[];
  metadata?: Record<string, unknown>;
}

// ──────────────────────────────────────────────────────────────────────
// Interactions & opportunities
// ──────────────────────────────────────────────────────────────────────

export type InteractionChannel =
  | "email"
  | "phone"
  | "meeting"
  | "video"
  | "message"
  | "letter"
  | "note"
  | "system";

export type InteractionDirection = "inbound" | "outbound" | "internal";

export interface Interaction {
  id: string;
  /** Contact this interaction involved. */
  contactId: string;
  /** Household context, if applicable. */
  householdId?: string;
  /** ISO-8601 timestamp. */
  occurredAt: string;
  /** What channel the interaction used. */
  channel: InteractionChannel;
  /** Direction of the interaction. */
  direction: InteractionDirection;
  /** Short subject / title. */
  subject?: string;
  /** Longer body or transcript (treat as PII). */
  body?: string;
  /** Actor who logged the interaction. */
  loggedBy?: string;
  /** Free-form tags. */
  tags?: readonly string[];
  metadata?: Record<string, unknown>;
}

export type OpportunityStage =
  | "lead"
  | "qualifying"
  | "discovery"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost"
  | "abandoned";

export interface Opportunity {
  id: string;
  title: string;
  contactId?: string;
  householdId?: string;
  /** Estimated annual revenue / AUM / fee — format is caller's choice. */
  value?: number;
  stage: OpportunityStage;
  /** ISO-8601 expected close date. */
  expectedCloseAt?: string;
  /** ISO-8601 actual close date once won/lost. */
  closedAt?: string;
  owner?: string;
  tags?: readonly string[];
  metadata?: Record<string, unknown>;
}

// ──────────────────────────────────────────────────────────────────────
// Tasks
// ──────────────────────────────────────────────────────────────────────

export type TaskStatus = "open" | "in_progress" | "blocked" | "done" | "canceled";

export interface CrmTask {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  /** ISO-8601 due date. */
  dueAt?: string;
  /** ISO-8601 completion timestamp. */
  completedAt?: string;
  assignee?: string;
  contactId?: string;
  householdId?: string;
  opportunityId?: string;
  priority?: "low" | "medium" | "high" | "critical";
  tags?: readonly string[];
  metadata?: Record<string, unknown>;
}
