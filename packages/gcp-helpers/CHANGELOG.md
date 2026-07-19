# @protocolwealthos/gcp-helpers

## 0.2.1

### Patch Changes

- [#87](https://github.com/Protocol-Wealth/pwos-core/pull/87) [`dce504c`](https://github.com/Protocol-Wealth/pwos-core/commit/dce504c6801da7efb720fc5429170050b7acadde) Thanks [@rivendale](https://github.com/rivendale)! - Ship LICENSE and NOTICE in every published tarball, and guard the compiled publish shape.

  - Each package's `prepack` now copies the repository-root `LICENSE` and `NOTICE` into the package before packing, so every tarball carries the full Apache-2.0 license text and the NOTICE (Apache-2.0 §4(d) NOTICE propagation + the USPTO defensive-patent notice and third-party attributions). Previously `NOTICE` never reached npm and `LICENSE` shipped only via pnpm auto-hoisting.
  - Added `"LICENSE"` and `"NOTICE"` to the `files` array of the four packages that omitted them (`disclosure-card`, `onchain-accounting-contract`, `planning-contract`, `shared`) and resolved the dangling `files` references in the rest.
  - Added `pnpm lint:publish` (`scripts/check-publish-shape.mjs`), run in CI and as a publish preflight, which fails if any published `main`/`types`/`exports` entry would resolve to raw `./src/*.ts` instead of a compiled `./dist` artifact.

  No library source or runtime behavior changes.

## 0.2.0

### Minor Changes

- [#13](https://github.com/Protocol-Wealth/pwos-core/pull/13) [`4d0f9f6`](https://github.com/Protocol-Wealth/pwos-core/commit/4d0f9f62750c5cc0195d200b4f3c2523b967e8c3) Thanks [@rivendale](https://github.com/rivendale)! - Initial release: storage-agnostic helpers for applications running on Google Cloud.

  **Zero `@google-cloud/*` dependencies.** The package ships interfaces for the GCP primitives plus the supporting helpers; you bring the Google clients (or any IAM-aware connector / Secret Manager equivalent) and wire them in.

  **`createCloudLogger` + `serializeError`** — JSON-line structured logging for Cloud Run / GKE. Cloud Logging lifts `severity` / `message` / `httpRequest` into entry metadata automatically; everything else lands as `jsonPayload`. `withFields` returns a child logger with bound context.

  **`pickConnectionStrategy` + `CloudSqlIamConnector` interface** — choose IAM auth when `CLOUD_SQL_INSTANCE_CONNECTION_NAME` is set; **refuse silent fallback to password auth** when only the instance name is set without the matching user/db.

  **`createCachingSecretLoader` + `SecretLoader` / `InMemorySecretLoader`** — read-through cache around a Secret Manager loader of your choosing. TTL-bounded so rotation eventually propagates without restarts; `invalidate(name)` for rotation-notify flows.

  **`buildFrontendErrorReport`** — payload shape for React/Vue error boundaries that POST to your server endpoint and forward to Cloud Logging. Truncates long stacks to a configurable limit (default 8 KB).

  Pair with the new `docs/gcp-reference-architecture.md` for the deployment posture these helpers slot into.
