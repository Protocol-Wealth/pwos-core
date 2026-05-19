// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * Memory store interfaces — storage-agnostic by design. Production consumers
 * implement these against Postgres (with RLS), DynamoDB, or any other backing
 * store. The in-memory implementations here are for testing + exploration.
 *
 * The contract for each store enforces scope at read time (the production
 * Postgres + RLS implementation enforces the same contract at the query
 * layer; this in-memory implementation enforces it via TypeScript). Callers
 * pass the principal's authorized scope; the store throws
 * UnauthorizedMemoryAccess on scope-mismatch.
 */

import {
  type AdvisorMemory,
  type AdvisorMemoryEntry,
  type ClientMemory,
  type FirmMemory,
  UnauthorizedMemoryAccess,
} from "./types.js";

/** Read interface for per-client memory. Storage implementation is consumer-supplied. */
export interface ClientMemoryStore {
  /**
   * Read the client memory for `clientId`. The principal's authorized
   * clientId scope MUST be passed for scope enforcement; in production this
   * is also enforced by Postgres RLS, but the interface enforces it at the
   * TypeScript layer so consumers cannot silently drop the authorization.
   */
  readForClient(
    clientId: string,
    authorizedClientIds: ReadonlySet<string>,
  ): Promise<ClientMemory>;
}

/** Read/write interface for per-advisor memory. Storage implementation is consumer-supplied. */
export interface AdvisorMemoryStore {
  /** Read per-advisor memory; throws UnauthorizedMemoryAccess if advisorId is not the authorized advisor. */
  readForAdvisor(advisorId: string, authorizedAdvisorId: string): Promise<AdvisorMemory>;
  /** Write a single memory entry; sourceAuditId back-references the seeding audit_log event. */
  writeEntry(
    advisorId: string,
    authorizedAdvisorId: string,
    entry: AdvisorMemoryEntry,
  ): Promise<void>;
}

/**
 * Read-only source for per-firm memory. No write interface — per-firm memory
 * is updated via version-control commits in the firm's shared/ repo, not via
 * API calls. The source's `read()` returns the derived view as of the last
 * build/deploy.
 */
export interface FirmMemorySource {
  read(): Promise<FirmMemory>;
}

// ─── In-memory implementations for testing + exploration ─────────────────

/**
 * In-memory ClientMemoryStore. Production consumers replace with a Postgres
 * implementation that wires RLS policies on client_profile + audit_log
 * principal-chain queries.
 */
export class InMemoryClientMemoryStore implements ClientMemoryStore {
  private readonly clients: Map<string, ClientMemory>;

  constructor(seed?: ReadonlyArray<ClientMemory>) {
    this.clients = new Map();
    if (seed) {
      for (const memory of seed) {
        this.clients.set(memory.clientId, memory);
      }
    }
  }

  async readForClient(
    clientId: string,
    authorizedClientIds: ReadonlySet<string>,
  ): Promise<ClientMemory> {
    if (!authorizedClientIds.has(clientId)) {
      throw new UnauthorizedMemoryAccess(
        "client",
        clientId,
        Array.from(authorizedClientIds).join(",") || "<none>",
      );
    }
    const memory = this.clients.get(clientId);
    if (!memory) {
      return {
        clientId,
        goals: [],
        decisionHistory: [],
        communicationStyle: null,
        piiTags: new Map(),
      };
    }
    return memory;
  }

  /** Test/seed helper — not part of the production interface. */
  upsert(memory: ClientMemory): void {
    this.clients.set(memory.clientId, memory);
  }
}

/**
 * In-memory AdvisorMemoryStore. Production consumers replace with a Postgres
 * implementation wiring advisor_memory table + advisor_id-RLS policy.
 */
export class InMemoryAdvisorMemoryStore implements AdvisorMemoryStore {
  private readonly advisors: Map<string, Map<string, AdvisorMemoryEntry>>;

  constructor() {
    this.advisors = new Map();
  }

  async readForAdvisor(
    advisorId: string,
    authorizedAdvisorId: string,
  ): Promise<AdvisorMemory> {
    if (advisorId !== authorizedAdvisorId) {
      throw new UnauthorizedMemoryAccess("advisor", advisorId, authorizedAdvisorId);
    }
    const entries = this.advisors.get(advisorId) ?? new Map<string, AdvisorMemoryEntry>();
    return {
      advisorId,
      entries: new Map(entries),
    };
  }

  async writeEntry(
    advisorId: string,
    authorizedAdvisorId: string,
    entry: AdvisorMemoryEntry,
  ): Promise<void> {
    if (advisorId !== authorizedAdvisorId) {
      throw new UnauthorizedMemoryAccess("advisor", advisorId, authorizedAdvisorId);
    }
    let entries = this.advisors.get(advisorId);
    if (!entries) {
      entries = new Map();
      this.advisors.set(advisorId, entries);
    }
    entries.set(entry.key, entry);
  }
}

/**
 * In-memory FirmMemorySource. Production consumers replace with a
 * build-time derivation step that reads shared/docs/compliance/* + ADR file
 * index + cco-approvals/*.md and materializes the FirmMemory shape.
 */
export class InMemoryFirmMemorySource implements FirmMemorySource {
  private readonly snapshot: FirmMemory;

  constructor(snapshot: Omit<FirmMemory, "generatedAt"> & { generatedAt?: string }) {
    this.snapshot = {
      policies: snapshot.policies,
      adrs: snapshot.adrs,
      ccoApprovals: snapshot.ccoApprovals,
      generatedAt: snapshot.generatedAt ?? new Date().toISOString(),
    };
  }

  async read(): Promise<FirmMemory> {
    return this.snapshot;
  }
}
