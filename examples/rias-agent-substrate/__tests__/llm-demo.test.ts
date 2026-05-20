// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * Tests for composeAndCallLLM — the full demo flow that closes the loop
 * between three-tier context composition + a real LLM call + the
 * 5-audit-row trail.
 *
 * Hermetic by construction — uses a mock LLMClient + in-memory stores +
 * in-memory audit store. No network calls.
 */

import { AuditLogger, InMemoryAuditStore } from "@protocolwealthos/audit-log";
import type { ResponseLike } from "@protocolwealthos/ai-guardrails";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  composeAndCallLLM,
  composeSystemPrompt,
  InMemoryAdvisorMemoryStore,
  InMemoryClientMemoryStore,
  InMemoryFirmMemorySource,
  RIAAgentSubstrate,
  type LLMClient,
} from "../src/index.js";

const ADVISOR_ID = "advisor_test_1";
const SESSION_ID = "sess_test_1";
const CLIENT_ID = "client_test_1";
const MODEL = "claude-haiku-4-5-20251001";

function makeMockLLM(opts?: {
  text?: string;
  inputTokens?: number;
  outputTokens?: number;
  throwError?: Error;
}): LLMClient {
  return {
    call: vi.fn(async () => {
      if (opts?.throwError) throw opts.throwError;
      const text = opts?.text ?? "Acknowledged the advisor's context.";
      const raw: ResponseLike = {
        content: [{ type: "text", text }],
        usage: {
          input_tokens: opts?.inputTokens ?? 142,
          output_tokens: opts?.outputTokens ?? 18,
        },
      };
      return { text, raw, latencyMs: 87 };
    }),
  };
}

function makeSubstrate() {
  const audit = new AuditLogger({ store: new InMemoryAuditStore() });
  const substrate = new RIAAgentSubstrate({
    audit,
    clientMemoryStore: new InMemoryClientMemoryStore([
      {
        clientId: CLIENT_ID,
        goals: ["Retire by 60", "Fund grandchildren's education"],
        decisionHistory: [
          {
            action: "portfolio.rebalance.executed",
            timestamp: "2026-04-15T14:22:00Z",
            advisorId: ADVISOR_ID,
            rationale: "Quarterly review surfaced 12% drift in equity weight",
          },
        ],
        communicationStyle: "prefers email; quarterly cadence",
        piiTags: new Map([
          ["communicationStyle", "pii.low"],
          ["goals[1]", "pii.medium"],
        ]),
      },
    ]),
    advisorMemoryStore: new InMemoryAdvisorMemoryStore(),
    firmMemorySource: new InMemoryFirmMemorySource({
      policies: [{ slug: "ai-governance", title: "AI Governance Policy", body: "..." }],
      adrs: [{ slug: "ADR-PII-tagging", title: "PII Tagging at Ingestion", status: "ACCEPTED" }],
      ccoApprovals: [
        {
          slug: "marketing-rule-bundle-2026-05-19",
          title: "Marketing Rule Bundle 2026-05-19",
          approvedAt: "2026-05-19T15:25:00Z",
        },
      ],
      generatedAt: "2026-05-19T20:00:00Z",
    }),
    resolveAuthorizedClients: async () => new Set([CLIENT_ID]),
  });
  return { substrate, audit };
}

describe("composeAndCallLLM — happy path", () => {
  let substrate: RIAAgentSubstrate;
  let audit: AuditLogger;
  let llm: LLMClient;

  beforeEach(() => {
    ({ substrate, audit } = makeSubstrate());
    llm = makeMockLLM();
  });

  it("writes 5 audit rows in order: 4 from compose + 1 from LLM call", async () => {
    await composeAndCallLLM(
      {
        chain: { advisorId: ADVISOR_ID, sessionId: SESSION_ID, clientId: CLIENT_ID },
        userMessage: "Suggest two questions to ask in the next client meeting.",
        model: MODEL,
        modelAlias: "lightweight",
        maxTokens: 1024,
      },
      { substrate, llm },
    );

    const rows = await audit.query({ resourceType: "agent_session" });
    const actions = rows
      .map((r) => r.action)
      .sort((a, b) => a.localeCompare(b));
    expect(actions).toEqual([
      "agent.context.advisor_memory_read",
      "agent.context.chain_established",
      "agent.context.client_memory_read",
      "agent.context.firm_memory_read",
      "agent.llm.call_completed",
    ]);
  });

  it("returns the composed context + LLM result + audit row + audit entry id", async () => {
    const result = await composeAndCallLLM(
      {
        chain: { advisorId: ADVISOR_ID, sessionId: SESSION_ID, clientId: CLIENT_ID },
        userMessage: "What's the client's primary retirement goal?",
        model: MODEL,
        modelAlias: "lightweight",
        maxTokens: 1024,
      },
      { substrate, llm },
    );

    expect(result.context.clientMemory.clientId).toBe(CLIENT_ID);
    expect(result.context.principalChain.auditEntryId).toBeTruthy();
    expect(result.llmResult.text).toContain("Acknowledged");
    expect(result.llmAuditEntryId).toBeTruthy();
    expect(result.llmAuditRow.errorClass).toBeNull();
    expect(result.llmAuditRow.inputTokens).toBe(142);
    expect(result.llmAuditRow.outputTokens).toBe(18);
  });

  it("LLM-call audit row references the chain anchor in details + propagates trace_id", async () => {
    const result = await composeAndCallLLM(
      {
        chain: { advisorId: ADVISOR_ID, sessionId: SESSION_ID, clientId: CLIENT_ID },
        userMessage: "summary",
        model: MODEL,
        modelAlias: "lightweight",
        maxTokens: 1024,
      },
      { substrate, llm },
    );

    const callRow = (await audit.query({ action: "agent.llm.call_completed" }))[0];
    expect(callRow).toBeDefined();
    const details = callRow.details as {
      anchor_audit_id?: string;
      client_id?: string;
      ai_call_audit_row?: { traceId?: string };
    };
    expect(details.anchor_audit_id).toBe(result.context.principalChain.auditEntryId);
    expect(details.client_id).toBe(CLIENT_ID);
    expect(details.ai_call_audit_row?.traceId).toBe(result.context.principalChain.auditEntryId);
  });
});

