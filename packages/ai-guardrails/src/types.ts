// SPDX-License-Identifier: MIT-0 OR Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Posture for a guardrail violation.
 *
 * - `block` — refuse the call (throw); the request never leaves firm
 *   infrastructure. This is the regulated default.
 * - `warn` — record the violation and proceed. Useful in shadow / dev modes
 *   where you want telemetry before turning enforcement on.
 */
export type GuardrailPosture = "block" | "warn";

/**
 * A model alias is the *role* a model plays in your application
 * (frontier reasoner, fast workhorse, cheap extraction worker), not the
 * vendor's model id. Roles map to ids via environment variables resolved
 * at boot — never hardcoded literals.
 *
 * The allowlisted aliases below cover the common LLM application shapes;
 * extend `ModelAlias` for product-specific roles.
 */
export type StandardModelAlias =
  | "FRONTIER"
  | "WORKHORSE"
  | "EXTRACTION"
  | "CLASSIFIER"
  | "EMBEDDING";

export type ModelAlias = StandardModelAlias | (string & {});

/**
 * Cache-control marker for prompt caching. Anthropic models honor this on
 * system prompts, tool definitions, and message blocks; the cached prefix
 * is billed at a fraction of input tokens on subsequent matching turns.
 */
export interface CacheControlMarker {
  type: "ephemeral";
}

/**
 * Per-call audit row. Carries hashes — never raw prompt/response content.
 * The audit trail can never become a correlation oracle on PII.
 *
 * Fields:
 * - `requestId` — caller-supplied correlation id
 * - `actorId` — opaque user/service id (no PII)
 * - `model` — resolved model id (post-allowlist)
 * - `modelAlias` — application-side role
 * - `promptHash` — sha256 of canonicalized request payload
 * - `responseHash` — sha256 of canonicalized response payload (or null on error)
 * - `toolCallHashes` — sha256 of each tool_use block (in order); empty if none
 * - `inputTokens`, `outputTokens`, `cacheReadInputTokens`, `cacheCreationInputTokens`
 * - `traceId` — observability trace id (Langfuse / OTel) for correlation
 * - `errorClass` — failure-class taxonomy bucket (or null on success)
 * - `latencyMs`
 * - `at` — timestamp the call resolved (epoch ms)
 */
export interface AiCallAuditRow {
  requestId: string;
  actorId: string;
  model: string;
  modelAlias: ModelAlias;
  promptHash: string;
  responseHash: string | null;
  toolCallHashes: string[];
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  traceId: string | null;
  errorClass: string | null;
  latencyMs: number;
  at: number;
}

/**
 * Opaque provenance for the credential that will sign a provider request.
 * `source` is a label (`"env:ANTHROPIC_API_KEY"`, `"secret-manager:…"`, …).
 * `fingerprint` is a content-free digest of that credential, from
 * {@link fingerprintCredential}. Neither field is a retention-policy claim,
 * and neither may contain the raw credential.
 */
export interface CredentialProvenance {
  source: string;
  fingerprint: string;
}

/**
 * Workspace assertion config.
 *
 * `expected` / `actual` compare configured workspace ids. That is a boot
 * configuration check. It does not query a provider and it does not prove
 * which credential will sign the next request. Pass `credential` plus
 * `allowedCredentialFingerprints` to also bind the assertion to the
 * credential the caller will actually use. A locally editable workspace
 * id is not a substitute for that list.
 */
export interface WorkspaceAssertionConfig {
  /** Expected workspace id from the caller's own configuration. */
  expected: string;
  /** Actual workspace id to assert (read from env or vendor SDK). */
  actual: string | undefined;
  /** Posture on mismatch. Default `block`. */
  posture?: GuardrailPosture;
  /**
   * Provenance of the credential that will sign requests. Compared only
   * when `allowedCredentialFingerprints` is set.
   */
  credential?: CredentialProvenance;
  /**
   * Fingerprints independently known to belong with `expected`. When this
   * array is set (including when it is empty), the signing credential's
   * fingerprint must be a member or the assertion fails.
   */
  allowedCredentialFingerprints?: readonly string[];
}

/** Token-usage shape returned by Anthropic-style responses. */
export interface TokenUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

/** Minimal shape we extract from a response message. Vendor-agnostic. */
export interface ResponseLike {
  id?: string;
  model?: string;
  usage?: TokenUsage;
  content?: unknown;
  stop_reason?: string;
}
