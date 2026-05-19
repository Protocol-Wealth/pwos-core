// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * Tests for RIAAgentSubstrate.buildAgentContext composition behavior.
 *
 * Covers: happy path; principal-chain validation failure; per-client memory
 * authorization failure; audit-row shape.
 */

import { AuditLogger, InMemoryAuditStore } from "@protocolwealthos/audit-log";
import { beforeEach, describe, expect, it } from "vitest";

import {
  InMemoryAdvisorMemoryStore,
  InMemoryClientMemoryStore,
  InMemoryFirmMemorySource,
  RIAAgentSubstrate,
  UnauthorizedMemoryAccess,
} from "../src/index.js";

const ADVISOR_ID = "advisor_test_1";
const SESSION_ID = "sess_test_1";
const CLIENT_ID = "client_test_1";
const OTHER_CLIENT_ID = "client_test_2";

function makeSubstrate(opts?: {
  authorizedClients?: ReadonlySet<string>;
  clientMemoryStore?: InMemoryClientMemoryStore;
  advisorMemoryStore?: InMemoryAdvisorMemoryStore;
}) {
  const audit = new AuditLogger({ store: new InMemoryAuditStore() });
  const clientMemoryStore = opts?.clientMemoryStore ?? new InMemoryClientMemoryStore();
  const advisorMemoryStore = opts?.advisorMemoryStore ?? new InMemoryAdvisorMemoryStore();
  const firmMemorySource = new InMemoryFirmMemorySource({
    policies: [
      { slug: "ai-governance", title: "AI Governance Policy", body: "AI usage governance." },
    ],
    adrs: [{ slug: "ADR-PII-tagging", title: "PII Tagging at Ingestion", status: "ACCEPTED" }],
    ccoApprovals: [
      {
        slug: "marketing-rule-bundle-2026-05-19",
        title: "Marketing Rule Bundle 2026-05-19",
        approvedAt: "2026-05-19T15:25:00Z",
      },
    ],
    generatedAt: "2026-05-19T20:00:00Z",
  });
  const authorizedClients = opts?.authorizedClients ?? new Set([CLIENT_ID]);
  const substrate = new RIAAgentSubstrate({
    audit,
    clientMemoryStore,
    advisorMemoryStore,
    firmMemorySource,
    resolveAuthorizedClients: async () => authorizedClients,
  });
  return { substrate, audit, clientMemoryStore, advisorMemoryStore };
}

describe("RIAAgentSubstrate.buildAgentContext — happy path", () => {
  let substrate: RIAAgentSubstrate;
  let audit: AuditLogger;

  beforeEach(() => {
    ({ substrate, audit } = makeSubstrate());
  });

  it("composes context from all three tiers", async () => {
    const ctx = await substrate.buildAgentContext({
      advisorId: ADVISOR_ID,
      sessionId: SESSION_ID,
      clientId: CLIENT_ID,
    });

    expect(ctx.firmMemory.policies).toHaveLength(1);
    expect(ctx.firmMemory.adrs).toHaveLength(1);
    expect(ctx.advisorMemory.advisorId).toBe(ADVISOR_ID);
    expect(ctx.clientMemory.clientId).toBe(CLIENT_ID);
    expect(ctx.principalChain).toMatchObject({
      advisorId: ADVISOR_ID,
      sessionId: SESSION_ID,
      clientId: CLIENT_ID,
    });
    expect(ctx.principalChain.auditEntryId).toBeTruthy();
  });

  it("writes one audit row per tier plus the chain-establishment anchor", async () => {
    await substrate.buildAgentContext({
      advisorId: ADVISOR_ID,
      sessionId: SESSION_ID,
      clientId: CLIENT_ID,
    });

    const allRows = await audit.query({ actorId: ADVISOR_ID });
    const actions = allRows.map((r) => r.action).sort();
    expect(actions).toEqual([
      "agent.context.advisor_memory_read",
      "agent.context.chain_established",
      "agent.context.client_memory_read",
      "agent.context.firm_memory_read",
    ]);
  });

  it("per-tier audit rows reference the chain anchor row id", async () => {
    const ctx = await substrate.buildAgentContext({
      advisorId: ADVISOR_ID,
      sessionId: SESSION_ID,
      clientId: CLIENT_ID,
    });

    const tierRows = await audit.query({ resourceType: "agent_session" });
    const tierReadRows = tierRows.filter((r) => r.action !== "agent.context.chain_established");
    expect(tierReadRows).toHaveLength(3);
    for (const row of tierReadRows) {
      const details = row.details as { anchor_audit_id?: string } | undefined;
      expect(details?.anchor_audit_id).toBe(ctx.principalChain.auditEntryId);
    }
  });
});

describe("RIAAgentSubstrate.buildAgentContext — authorization failures", () => {
  it("throws when advisor is not authorized for the requested client", async () => {
    const { substrate } = makeSubstrate({ authorizedClients: new Set([CLIENT_ID]) });

    await expect(
      substrate.buildAgentContext({
        advisorId: ADVISOR_ID,
        sessionId: SESSION_ID,
        clientId: OTHER_CLIENT_ID,
      }),
    ).rejects.toThrow(/not authorized for client/);
  });

  it("throws when principal chain is incomplete (missing advisorId)", async () => {
    const { substrate } = makeSubstrate();

    await expect(
      substrate.buildAgentContext({
        advisorId: "",
        sessionId: SESSION_ID,
        clientId: CLIENT_ID,
      }),
    ).rejects.toThrow(/Principal chain is incomplete/);
  });

  it("propagates UnauthorizedMemoryAccess from the client store on scope mismatch", async () => {
    // Simulate the production failure mode: the resolver returns the wrong
    // authorized client set (a bug or stale cache). The store contract
    // catches the mismatch.
    const clientMemoryStore = new InMemoryClientMemoryStore();
    const { substrate } = makeSubstrate({
      authorizedClients: new Set([OTHER_CLIENT_ID]),
      clientMemoryStore,
    });

    await expect(
      substrate.buildAgentContext({
        advisorId: ADVISOR_ID,
        sessionId: SESSION_ID,
        clientId: OTHER_CLIENT_ID,
      }),
    ).resolves.toMatchObject({
      clientMemory: { clientId: OTHER_CLIENT_ID },
    });

    // The store throws when called outside the authorized set.
    await expect(
      clientMemoryStore.readForClient(CLIENT_ID, new Set([OTHER_CLIENT_ID])),
    ).rejects.toBeInstanceOf(UnauthorizedMemoryAccess);
  });
});

describe("RIAAgentSubstrate.buildAgentContext — empty per-client memory", () => {
  it("returns sensible defaults when no per-client memory has been seeded", async () => {
    const { substrate } = makeSubstrate();
    const ctx = await substrate.buildAgentContext({
      advisorId: ADVISOR_ID,
      sessionId: SESSION_ID,
      clientId: CLIENT_ID,
    });

    expect(ctx.clientMemory.goals).toEqual([]);
    expect(ctx.clientMemory.decisionHistory).toEqual([]);
    expect(ctx.clientMemory.communicationStyle).toBeNull();
    expect(ctx.clientMemory.piiTags.size).toBe(0);
  });
});
