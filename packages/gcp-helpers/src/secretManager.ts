// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Secret Manager loader — adapter interface + read-through cache.
 *
 * Discipline: secrets should be read at runtime via Secret Manager
 * (or your Cloud Run secret-key references) and never appear in env-var
 * definitions, build artifacts, or container images. The loader
 * interface here lets you mount that pattern behind a typed interface
 * and unit-test it without a Google SDK in the test path.
 *
 * The read-through cache is bounded (`ttlMs`) so secret rotation
 * eventually propagates without restarts.
 */

export interface SecretLoader {
  /** Load the latest version of `name`. Returns the secret's bytes. */
  load(name: string): Promise<string>;
}

export interface CachingSecretLoader extends SecretLoader {
  invalidate(name: string): void;
  invalidateAll(): void;
  /** Optional sync inspection (useful in tests). */
  size(): number;
}

export interface CachingSecretLoaderOptions {
  inner: SecretLoader;
  /** TTL in ms before a cached value is re-read. Default 60_000 (1 min). */
  ttlMs?: number;
  /** Inject for tests. Defaults to `Date.now`. */
  now?: () => number;
}

export function createCachingSecretLoader(
  options: CachingSecretLoaderOptions
): CachingSecretLoader {
  const ttl = options.ttlMs ?? 60_000;
  const now = options.now ?? Date.now;
  const cache = new Map<string, { value: string; expiresAt: number }>();

  return {
    async load(name: string) {
      const hit = cache.get(name);
      const t = now();
      if (hit && hit.expiresAt > t) return hit.value;
      const value = await options.inner.load(name);
      cache.set(name, { value, expiresAt: t + ttl });
      return value;
    },
    invalidate(name) {
      cache.delete(name);
    },
    invalidateAll() {
      cache.clear();
    },
    size() {
      return cache.size;
    },
  };
}

/**
 * In-memory loader — useful for tests. Backs the secret store with a
 * plain Map.
 */
export class InMemorySecretLoader implements SecretLoader {
  private readonly store: Map<string, string>;
  constructor(initial?: Record<string, string>) {
    this.store = new Map(Object.entries(initial ?? {}));
  }
  async load(name: string): Promise<string> {
    const v = this.store.get(name);
    if (v === undefined) throw new Error(`secret not found: ${name}`);
    return v;
  }
  set(name: string, value: string): void {
    this.store.set(name, value);
  }
}
