// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * Core types for the three-tier agent memory architecture.
 *
 * The three tiers — per-client, per-advisor, per-firm — correspond to three
 * legitimate memory scopes for an AI agent in an RIA context. Each tier has
 * distinct retention, access control, and audit requirements.
 *
 * These types are storage-agnostic. Production consumers implement the
 * MemoryStore / FirmMemorySource interfaces against their backing stores
 * (Postgres + RLS, DynamoDB, etc.) — the composition contract stays the same.
 */

/** PII taxonomy from ADR-PII-tagging.md. Field-level tags drive prompt-construction exclusion. */
export type PiiTag = "pii.high" | "pii.medium" | "pii.low";

/**
 * Per-client memory — one client across all advisor sessions touching that
 * relationship. Composed from existing client_profile + audit_log derivation;
 * no new schema. Fields tagged pii.high are excluded from LLM-bound payloads
 * unless an explicit pii_waiver authorizes the specific field path.
 */
export interface ClientMemory {
  readonly clientId: string;
  /** Stated goals + preferences (typically pii.medium). */
  readonly goals: ReadonlyArray<string>;
  /** Decision history derived from audit_log principal-chain queries scoped to clientId. */
  readonly decisionHistory: ReadonlyArray<ClientDecision>;
  /** Communication-style hints (pii.low; derived from audit_log event patterns). */
  readonly communicationStyle: string | null;
  /** Field-level PII tags. Map keys are JSON paths (e.g., "goals[0]" or "decisionHistory[2].rationale"). */
  readonly piiTags: ReadonlyMap<string, PiiTag>;
}

/** A single client-scoped decision record materialized from audit_log. */
export interface ClientDecision {
  readonly action: string;
  readonly timestamp: string;
  readonly advisorId: string;
  readonly rationale?: string;
}

/**
 * Per-advisor memory — one advisor across their book of business. New
 * advisor_memory table; advisor_id-RLS-scoped at the database layer.
 * Schema-light by design (memory_value is heterogeneous JSONB in production).
 */
export interface AdvisorMemory {
  readonly advisorId: string;
  /** Memory entries keyed by canonical namespace (methodology.* / workflow.* / expertise.* / preference.*). */
  readonly entries: ReadonlyMap<string, AdvisorMemoryEntry>;
}

/** A single advisor-memory key-value entry with audit-trail back-reference. */
export interface AdvisorMemoryEntry {
  readonly key: string;
  readonly value: unknown;
  readonly sourceAuditId?: string;
  readonly piiTags: ReadonlyArray<PiiTag>;
  readonly updatedAt: string;
}

/**
 * Per-firm memory — all advisors + all clients; firm-wide state.
 * Derived from version-controlled shared/ content (markdown ADRs, CCO
 * approvals, policies). No Postgres table; derived view regenerated at
 * deploy time.
 */
export interface FirmMemory {
  /** Current compliance policies (slug + title + body). */
  readonly policies: ReadonlyArray<FirmPolicy>;
  /** Architecture decision records index (slug + title + status). */
  readonly adrs: ReadonlyArray<FirmADR>;
  /** CCO-approved patterns (slug + title + approval date). */
  readonly ccoApprovals: ReadonlyArray<FirmCCOApproval>;
  /** Build-time derivation cursor for cache-invalidation reasoning. */
  readonly generatedAt: string;
}

export interface FirmPolicy {
  readonly slug: string;
  readonly title: string;
  readonly body: string;
}

export interface FirmADR {
  readonly slug: string;
  readonly title: string;
  readonly status: "DRAFT" | "ACCEPTED" | "DEPRECATED";
}

export interface FirmCCOApproval {
  readonly slug: string;
  readonly title: string;
  readonly approvedAt: string;
}

/**
 * Principal chain — advisor → session → client. Captures the authorization
 * trace for every agent memory read; written to audit_log at composition time.
 */
export interface PrincipalChain {
  readonly advisorId: string;
  readonly sessionId: string;
  readonly clientId: string;
  /** Audit-log entry id for the chain's own audit row. Populated by the substrate composer. */
  readonly auditEntryId?: string;
}

/**
 * Composed agent context — what the agent sees at LLM-call time. Tiers are
 * always composed in fixed order (firm → advisor → client) so the audit row
 * shape is uniform across all agent sessions.
 */
export interface AgentContext {
  readonly firmMemory: FirmMemory;
  readonly advisorMemory: AdvisorMemory;
  readonly clientMemory: ClientMemory;
  readonly principalChain: PrincipalChain;
}

/**
 * Authorization mismatch — raised when a memory read attempts to escape its
 * scope (e.g., an advisor querying another advisor's memory; an agent
 * querying client memory without principal-chain authorization).
 */
export class UnauthorizedMemoryAccess extends Error {
  constructor(
    /** What scope was attempted (e.g., "client" / "advisor"). */
    public readonly scope: "client" | "advisor" | "firm",
    /** The scope identifier the caller attempted to access (e.g., the clientId). */
    public readonly attemptedId: string,
    /** The scope identifier the principal is authorized for. */
    public readonly authorizedId: string,
  ) {
    super(
      `Unauthorized ${scope} memory access: principal authorized for ${authorizedId} but attempted ${attemptedId}`,
    );
    this.name = "UnauthorizedMemoryAccess";
  }
}
