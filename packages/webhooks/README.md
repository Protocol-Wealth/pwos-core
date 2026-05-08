# @protocolwealthos/webhooks

> Defense-in-depth inbound webhook verification: HMAC-SHA256 body signing, dual-layer path-token + Basic Auth, idempotency-key replay protection.

Apache 2.0 · Patent Pending: USPTO #64/034,215 · part of [pwos-core](https://github.com/Protocol-Wealth/pwos-core).

## What's in the box

- **`verifyHmacSha256`** — generic timing-safe HMAC-SHA256 verifier. Supports `hex`, `base64`, `base64url`.
- **`verifyTimestampedHmacSha256`** — bounds replay attacks by rejecting stale signatures (`${timestampSec}.${rawBody}` pattern, `toleranceSec` configurable, default 5 min).
- **`verifyDualLayer`** — for vendors that don't sign the body: path token + Basic Auth, both required, both compared timing-safely.
- **`InMemoryIdempotencyStore`** + **`IdempotencyStore`** interface — back this with Redis SETNX or Postgres `INSERT … ON CONFLICT` in production.
- **`hashBodyForIdempotency`** — sha256 the body for a stable replay key when the vendor doesn't ship one.

## Install

```sh
pnpm add @protocolwealthos/webhooks
```

## Quick start — HMAC-signed vendor

```ts
import { verifyTimestampedHmacSha256, InMemoryIdempotencyStore } from "@protocolwealthos/webhooks";

const idempotency = new InMemoryIdempotencyStore(); // swap for Redis in prod

app.post("/webhooks/vendor", async (req, res) => {
  const sig = req.headers["x-vendor-signature"] as string;
  const ts = Number(req.headers["x-vendor-timestamp"]);

  const verified = verifyTimestampedHmacSha256({
    secret: process.env.VENDOR_WEBHOOK_SECRET!,
    rawBody: req.rawBody,
    signature: sig,
    timestampSec: ts,
    nowSec: Math.floor(Date.now() / 1000),
  });
  if (!verified.ok) return res.status(401).send({ error: verified.code });

  const reservation = await idempotency.reserve(
    req.body.event_id,
    Date.now()
  );
  if (reservation.status === "duplicate") return res.status(200).send({ duplicate: true });

  await processEvent(req.body);
  res.status(200).send({ ok: true });
});
```

## Quick start — dual-layer (vendor doesn't sign)

```ts
import { verifyDualLayer } from "@protocolwealthos/webhooks";

app.post("/webhooks/vendor/:token", (req, res) => {
  const verified = verifyDualLayer({
    pathToken: req.params.token,
    expectedPathToken: process.env.VENDOR_PATH_TOKEN!,
    authorizationHeader: req.headers.authorization,
    expectedBasicUser: process.env.VENDOR_BASIC_USER!,
    expectedBasicPassword: process.env.VENDOR_BASIC_PASS!,
  });
  if (!verified.ok) return res.status(401).send({ error: verified.code });
  // … proceed
});
```

## License

Apache 2.0 with USPTO Application #64/034,215 defensive patent grant.
