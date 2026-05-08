---
"@protocolwealthos/webhooks": minor
---

Initial release: defense-in-depth inbound webhook verification.

Three independently-composable layers:

- **HMAC-SHA256 body signing** — `verifyHmacSha256` (hex / base64 / base64url) and `verifyTimestampedHmacSha256` (bounds replay attacks via configurable `toleranceSec`, default 5 min). Timing-safe comparison.
- **Dual-layer path-token + Basic Auth** — `verifyDualLayer` for vendors that don't ship body signing. Both layers required, both compared timing-safely.
- **Idempotency-key replay protection** — `IdempotencyStore` interface plus `InMemoryIdempotencyStore` for tests. Back with Redis SETNX or Postgres `INSERT … ON CONFLICT` in production.

Each verifier returns a structured `VerificationResult` carrying a stable code suitable for log/metric labels (no PII).

`hashBodyForIdempotency` produces a stable replay key when the vendor doesn't ship one.
