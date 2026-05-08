// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Namespace-enforced cache-key builder.
 *
 * Shape:  `${vendor}:${resource}:${identifier}`
 *
 *   - `vendor`:     a stable application namespace (e.g. `app`, `pricing`).
 *   - `resource`:   the entity class (e.g. `quote`, `policy`).
 *   - `identifier`: the lookup. The builder rejects identifier values
 *                   that match any configured PII pattern.
 *
 * For inputs that are inherently long or contain unsafe shapes, prefer
 * `hashedIdentifier(value)` to convert to a stable sha256 hex slug.
 */

import { createHash } from "node:crypto";
import { DEFAULT_PII_PATTERNS, type PiiPattern } from "./piiPatterns.js";

export class CachePiiError extends Error {
  readonly pattern: string;
  readonly description: string;
  constructor(pattern: string, description: string) {
    super(`Refusing cache key: identifier matched PII pattern "${pattern}" (${description}).`);
    this.name = "CachePiiError";
    this.pattern = pattern;
    this.description = description;
  }
}

export class CacheKeyShapeError extends Error {
  constructor(detail: string) {
    super(`Refusing cache key: ${detail}`);
    this.name = "CacheKeyShapeError";
  }
}

export interface CacheKeyBuilderOptions {
  /** Identifier patterns refused at build time. Defaults to `DEFAULT_PII_PATTERNS`. */
  patterns?: readonly PiiPattern[];
  /** Allowed segment regex; default `/^[a-z0-9][a-z0-9_.-]*$/` (lowercase, no whitespace). */
  segmentRegex?: RegExp;
  /** Max identifier length before requiring `hashedIdentifier`. Default 200. */
  maxIdentifierLength?: number;
}

const DEFAULT_SEGMENT_REGEX = /^[a-z0-9][a-z0-9_.-]*$/;

export function hashedIdentifier(value: string): string {
  const h = createHash("sha256");
  h.update(value);
  return h.digest("hex").slice(0, 32); // 128-bit slug — collision-resistant for cache use
}

export interface CacheKeyBuilder {
  build(vendor: string, resource: string, identifier: string): string;
  /** Inspect without throwing; returns the key on success or `null` on rejection. */
  tryBuild(vendor: string, resource: string, identifier: string): string | null;
  hashed(vendor: string, resource: string, value: string): string;
}

export function createCacheKeyBuilder(
  options: CacheKeyBuilderOptions = {}
): CacheKeyBuilder {
  const patterns = options.patterns ?? DEFAULT_PII_PATTERNS;
  const segRe = options.segmentRegex ?? DEFAULT_SEGMENT_REGEX;
  const maxLen = options.maxIdentifierLength ?? 200;

  function checkSegment(name: string, value: string): void {
    if (!segRe.test(value)) {
      throw new CacheKeyShapeError(
        `${name} segment "${value}" does not match ${segRe.source}`
      );
    }
  }
  function checkIdentifier(value: string): void {
    if (value.length > maxLen) {
      throw new CacheKeyShapeError(
        `identifier exceeds max length ${maxLen} (got ${value.length}); use hashed()`
      );
    }
    for (const p of patterns) {
      if (p.regex.test(value)) {
        throw new CachePiiError(p.name, p.description);
      }
    }
  }

  function build(vendor: string, resource: string, identifier: string): string {
    checkSegment("vendor", vendor);
    checkSegment("resource", resource);
    if (identifier.length === 0) {
      throw new CacheKeyShapeError("identifier is empty");
    }
    checkIdentifier(identifier);
    return `${vendor}:${resource}:${identifier}`;
  }

  function tryBuild(
    vendor: string,
    resource: string,
    identifier: string
  ): string | null {
    try {
      return build(vendor, resource, identifier);
    } catch {
      return null;
    }
  }

  function hashed(vendor: string, resource: string, value: string): string {
    checkSegment("vendor", vendor);
    checkSegment("resource", resource);
    return `${vendor}:${resource}:${hashedIdentifier(value)}`;
  }

  return { build, tryBuild, hashed };
}
