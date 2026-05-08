# @protocolwealthos/cache-keys

> Namespace-enforced cache-key builder. Refuses to write keys that contain client PII.

Apache 2.0 · part of [pwos-core](https://github.com/Protocol-Wealth/pwos-core).

## Why

Cache keys appear in surfaces with weaker retention than your primary database — eviction logs, slow-key metrics, crash reports, observability dashboards. A key like `client:advisor@example.com:profile` puts a working email address into all of those surfaces. The fix is to refuse the key at write time and force callers to hash or surrogate the identifying portion.

## Quick start

```ts
import { createCacheKeyBuilder } from "@protocolwealthos/cache-keys";

const keys = createCacheKeyBuilder();

keys.build("app", "quote", "msft");                 // "app:quote:msft"
keys.build("app", "user", "advisor@example.com");   // throws CachePiiError
keys.hashed("app", "user", "advisor@example.com");  // "app:user:..." (sha256 prefix)
```

## What's enforced

- **Shape:** `vendor:resource:identifier`. Each segment matches `/^[a-z0-9][a-z0-9_.-]*$/` by default — lowercase, no whitespace, no shell-special characters.
- **PII:** the `identifier` is checked against `DEFAULT_PII_PATTERNS` (email / SSN / credit-card / US phone / UUID). Configure your own via `patterns:` option.
- **Length:** identifiers over 200 chars must go through `hashed()`. Long identifiers in keys are usually a smell.

## Designed to compose

- For Redis-shaped clients, wrap `client.get(key)` in `client.get(keys.build(...))` — the build call is the gate, the get call is the side effect.
- Pair with [`@protocolwealthos/pii-guard`](../pii-guard) when you need richer detection beyond cache keys (full text scan, manifest-based rehydration).

## License

Apache 2.0.
