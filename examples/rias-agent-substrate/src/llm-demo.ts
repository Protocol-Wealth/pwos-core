// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * composeAndCallLLM — the reference flow that closes the loop:
 *
 *   1. RIAAgentSubstrate.buildAgentContext() composes the three-tier
 *      memory context for an agent session turn. Writes 4 audit rows:
 *      chain_established (anchor) + per-tier memory_read rows.
 *   2. Compose a system prompt from the agent context.
 *   3. Make a real LLM call via the LLMClient interface.
 *   4. Build an AiCallAuditRow using @protocolwealthos/ai-guardrails'
 *      content-free hash-based pattern.
 *   5. Write a 5th audit-log row `agent.llm.call_completed` with the
 *      AiCallAuditRow shape in its details payload, referencing the
 *      chain-establishment anchor by id.
 *
 * This is the **first production consumer** path codified for the
 * three-tier agent memory architecture. When run against a non-stub
 * audit store + non-mock LLM client, the 5 audit rows persist + the
 * downstream architecture-explainer surfaces (e.g., pw-os-v2 chat
 * sidebar's Agent memory panel via /api/protected/chat/agent-memory-
 * context/:conversation_id) light up.
 *
 * Promotion-cycle anchor: the existence of this flow + at least one
 * runnable invocation (the demo script) promotes the canonical ADR from
 * DRAFT → ACCEPTED + Pattern #7 from EMERGING → CANONICAL.
 */

import { buildAuditRow, type ModelAlias } from "@protocolwealthos/ai-guardrails";

import { RIAAgentSubstrate, type AgentContextRequest } from "./agent-context-builder.js";
import type { LLMCallResult, LLMClient } from "./llm-client.js";
import type { AgentContext } from "./types.js";

export interface ComposeAndCallLLMRequest {
  /** Principal chain (advisor → session → client) for the composition. */
  readonly chain: AgentContextRequest;
  /** The advisor's user-facing prompt to the agent. */
  readonly userMessage: string;
  /** Concrete model id (e.g., "claude-haiku-4-5-20251001"). */
  readonly model: string;
  /** Model alias used at boot via @protocolwealthos/ai-guardrails resolver. */
  readonly modelAlias: ModelAlias;
  /** Hard cap on response length. */
  readonly maxTokens: number;
  /** Optional request id for audit correlation; auto-generated if omitted. */
  readonly requestId?: string;
}

export interface ComposeAndCallLLMResult {
  readonly context: AgentContext;
  readonly llmResult: LLMCallResult;
  /** The audit-row id for the LLM-call audit entry; references the chain anchor in details. */
  readonly llmAuditEntryId: string;
  /** The fully-built AiCallAuditRow embedded in the LLM-call audit entry's details. */
  readonly llmAuditRow: ReturnType<typeof buildAuditRow>;
}

export interface ComposeAndCallLLMDeps {
  readonly substrate: RIAAgentSubstrate;
  readonly llm: LLMClient;
}

/**
 * Compose three-tier agent context + make an LLM call + write the
 * complete audit-trail (5 rows: 4 from composeAgentContext + 1 for the
 * LLM call itself).
 *
 * Failure modes:
 * - Composition failure (invalid chain, unauthorized access) → propagated;
 *   no LLM call attempted; no LLM-call audit row written.
 * - LLM call failure → AiCallAuditRow written with errorClass populated;
 *   propagates the LLM error.
 */
export async function composeAndCallLLM(
  request: ComposeAndCallLLMRequest,
  deps: ComposeAndCallLLMDeps,
): Promise<ComposeAndCallLLMResult> {
  const context = await deps.substrate.buildAgentContext(request.chain);

  const system = composeSystemPrompt(context);
  const requestId = request.requestId ?? `req_${randomHex(16)}`;

  let llmResult: LLMCallResult;
  let errorClass: string | null = null;
  let raised: unknown = null;
  const start = Date.now();
  try {
    llmResult = await deps.llm.call({
      model: request.model,
      system,
      userMessage: request.userMessage,
      maxTokens: request.maxTokens,
    });
  } catch (err) {
    errorClass = "llm_call_failed";
    raised = err;
    llmResult = {
      text: "",
      raw: { content: [], usage: {} },
      latencyMs: Date.now() - start,
    };
  }

  const llmAuditRow = buildAuditRow({
    requestId,
    actorId: context.principalChain.advisorId,
    model: request.model,
    modelAlias: request.modelAlias,
    request: {
      system,
      messages: [{ role: "user", content: request.userMessage }],
      model: request.model,
      max_tokens: request.maxTokens,
    },
    response: errorClass ? null : llmResult.raw,
    traceId: context.principalChain.auditEntryId ?? null,
    errorClass,
    latencyMs: llmResult.latencyMs,
  });

  // Write the LLM-call audit row. We re-use the substrate's AuditLogger
  // by accessing it through composeAgentContext's chain anchor — but the
  // substrate doesn't expose the logger directly (intentional
  // encapsulation). Instead, the caller of composeAndCallLLM is expected
  // to have provided the same AuditLogger to the substrate at
  // construction time; we reach through the public interface by writing
  // a follow-on audit row via the same logger. To keep the example
  // self-contained, we expose the audit logger via the deps; production
  // consumers can wire their own audit pathway.

  const llmAuditEntry = await writeLLMCallAuditRow(deps, context, llmAuditRow);

  if (raised) {
    // Rethrow after the audit row lands — caller sees the error AND the
    // audit trail captures the failure.
    throw raised;
  }

  return {
    context,
    llmResult,
    llmAuditEntryId: llmAuditEntry.id,
    llmAuditRow,
  };
}

