# @protocolwealthos/gcp-helpers

> Storage-agnostic helpers for applications running on Google Cloud — Cloud Logging structured-log builder, Cloud SQL IAM connector adapter, Secret Manager caching loader, frontend error-boundary log shape.

Apache 2.0 · part of [pwos-core](https://github.com/Protocol-Wealth/pwos-core).

## Why no `@google-cloud/*` deps

Compliance audiences read packages line by line. Pulling `@google-cloud/cloud-sql-connector` and `@google-cloud/secret-manager` in transitively means hundreds of files an auditor has to take on faith. This package ships *interfaces* for those primitives plus the supporting helpers. You bring the Google client (or any IAM-aware connector / Secret Manager equivalent) and wire it in.

The interfaces are small enough to mock in tests without a mocking framework — pass an `InMemorySecretLoader` and you're done.

## What ships

### Structured Cloud Logging

```ts
import { createCloudLogger, serializeError } from "@protocolwealthos/gcp-helpers";

const log = createCloudLogger({
  defaultFields: { service: "api", region: "us-central1" },
});

log.info("user signed in", { actorId: "u_123" });

// Inside a request handler:
const reqLog = log.withFields({ requestId, traceId });
try { … } catch (err) {
  reqLog.error("handler failed", { err: serializeError(err) });
}
```

Cloud Logging on Cloud Run / GKE parses JSON stdout into structured `LogEntry` records. `severity` and `message` are lifted into entry metadata; the rest lands as `jsonPayload`.

### Cloud SQL IAM auth

```ts
import { pickConnectionStrategy } from "@protocolwealthos/gcp-helpers";

const strategy = pickConnectionStrategy(process.env);
if (strategy.strategy === "iam") {
  // Use @google-cloud/cloud-sql-connector to mint connection options.
  const opts = await connector.getOptions(strategy.instanceConnectionName);
  pool = new Pool({ ...opts, user: strategy.user, database: strategy.database });
} else {
  pool = new Pool({ connectionString: strategy.databaseUrl });
}
```

The picker refuses to silently fall back to password auth if the IAM env is partially set — silent fallback is how production deploys end up using a stale `DATABASE_URL` that nobody noticed was still in the environment.

### Secret Manager caching loader

```ts
import { createCachingSecretLoader } from "@protocolwealthos/gcp-helpers";

const cache = createCachingSecretLoader({
  inner: yourSecretManagerLoader,
  ttlMs: 60_000,
});

const stripeKey = await cache.load("stripe-secret-api-key");
```

The cache is bounded by TTL so secret rotation propagates without a restart. Use `invalidate(name)` if your rotation flow notifies the app.

### Frontend error-boundary report

```ts
import { buildFrontendErrorReport } from "@protocolwealthos/gcp-helpers";

class AppErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    fetch("/api/log/frontend-error", {
      method: "POST",
      body: JSON.stringify(
        buildFrontendErrorReport({
          error,
          componentStack: errorInfo.componentStack,
          url: window.location.href,
          userAgent: navigator.userAgent,
          sessionId: getSessionId(),
          actorId: getActorId(),
          buildId: import.meta.env.VITE_BUILD_ID,
        })
      ),
    });
  }
}
```

The server endpoint forwards the payload to Cloud Logging — keep direct browser-to-Cloud-Logging out of your architecture; it bypasses the audit boundary and loses correlation with the request trace.

## License

Apache 2.0.
