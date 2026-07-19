# @protocolwealthos/cache-keys

## 0.2.1

### Patch Changes

- [#87](https://github.com/Protocol-Wealth/pwos-core/pull/87) [`dce504c`](https://github.com/Protocol-Wealth/pwos-core/commit/dce504c6801da7efb720fc5429170050b7acadde) Thanks [@rivendale](https://github.com/rivendale)! - Ship LICENSE and NOTICE in every published tarball, and guard the compiled publish shape.

  - Each package's `prepack` now copies the repository-root `LICENSE` and `NOTICE` into the package before packing, so every tarball carries the full Apache-2.0 license text and the NOTICE (Apache-2.0 §4(d) NOTICE propagation + the USPTO defensive-patent notice and third-party attributions). Previously `NOTICE` never reached npm and `LICENSE` shipped only via pnpm auto-hoisting.
  - Added `"LICENSE"` and `"NOTICE"` to the `files` array of the four packages that omitted them (`disclosure-card`, `onchain-accounting-contract`, `planning-contract`, `shared`) and resolved the dangling `files` references in the rest.
  - Added `pnpm lint:publish` (`scripts/check-publish-shape.mjs`), run in CI and as a publish preflight, which fails if any published `main`/`types`/`exports` entry would resolve to raw `./src/*.ts` instead of a compiled `./dist` artifact.

  No library source or runtime behavior changes.

## 0.2.0

### Minor Changes

- [#13](https://github.com/Protocol-Wealth/pwos-core/pull/13) [`4d0f9f6`](https://github.com/Protocol-Wealth/pwos-core/commit/4d0f9f62750c5cc0195d200b4f3c2523b967e8c3) Thanks [@rivendale](https://github.com/rivendale)! - Initial release: namespace-enforced cache-key builder with runtime PII pattern rejection.

  Cache keys end up in eviction logs, slow-key metrics, and crash reports — surfaces with weaker retention than your primary database. A key like `client:advisor@example.com:profile` puts a working email address into all of them. The fix is to refuse the key at write time and force callers to hash or surrogate the identifying portion.

  **Shape:** `vendor:resource:identifier`. Each segment matches `/^[a-z0-9][a-z0-9_.-]*$/` by default — lowercase, no whitespace, no shell-special characters.

  **PII patterns refused** in identifiers (default set, configurable): email, US SSN (dashed), credit card (long digit run), US phone, UUIDv4.

  **Length cap** on identifiers (default 200) — longer values must go through `hashed()`.

  API: `createCacheKeyBuilder` (with `build` / `tryBuild` / `hashed`), `hashedIdentifier`, `DEFAULT_PII_PATTERNS`, `CachePiiError`, `CacheKeyShapeError`.