describe("composeAndCallLLM — failure modes", () => {
  it("propagates principal-chain validation error without making LLM call or writing LLM audit row", async () => {
    const { substrate, audit } = makeSubstrate();
    const llm = makeMockLLM();

    await expect(
      composeAndCallLLM(
        {
          chain: { advisorId: ADVISOR_ID, sessionId: SESSION_ID, clientId: "client_unauthorized" },
          userMessage: "should not happen",
          model: MODEL,
          modelAlias: "lightweight",
          maxTokens: 1024,
        },
        { substrate, llm },
      ),
    ).rejects.toThrow(/not authorized for client/);

    expect(llm.call).not.toHaveBeenCalled();
    const llmRows = await audit.query({ action: "agent.llm.call_completed" });
    expect(llmRows).toHaveLength(0);
  });

  it("writes an LLM-call audit row with errorClass + rethrows on LLM call failure", async () => {
    const { substrate, audit } = makeSubstrate();
    const llmErr = new Error("LLM upstream unavailable");
    const llm = makeMockLLM({ throwError: llmErr });

    await expect(
      composeAndCallLLM(
        {
          chain: { advisorId: ADVISOR_ID, sessionId: SESSION_ID, clientId: CLIENT_ID },
          userMessage: "anything",
          model: MODEL,
          modelAlias: "lightweight",
          maxTokens: 1024,
        },
        { substrate, llm },
      ),
    ).rejects.toThrow(/LLM upstream unavailable/);

    const callRow = (await audit.query({ action: "agent.llm.call_completed" }))[0];
    expect(callRow).toBeDefined();
    const details = callRow.details as {
      ai_call_audit_row?: { errorClass?: string };
    };
    expect(details.ai_call_audit_row?.errorClass).toBe("llm_call_failed");
  });
});

describe("composeSystemPrompt", () => {
  it("includes firm + advisor + client sections in fixed order", () => {
    const ctx = {
      firmMemory: {
        policies: [{ slug: "p", title: "Policy P", body: "" }],
        adrs: [{ slug: "a", title: "ADR A", status: "ACCEPTED" as const }],
        ccoApprovals: [{ slug: "c", title: "Approval C", approvedAt: "2026-05-19T00:00:00Z" }],
        generatedAt: "2026-05-19T00:00:00Z",
      },
      advisorMemory: { advisorId: ADVISOR_ID, entries: new Map() },
      clientMemory: {
        clientId: CLIENT_ID,
        goals: ["Retire"],
        decisionHistory: [],
        communicationStyle: null,
        piiTags: new Map(),
      },
      principalChain: {
        advisorId: ADVISOR_ID,
        sessionId: SESSION_ID,
        clientId: CLIENT_ID,
        auditEntryId: "audit_abc",
      },
    };
    const prompt = composeSystemPrompt(ctx);
    const firmIdx = prompt.indexOf("# Firm context");
    const advisorIdx = prompt.indexOf("# Advisor context");
    const clientIdx = prompt.indexOf("# Client context");
    expect(firmIdx).toBeGreaterThanOrEqual(0);
    expect(advisorIdx).toBeGreaterThan(firmIdx);
    expect(clientIdx).toBeGreaterThan(advisorIdx);
    expect(prompt).toContain("Policy P");
    expect(prompt).toContain("ADR A");
    expect(prompt).toContain("Retire");
  });
});
