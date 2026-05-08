---
"@protocolwealthos/security-headers": minor
---

Initial release: framework-agnostic builders for HSTS, strict CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy.

Returns a flat `Record<string, string>` you can hand to any HTTP framework's response object.

**`strictBaseline`** — production CSP baseline (`default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `upgrade-insecure-requests`, no `'unsafe-inline'`). Inline scripts/styles ship via sha256 hashes you compute at build time (`sha256Hex` / `toHashSource`).

**`applyDevOverrides`** — layers `'unsafe-inline'` + HMR websocket on top of the baseline for local dev.

**`buildHsts`** — preload-eligible default (`max-age=63072000; includeSubDomains; preload`).

**`buildSecurityHeaders`** — composes everything into one map. HSTS is auto-emitted only in `production` mode.

**Default `Permissions-Policy`** locks down camera, microphone, geolocation, payment, USB, and motion sensors. Override per-application as needed.
