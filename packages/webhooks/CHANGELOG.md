# @protocolwealthos/webhooks

## 0.2.1

### Patch Changes

- [#87](https://github.com/Protocol-Wealth/pwos-core/pull/87) [`dce504c`](https://github.com/Protocol-Wealth/pwos-core/commit/dce504c6801da7efb720fc5429170050b7acadde) Thanks [@rivendale](https://github.com/rivendale)! - Ship LICENSE and NOTICE in every published tarball, and guard the compiled publish shape.

  - Each package's `prepack` now copies the repository-root `LICENSE` and `NOTICE` into the package before packing, so every tarball carries the full Apache-2.0 license text and the NOTICE (Apache-2.0 §4(d) NOTICE propagation + the USPTO defensive-patent notice and third-party attributions). Previously `NOTICE` never reached npm and `LICENSE` shipped only via pnpm auto-hoisting.
  - Added `"LICENSE"` and `"NOTICE"` to the `files` array of the four packages that omitted them (`disclosure-card`, `onchain-accounting-contract`, `planning-contract`, `shared`) and resolved the dangling `files` references in the rest.
  - Added `pnpm lint:publish` (`scripts/check-publish-shape.mjs`), run in CI and as a publish preflight, which fails if any published `main`/`types`/`exports` entry would resolve to raw `./src/*.ts` instead of a compiled `./dist` artifact.

  No library source or runtime behavior changes.

## 0.2.0

### Minor Changes

- [#13](https://github.com/Protocol-Wealth/pwos-core/pull/13) [`4d0f9f6`](https://github.com/Protocol-Wealth/pwos-core/commit/4d0f9f62750c5cc0195d200b4f3c2523b967e8c3) Thanks [@rivendale](https://github.com/rivendale)! - Initial release: defense-in-depth inbound webhook verification.

  Three independently-composable layers:

  - **HMAC-SHA256 body signing** — `verifyHmacSha256` (hex / base64 / base64url) and `verifyTimestampedHmacSha256` (bounds replay attacks via configurable `toleranceSec`, default 5 min). Timing-safe comparison.
  - **Dual-layer path-token + Basic Auth** — `verifyDualLayer` for vendors that don't ship body signing. Both layers required, both compared timing-safely.
  - **Idempotency-key replay protection** — `IdempotencyStore` interface plus `InMemoryIdempotencyStore` for tests. Back with Redis SETNX or Postgres `INSERT … ON CONFLICT` in production.

  Each verifier returns a structured `VerificationResult` carrying a stable code suitable for log/metric labels (no PII).

  `hashBodyForIdempotency` produces a stable replay key when the vendor doesn't ship one.
