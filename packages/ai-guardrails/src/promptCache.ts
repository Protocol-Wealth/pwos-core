// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Prompt-cache helpers.
 *
 * Anthropic-style prompt caching marks a prefix of the request as
 * cacheable; subsequent requests that share that prefix bytewise pay a
 * fraction of the input-token rate. The mechanism is a `cache_control:
 * { type: "ephemeral" }` marker on the last block of the cacheable
 * prefix.
 *
 * The helpers here:
 *
 *   - `cacheControlMarker()` returns the well-formed marker.
 *   - `markCacheable(blocks)` clones a block array and sets the marker
 *     on the last block — the canonical "cache everything up to here"
 *     pattern for system prompts and tool-definition prefixes.
 *   - `assertNoPiiInCachedPrefix(blocks, scan)` is a wired-in safety
 *     check: a cached prefix that contains client PII would route that
 *     PII through the vendor's cache layer. The scan callback returns
 *     `true` if the block is safe to cache.
 *
 * No client content should ever land in the cached prefix. Compose with
 * `@protocolwealthos/pii-guard` to enforce.
 */

import type { CacheControlMarker } from "./types.js";

export const CACHE_CONTROL_EPHEMERAL: CacheControlMarker = Object.freeze({
  type: "ephemeral",
});

/** Returns the canonical ephemeral cache_control marker. */
export function cacheControlMarker(): CacheControlMarker {
  return CACHE_CONTROL_EPHEMERAL;
}

interface BlockLike {
  cache_control?: CacheControlMarker;
  [key: string]: unknown;
}

/**
 * Clone the block array and set `cache_control: { type: "ephemeral" }`
 * on the last block. Returns the new array — never mutates the input.
 */
export function markCacheable<T extends BlockLike>(blocks: readonly T[]): T[] {
  if (blocks.length === 0) return [];
  const next = blocks.map((b) => ({ ...b }));
  next[next.length - 1] = {
    ...next[next.length - 1],
    cache_control: cacheControlMarker(),
  };
  return next;
}

export class CachedPiiError extends Error {
  readonly index: number;
  constructor(index: number, detail: string) {
    super(
      `Refusing to mark prefix as cacheable: block at index ${index} contains potentially sensitive content (${detail}).`
    );
    this.name = "CachedPiiError";
    this.index = index;
  }
}

/**
 * Walk a block array and assert each block passes the `isClean` predicate.
 * Throws on the first failing block. The predicate is caller-supplied so
 * this module stays free of pii-guard runtime coupling.
 */
export function assertNoPiiInCachedPrefix<T extends BlockLike>(
  blocks: readonly T[],
  isClean: (block: T) => { ok: true } | { ok: false; reason: string }
): void {
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!;
    const result = isClean(block);
    if (!result.ok) {
      throw new CachedPiiError(i, result.reason);
    }
  }
}
