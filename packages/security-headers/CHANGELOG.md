# @protocolwealthos/security-headers

## 0.2.1

### Patch Changes

- [#87](https://github.com/Protocol-Wealth/pwos-core/pull/87) [`dce504c`](https://github.com/Protocol-Wealth/pwos-core/commit/dce504c6801da7efb720fc5429170050b7acadde) Thanks [@rivendale](https://github.com/rivendale)! - Ship LICENSE and NOTICE in every published tarball, and guard the compiled publish shape.

  - Each package's `prepack` now copies the repository-root `LICENSE` and `NOTICE` into the package before packing, so every tarball carries the full Apache-2.0 license text and the NOTICE (Apache-2.0 §4(d) NOTICE propagation + the USPTO defensive-patent notice and third-party attributions). Previously `NOTICE` never reached npm and `LICENSE` shipped only via pnpm auto-hoisting.
  - Added `"LICENSE"` and `"NOTICE"` to the `files` array of the four packages that omitted them (`disclosure-card`, `onchain-accounting-contract`, `planning-contract`, `shared`) and resolved the dangling `files` references in the rest.
  - Added `pnpm lint:publish` (`scripts/check-publish-shape.mjs`), run in CI and as a publish preflight, which fails if any published `main`/`types`/`exports` entry would resolve to raw `./src/*.ts` instead of a compiled `./dist` artifact.

  No library source or runtime behavior changes.

## 0.2.0

### Minor Changes

- [#13](https://github.com/Protocol-Wealth/pwos-core/pull/13) [`4d0f9f6`](https://github.com/Protocol-Wealth/pwos-core/commit/4d0f9f62750c5cc0195d200b4f3c2523b967e8c3) Thanks [@rivendale](https://github.com/rivendale)! - Initial release: framework-agnostic builders for HSTS, strict CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy.

  Returns a flat `Record<string, string>` you can hand to any HTTP framework's response object.

  **`strictBaseline`** — production CSP baseline (`default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `upgrade-insecure-requests`, no `'unsafe-inline'`). Inline scripts/styles ship via sha256 hashes you compute at build time (`sha256Hex` / `toHashSource`).

  **`applyDevOverrides`** — layers `'unsafe-inline'` + HMR websocket on top of the baseline for local dev.

  **`buildHsts`** — preload-eligible default (`max-age=63072000; includeSubDomains; preload`).

  **`buildSecurityHeaders`** — composes everything into one map. HSTS is auto-emitted only in `production` mode.

  **Default `Permissions-Policy`** locks down camera, microphone, geolocation, payment, USB, and motion sensors. Override per-application as needed.
