---
"@protocolwealthos/gcp-helpers": minor
---

Initial release: storage-agnostic helpers for applications running on Google Cloud.

**Zero `@google-cloud/*` dependencies.** The package ships interfaces for the GCP primitives plus the supporting helpers; you bring the Google clients (or any IAM-aware connector / Secret Manager equivalent) and wire them in.

**`createCloudLogger` + `serializeError`** — JSON-line structured logging for Cloud Run / GKE. Cloud Logging lifts `severity` / `message` / `httpRequest` into entry metadata automatically; everything else lands as `jsonPayload`. `withFields` returns a child logger with bound context.

**`pickConnectionStrategy` + `CloudSqlIamConnector` interface** — choose IAM auth when `CLOUD_SQL_INSTANCE_CONNECTION_NAME` is set; **refuse silent fallback to password auth** when only the instance name is set without the matching user/db.

**`createCachingSecretLoader` + `SecretLoader` / `InMemorySecretLoader`** — read-through cache around a Secret Manager loader of your choosing. TTL-bounded so rotation eventually propagates without restarts; `invalidate(name)` for rotation-notify flows.

**`buildFrontendErrorReport`** — payload shape for React/Vue error boundaries that POST to your server endpoint and forward to Cloud Logging. Truncates long stacks to a configurable limit (default 8 KB).

Pair with the new `docs/gcp-reference-architecture.md` for the deployment posture these helpers slot into.
