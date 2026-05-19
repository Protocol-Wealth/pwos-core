// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * RIAAgentSubstrate — composes the three-tier agent memory architecture.
 *
 * The composer takes a principal chain (advisor → session → client) and
 * builds an AgentContext by reading from all three memory tiers in fixed
 * order: per-firm (broadest, read-only) → per-advisor (advisor scope) →
 * per-client (most-scoped, principal-chain-authorized).
 *
 * Every composition writes an audit_log row capturing which tiers were
 * accessed and which principal chain authorized the access. The composer's
 * own context-assembly is audit-trail-eligible by construction.
 */

import { AuditLogger } from "@protocolwealthos/audit-log";

import {
  type AdvisorMemoryStore,
  type ClientMemoryStore,
  type FirmMemorySource,
} from "./memory-stores.js";
import {
  type AuthorizedClientsResolver,
  validatePrincipalChain,
} from "./principal-chain.js";
import { type AgentContext, type PrincipalChain } from "./types.js";

/** Construction-time dependencies for the RIA agent substrate composer. */
export interface RIAAgentSubstrateOptions {
  readonly audit: AuditLogger;
  readonly clientMemoryStore: ClientMemoryStore;
  readonly advisorMemoryStore: AdvisorMemoryStore;
  readonly firmMemorySource: FirmMemorySource;
  /**
   * Resolver returning the set of clientIds an advisor is authorized to act
   * for. Production: queries the assigned-advisors-for-client table.
   */
  readonly resolveAuthorizedClients: AuthorizedClientsResolver;
}

/** Input to buildAgentContext — the principal chain without the audit_log back-reference. */
export type AgentContextRequest = Omit<PrincipalChain, "auditEntryId">;

/**
 * The composer. One instance per application boundary; the three stores +
 * audit logger + authorization resolver are injected so the composer itself
 * is storage-agnostic and framework-agnostic.
 */
export class RIAAgentSubstrate {
  private readonly opts: RIAAgentSubstrateOptions;

  constructor(opts: RIAAgentSubstrateOptions) {
    this.opts = opts;
  }

  /**
   * Compose an AgentContext for a single agent session turn. The composition
   * is **always in this order**: firm → advisor → client. Every read writes
   * an audit_log row capturing which tier was accessed and the principal
   * chain that authorized it.
   *
   * Failure modes:
   * - Invalid principal chain (missing fields, advisor not authorized for
   *   client) → throws Error; no context returned; no client memory leaked.
   * - Per-advisor or per-client store unauthorized read → UnauthorizedMemoryAccess
   *   propagated to caller; partial context is NOT returned.
   */
  async buildAgentContext(request: AgentContextRequest): Promise<AgentContext> {
    const authorizedClientIds = await validatePrincipalChain(
      request,
      this.opts.resolveAuthorizedClients,
    );

    // Write the chain-establishment audit row first. The returned id is
    // referenced by subsequent per-tier audit rows so retention queries can
    // reassemble the composition from its anchor row.
    const chainEntry = await this.opts.audit.log({
      actorId: request.advisorId,
      action: "agent.context.chain_established",
      resourceType: "agent_session",
      resourceId: request.sessionId,
      details: {
        client_id: request.clientId,
        memory_tiers_planned: ["firm", "advisor", "client"],
      },
    });

    const principalChain: PrincipalChain = {
      advisorId: request.advisorId,
      sessionId: request.sessionId,
      clientId: request.clientId,
      auditEntryId: chainEntry.id,
    };

    // Tier 1 — per-firm. Read-only derived view; no authorization gate
    // (per-firm content is firm-wide public substrate by construction).
    const firmMemory = await this.opts.firmMemorySource.read();
    await this.opts.audit.log({
      actorId: request.advisorId,
      action: "agent.context.firm_memory_read",
      resourceType: "agent_session",
      resourceId: request.sessionId,
      details: {
        memory_tier: "firm",
        generated_at: firmMemory.generatedAt,
        anchor_audit_id: chainEntry.id,
      },
    });

    // Tier 2 — per-advisor. advisor_id-RLS at the production database layer;
    // here enforced via the AdvisorMemoryStore contract.
    const advisorMemory = await this.opts.advisorMemoryStore.readForAdvisor(
      request.advisorId,
      request.advisorId,
    );
    await this.opts.audit.log({
      actorId: request.advisorId,
      action: "agent.context.advisor_memory_read",
      resourceType: "agent_session",
      resourceId: request.sessionId,
      details: {
        memory_tier: "advisor",
        entry_count: advisorMemory.entries.size,
        anchor_audit_id: chainEntry.id,
      },
    });

    // Tier 3 — per-client. RLS + principal-chain authorization. The
    // authorizedClientIds set from validatePrincipalChain is the canonical
    // authorization scope; pass-through to the store enforces the contract.
    const clientMemory = await this.opts.clientMemoryStore.readForClient(
      request.clientId,
      authorizedClientIds,
    );
    await this.opts.audit.log({
      actorId: request.advisorId,
      action: "agent.context.client_memory_read",
      resourceType: "agent_session",
      resourceId: request.sessionId,
      details: {
        memory_tier: "client",
        client_id: request.clientId,
        decision_count: clientMemory.decisionHistory.length,
        anchor_audit_id: chainEntry.id,
      },
    });

    return {
      firmMemory,
      advisorMemory,
      clientMemory,
      principalChain,
    };
  }
}
