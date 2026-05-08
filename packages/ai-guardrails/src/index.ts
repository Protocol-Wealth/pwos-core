// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * @protocolwealthos/ai-guardrails — safety primitives for calling
 * Anthropic-style LLM APIs from regulated environments.
 *
 * Composable building blocks. Take what you need; nothing here pulls in
 * a vendor SDK.
 *
 * Boot-time:
 *   - `assertWorkspace` / `assertWorkspaceFromEnv` — fail-fast if a
 *     credential rotation moves traffic to a non-ZDR workspace.
 *   - `createModelResolver` — refuse hardcoded model literals; resolve
 *     application aliases (FRONTIER / WORKHORSE / EXTRACTION / …) from
 *     env at boot, with optional vendor-prefix allowlisting.
 *
 * Per-request:
 *   - `markCacheable` / `cacheControlMarker` — Anthropic prompt-cache
 *     marker helpers for system prompts and tool-definition prefixes.
 *   - `assertNoPiiInCachedPrefix` — wire a PII scanner into the cache
 *     boundary so client content never lands in the cached prefix.
 *
 * Per-response:
 *   - `buildAuditRow` — hashes prompt + response + tool-use blocks for
 *     a content-free audit trail. Pair with `@protocolwealthos/audit-log`.
 *
 * Discipline matters: these primitives only work if you call them.
 * Compose them once into your model-client wrapper and forbid raw SDK
 * usage in the rest of your app.
 */

export {
  assertWorkspace,
  assertWorkspaceFromEnv,
  WorkspaceMismatchError,
} from "./zdrAssertion.js";
export type { AssertWorkspaceResult } from "./zdrAssertion.js";

export {
  createModelResolver,
  UnknownModelAliasError,
  ModelEnvUnsetError,
  ModelPrefixViolationError,
} from "./modelAllowlist.js";
export type {
  ModelAllowlistConfig,
  ModelResolver,
} from "./modelAllowlist.js";

export {
  CACHE_CONTROL_EPHEMERAL,
  cacheControlMarker,
  markCacheable,
  assertNoPiiInCachedPrefix,
  CachedPiiError,
} from "./promptCache.js";

export {
  buildAuditRow,
  canonicalJson,
  sha256Hex,
  hashPayload,
  extractToolCallHashes,
} from "./auditRow.js";
export type { BuildAuditRowInput } from "./auditRow.js";

export type {
  AiCallAuditRow,
  CacheControlMarker,
  GuardrailPosture,
  ModelAlias,
  ResponseLike,
  StandardModelAlias,
  TokenUsage,
  WorkspaceAssertionConfig,
} from "./types.js";
