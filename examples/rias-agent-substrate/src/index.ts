// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * @protocolwealthos-examples/rias-agent-substrate
 *
 * Reference implementation of the three-tier agent memory architecture
 * (per-client / per-advisor / per-firm) for AI agents in an RIA context.
 *
 * Companion to the canonical ADR at
 * shared/architecture/decisions/ADR-three-tier-agent-memory.md (consumer-side
 * repo) and the adopter-facing companion at
 * pwos-core/docs/three-tier-agent-memory-architecture.md.
 *
 * This example is intentionally storage-agnostic — the MemoryStore /
 * FirmMemorySource interfaces let consumers wire Postgres + RLS, DynamoDB,
 * or any other backing store. In-memory implementations are provided for
 * testing + exploration.
 */

export {
  RIAAgentSubstrate,
  type AgentContextRequest,
  type RIAAgentSubstrateOptions,
} from "./agent-context-builder.js";

export {
  composeAndCallLLM,
  composeSystemPrompt,
  type ComposeAndCallLLMRequest,
  type ComposeAndCallLLMResult,
  type ComposeAndCallLLMDeps,
} from "./llm-demo.js";

export {
  AnthropicLLMClient,
  type AnthropicLLMClientOptions,
  type AnthropicLike,
  type LLMCallRequest,
  type LLMCallResult,
  type LLMClient,
} from "./llm-client.js";

export {
  type AdvisorMemoryStore,
  type ClientMemoryStore,
  type FirmMemorySource,
  InMemoryAdvisorMemoryStore,
  InMemoryClientMemoryStore,
  InMemoryFirmMemorySource,
} from "./memory-stores.js";

export {
  type AuthorizedClientsResolver,
  chainAuditDetails,
  validatePrincipalChain,
} from "./principal-chain.js";

export type {
  AdvisorMemory,
  AdvisorMemoryEntry,
  AgentContext,
  ClientDecision,
  ClientMemory,
  FirmADR,
  FirmCCOApproval,
  FirmMemory,
  FirmPolicy,
  PiiTag,
  PrincipalChain,
} from "./types.js";
export { UnauthorizedMemoryAccess } from "./types.js";
