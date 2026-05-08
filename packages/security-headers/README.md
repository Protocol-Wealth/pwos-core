# @protocolwealthos/security-headers

> Framework-agnostic builders for HSTS, strict CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy.

Apache 2.0 · part of [pwos-core](https://github.com/Protocol-Wealth/pwos-core).

## Why headers from the application layer

If you set CSP / HSTS at the CDN, a CDN config drift turns into a silent security regression. Setting them in application code keeps them in source control, gated by your normal CI review, and verifiable with a daily probe. This package gives you the builders; the daily probe is your move.

## Quick start

```ts
import {
  buildSecurityHeaders,
  strictBaseline,
  sha256Hex,
} from "@protocolwealthos/security-headers";

// Build-time: hash inline scripts so production CSP doesn't need 'unsafe-inline'.
const inlineScriptHash = sha256Hex("window.__APP_CONFIG__ = {…}");

const csp = strictBaseline({
  scriptHashes: [inlineScriptHash],
  connectExtra: ["https://api.example.com"],
});

const headers = buildSecurityHeaders({
  mode: process.env.NODE_ENV === "production" ? "production" : "development",
  csp,
});

// Hand off to your framework:
for (const [k, v] of Object.entries(headers)) response.setHeader(k, v);
```

## What ships

| Builder | Default |
|---|---|
| `strictBaseline()` | `default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `upgrade-insecure-requests`, no `'unsafe-inline'` |
| `applyDevOverrides(base, { wsOrigin })` | layers `'unsafe-inline'` + HMR websocket on top of the baseline |
| `buildHsts()` | `max-age=63072000; includeSubDomains; preload` (preload-eligible) |
| `buildSecurityHeaders({ mode, csp, … })` | composes everything into a flat map; HSTS auto-emitted only in `production` mode |

The default `Permissions-Policy` locks down camera, microphone, geolocation, payment, USB, and motion sensors. Override via `permissionsPolicy:` if you have a justified use case.

## License

Apache 2.0.
