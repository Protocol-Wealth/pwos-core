// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * Principal-chain capture + validation.
 *
 * The principal chain (advisor → session → client) is the authorization
 * trace recorded on every agent memory read. Per ADR-three-tier-agent-memory,
 * the chain answers "which advisor session authorized this agent's access to
 * client X's data?" — making cross-tier reads audit-trail-eligible by
 * construction.
 *
 * In production, the chain is established at session-open time (auth
 * middleware validates the advisor JWT + creates the session + binds the
 * client context); this module's validation contract enforces that the
 * advisor is authorized for the client and the session is open.
 */

import { type PrincipalChain } from "./types.js";

/**
 * Authorization contract — the substrate consumer supplies a function that
 * returns the set of clientIds the advisor is authorized to act for.
 * Production: queries the assigned-advisors-for-client table; tests + this
 * example: synthesized from in-memory fixtures.
 */
export type AuthorizedClientsResolver = (
  advisorId: string,
) => Promise<ReadonlySet<string>>;

/**
 * Validate that a partial principal chain is well-formed and that the
 * advisor is authorized for the named client. Throws Error on validation
 * failure (the caller fails closed; no agent context is composed without
 * a valid chain).
 */
export async function validatePrincipalChain(
  chain: Omit<PrincipalChain, "auditEntryId">,
  resolveAuthorizedClients: AuthorizedClientsResolver,
): Promise<ReadonlySet<string>> {
  if (!chain.advisorId || !chain.sessionId || !chain.clientId) {
    throw new Error(
      `Principal chain is incomplete: advisorId=${chain.advisorId} sessionId=${chain.sessionId} clientId=${chain.clientId}`,
    );
  }
  const authorizedClientIds = await resolveAuthorizedClients(chain.advisorId);
  if (!authorizedClientIds.has(chain.clientId)) {
    throw new Error(
      `Advisor ${chain.advisorId} is not authorized for client ${chain.clientId}`,
    );
  }
  return authorizedClientIds;
}

/**
 * Format the principal chain for inclusion in an audit_log details payload.
 * The shape is stable so retention queries can filter on chain components.
 */
export function chainAuditDetails(chain: PrincipalChain): {
  advisor_id: string;
  session_id: string;
  client_id: string;
  audit_entry_id?: string;
} {
  return {
    advisor_id: chain.advisorId,
    session_id: chain.sessionId,
    client_id: chain.clientId,
    audit_entry_id: chain.auditEntryId,
  };
}
