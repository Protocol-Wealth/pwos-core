---
"@protocolwealthos/cache-keys": minor
---

Initial release: namespace-enforced cache-key builder with runtime PII pattern rejection.

Cache keys end up in eviction logs, slow-key metrics, and crash reports — surfaces with weaker retention than your primary database. A key like `client:advisor@example.com:profile` puts a working email address into all of them. The fix is to refuse the key at write time and force callers to hash or surrogate the identifying portion.

**Shape:** `vendor:resource:identifier`. Each segment matches `/^[a-z0-9][a-z0-9_.-]*$/` by default — lowercase, no whitespace, no shell-special characters.

**PII patterns refused** in identifiers (default set, configurable): email, US SSN (dashed), credit card (long digit run), US phone, UUIDv4.

**Length cap** on identifiers (default 200) — longer values must go through `hashed()`.

API: `createCacheKeyBuilder` (with `build` / `tryBuild` / `hashed`), `hashedIdentifier`, `DEFAULT_PII_PATTERNS`, `CachePiiError`, `CacheKeyShapeError`.
