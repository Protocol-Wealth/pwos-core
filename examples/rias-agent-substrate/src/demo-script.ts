// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * Runnable demo script — wires composeAndCallLLM against a real
 * @anthropic-ai/sdk call when ANTHROPIC_API_KEY is present, OR against a
 * deterministic mock client when the API key is absent.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... pnpm --filter @protocolwealthos-examples/rias-agent-substrate run demo
 *
 * Output: prints the composed system prompt + the model response + the
 * 5 audit-log rows that landed (with hashes, action verbs, and anchor
 * references). This is the canonical demonstration of the three-tier
 * agent memory architecture closing the full loop — the artifact that
 * promotes the ADR DRAFT → ACCEPTED + Pattern #7 EMERGING → CANONICAL.
 */

import { AuditLogger, InMemoryAuditStore } from "@protocolwealthos/audit-log";

import {
  AnthropicLLMClient,
  composeAndCallLLM,
  InMemoryAdvisorMemoryStore,
  InMemoryClientMemoryStore,
  InMemoryFirmMemorySource,
  RIAAgentSubstrate,
  type LLMClient,
} from "./index.js";

const ADVISOR_ID = "demo_advisor_001";
const SESSION_ID = "demo_sess_001";
const CLIENT_ID = "demo_client_001";
const MODEL = "claude-haiku-4-5-20251001";

async function makeLLMClient(): Promise<LLMClient> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.log("[demo] ANTHROPIC_API_KEY not set — using deterministic mock LLM.");
    console.log("[demo] Set ANTHROPIC_API_KEY=sk-ant-... to make a real LLM call.\n");
    return {
      call: async () => ({
        text: "[mock] I'd suggest asking the client whether their retirement-age preference has shifted since the last review, and whether the grandchildren's education funding cadence still matches their current cash-flow expectations.",
        raw: {
          content: [{ type: "text", text: "[mock response]" }],
          usage: { input_tokens: 142, output_tokens: 38 },
        },
        latencyMs: 0,
      }),
    };
  }
  // Dynamic import so the SDK isn't a required dep until runtime needs it.
  const sdkModule = (await import("@anthropic-ai/sdk")) as {
    default?: unknown;
    Anthropic?: unknown;
  };
  const AnthropicCtor =
    (sdkModule.Anthropic as new (opts: { apiKey: string }) => unknown) ??
    (sdkModule.default as new (opts: { apiKey: string }) => unknown);
  if (!AnthropicCtor) {
    console.error("[demo] @anthropic-ai/sdk is installed but no Anthropic class was exported. Falling back to mock.");
    return {
      call: async () => ({
        text: "[mock]",
        raw: { content: [], usage: {} },
        latencyMs: 0,
      }),
    };
  }
  console.log("[demo] Using real Anthropic API client.\n");
  return new AnthropicLLMClient({
    AnthropicCtor: AnthropicCtor as never,
    clientOpts: { apiKey: key },
  });
}

async function main(): Promise<void> {
  const auditStore = new InMemoryAuditStore();
  const audit = new AuditLogger({ store: auditStore });

  const substrate = new RIAAgentSubstrate({
    audit,
    clientMemoryStore: new InMemoryClientMemoryStore([
      {
        clientId: CLIENT_ID,
        goals: ["Retire by 60", "Fund grandchildren's education", "Maintain quarterly review cadence"],
        decisionHistory: [
          {
            action: "portfolio.rebalance.executed",
            timestamp: "2026-04-15T14:22:00Z",
            advisorId: ADVISOR_ID,
            rationale: "Q1 review surfaced 12% drift in equity weight",
          },
          {
            action: "ips.section.updated",
            timestamp: "2026-04-22T10:08:00Z",
            advisorId: ADVISOR_ID,
            rationale: "Client requested more emphasis on bond ladder rationale",
          },
        ],
        communicationStyle: "prefers email; quarterly cadence",
        piiTags: new Map(),
      },
    ]),
    advisorMemoryStore: new InMemoryAdvisorMemoryStore(),
    firmMemorySource: new InMemoryFirmMemorySource({
      policies: [
        { slug: "ai-governance", title: "AI Governance Policy", body: "..." },
        { slug: "marketing-rule", title: "Marketing Rule §206(4)-1 Posture", body: "..." },
      ],
      adrs: [
        { slug: "ADR-PII-tagging", title: "PII Tagging at Ingestion (Pattern #1)", status: "ACCEPTED" },
        { slug: "ADR-three-tier-agent-memory", title: "Three-Tier Agent Memory (Pattern #7)", status: "DRAFT" },
      ],
      ccoApprovals: [
        { slug: "marketing-rule-bundle-2026-05-19", title: "Marketing Rule Bundle", approvedAt: "2026-05-19T15:25:00Z" },
      ],
      generatedAt: new Date().toISOString(),
    }),
    resolveAuthorizedClients: async () => new Set([CLIENT_ID]),
  });

  const llm = await makeLLMClient();

  console.log("=".repeat(72));
  console.log("rias-agent-substrate demo — composeAndCallLLM");
  console.log("=".repeat(72));
  console.log();
  console.log(`advisorId: ${ADVISOR_ID}`);
  console.log(`sessionId: ${SESSION_ID}`);
  console.log(`clientId:  ${CLIENT_ID}`);
  console.log(`model:     ${MODEL}`);
  console.log();

  const userMessage =
    "I have a quarterly review with this client tomorrow. What should I prioritize given the recent decisions?";

  console.log(`user: ${userMessage}`);
  console.log();

  const result = await composeAndCallLLM(
    {
      chain: { advisorId: ADVISOR_ID, sessionId: SESSION_ID, clientId: CLIENT_ID },
      userMessage,
      model: MODEL,
      modelAlias: "lightweight",
      maxTokens: 512,
    },
    { substrate, llm },
  );

  console.log("─".repeat(72));
  console.log("LLM response");
  console.log("─".repeat(72));
  console.log(result.llmResult.text);
  console.log();
  console.log(`latency: ${result.llmResult.latencyMs}ms`);
  console.log(`tokens:  input=${result.llmAuditRow.inputTokens} output=${result.llmAuditRow.outputTokens}`);
  console.log();

  console.log("─".repeat(72));
  console.log("Audit trail (5 rows landed)");
  console.log("─".repeat(72));
  const allRows = await audit.query({ resourceType: "agent_session" });
  // Newest-first by default — reverse so the chain anchor reads first
  for (const row of [...allRows].reverse()) {
    console.log(`  [${row.timestamp}] ${row.action} (id=${row.id.slice(0, 8)})`);
  }
  console.log();
  console.log("Chain anchor:", result.context.principalChain.auditEntryId);
  console.log("LLM-call audit id:", result.llmAuditEntryId);
  console.log("Prompt hash (sha256):", result.llmAuditRow.promptHash.slice(0, 16) + "...");
  console.log("Response hash (sha256):", (result.llmAuditRow.responseHash ?? "null").slice(0, 16) + "...");
  console.log();
  console.log("Demo complete.");
}

main().catch((err) => {
  console.error("Demo failed:", err);
  process.exitCode = 1;
});
