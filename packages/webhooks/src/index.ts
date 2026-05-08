// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * @protocolwealthos/webhooks — defense-in-depth inbound webhook
 * verification.
 *
 * Three layers, each independently composable:
 *
 *   - HMAC-SHA256 body signing (preferred when vendor supports it):
 *     `verifyHmacSha256` / `verifyTimestampedHmacSha256`
 *   - Dual-layer path-token + Basic Auth (for vendors that don't sign):
 *     `verifyDualLayer`
 *   - Idempotency-key replay protection (always — at-least-once is
 *     standard delivery semantics):
 *     `IdempotencyStore` + `InMemoryIdempotencyStore` + `hashBodyForIdempotency`
 *
 * Each verifier returns a structured `VerificationResult` carrying a
 * stable code suitable for log/metric labels (no PII).
 */

export {
  computeHmacSha256,
  verifyHmacSha256,
  verifyTimestampedHmacSha256,
} from "./hmacVerify.js";
export type {
  HmacVerifyOptions,
  TimestampedHmacOptions,
  SignatureEncoding,
} from "./hmacVerify.js";

export { verifyDualLayer } from "./dualLayerVerify.js";
export type { DualLayerOptions } from "./dualLayerVerify.js";

export {
  hashBodyForIdempotency,
  InMemoryIdempotencyStore,
} from "./idempotency.js";

export type {
  IdempotencyOutcome,
  IdempotencyStore,
  VerificationOk,
  VerificationFail,
  VerificationResult,
} from "./types.js";
