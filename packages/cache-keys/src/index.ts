// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * @protocolwealthos/cache-keys — namespace-enforced cache-key builder
 * with runtime PII pattern rejection.
 *
 * Cache keys end up in:
 *
 *   - Redis / Memorystore (whatever retention is configured there)
 *   - Eviction logs and slow-key metrics (often less protected than
 *     primary application logs)
 *   - Crash reports, when the key is part of a stack trace
 *
 * If those surfaces shouldn't carry client PII, refuse to write the
 * key in the first place. Hash or surrogate-id the identifying portion
 * via `hashed()` instead.
 */

export {
  createCacheKeyBuilder,
  hashedIdentifier,
  CachePiiError,
  CacheKeyShapeError,
} from "./keyBuilder.js";
export type {
  CacheKeyBuilder,
  CacheKeyBuilderOptions,
} from "./keyBuilder.js";

export { DEFAULT_PII_PATTERNS } from "./piiPatterns.js";
export type { PiiPattern } from "./piiPatterns.js";