/**
 * Compose the system prompt from the three-tier agent context.
 *
 * Convention: firm context first (broadest, public-substrate), advisor
 * context next (methodology + workflows), client context last (most
 * specific). PII discipline lives upstream — at the memory-read
 * boundaries (the substrate's stores apply PII tagging) — so the system
 * prompt here is constructed from already-filtered context.
 */
export function composeSystemPrompt(context: AgentContext): string {
  const parts: string[] = [];

  parts.push("# Firm context");
  parts.push("");
  parts.push("## Policies");
  for (const policy of context.firmMemory.policies) {
    parts.push(`- ${policy.title}`);
  }
  parts.push("");
  parts.push("## ADRs (status: ACCEPTED unless noted)");
  for (const adr of context.firmMemory.adrs) {
    const tag = adr.status === "ACCEPTED" ? "" : ` [${adr.status}]`;
    parts.push(`- ${adr.title}${tag}`);
  }
  parts.push("");
  parts.push("## CCO-approved patterns");
  for (const approval of context.firmMemory.ccoApprovals) {
    parts.push(`- ${approval.title} (approved ${approval.approvedAt})`);
  }

  parts.push("");
  parts.push("# Advisor context");
  parts.push("");
  if (context.advisorMemory.entries.size === 0) {
    parts.push("_No advisor methodology preferences recorded yet._");
  } else {
    for (const entry of context.advisorMemory.entries.values()) {
      parts.push(`- ${entry.key}: ${stringifyMemoryValue(entry.value)}`);
    }
  }

  parts.push("");
  parts.push("# Client context");
  parts.push("");
  if (context.clientMemory.goals.length === 0) {
    parts.push("_No client goals recorded yet._");
  } else {
    parts.push("## Goals");
    for (const goal of context.clientMemory.goals) {
      parts.push(`- ${goal}`);
    }
  }
  if (context.clientMemory.decisionHistory.length > 0) {
    parts.push("");
    parts.push("## Recent decisions");
    for (const d of context.clientMemory.decisionHistory.slice(-5)) {
      parts.push(`- ${d.timestamp}: ${d.action}${d.rationale ? ` — ${d.rationale}` : ""}`);
    }
  }

  parts.push("");
  parts.push("---");
  parts.push("Respond to the advisor based on the above context. Keep responses bounded; defer to human review when uncertain.");
  return parts.join("\n");
}

function stringifyMemoryValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return "[unrepresentable]";
  }
}

/**
 * Write the LLM-call audit row referencing the chain-establishment anchor.
 * Encapsulated as its own function so test mocks can override the audit
 * pathway independently of the substrate's composition pathway.
 */
async function writeLLMCallAuditRow(
  deps: ComposeAndCallLLMDeps,
  context: AgentContext,
  llmAuditRow: ReturnType<typeof buildAuditRow>,
): Promise<{ id: string }> {
  // The substrate's AuditLogger is captured at construction time and
  // exposed indirectly via a small helper method that we add as part of
  // this demo's contract. See agent-context-builder.ts for the helper.
  return await deps.substrate.writeLLMCallAuditRow({
    actorId: context.principalChain.advisorId,
    sessionId: context.principalChain.sessionId,
    clientId: context.principalChain.clientId,
    anchorAuditEntryId: context.principalChain.auditEntryId,
    auditRow: llmAuditRow,
  });
}

function randomHex(bytes: number): string {
  const hex = "0123456789abcdef";
  let s = "";
  for (let i = 0; i < bytes * 2; i++) {
    s += hex[Math.floor(Math.random() * 16)];
  }
  return s;
}
