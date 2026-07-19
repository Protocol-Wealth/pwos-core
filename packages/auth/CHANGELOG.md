# @protocolwealthos/auth

## 0.2.1

### Patch Changes

- [#87](https://github.com/Protocol-Wealth/pwos-core/pull/87) [`dce504c`](https://github.com/Protocol-Wealth/pwos-core/commit/dce504c6801da7efb720fc5429170050b7acadde) Thanks [@rivendale](https://github.com/rivendale)! - Ship LICENSE and NOTICE in every published tarball, and guard the compiled publish shape.

  - Each package's `prepack` now copies the repository-root `LICENSE` and `NOTICE` into the package before packing, so every tarball carries the full Apache-2.0 license text and the NOTICE (Apache-2.0 §4(d) NOTICE propagation + the USPTO defensive-patent notice and third-party attributions). Previously `NOTICE` never reached npm and `LICENSE` shipped only via pnpm auto-hoisting.
  - Added `"LICENSE"` and `"NOTICE"` to the `files` array of the four packages that omitted them (`disclosure-card`, `onchain-accounting-contract`, `planning-contract`, `shared`) and resolved the dangling `files` references in the rest.
  - Added `pnpm lint:publish` (`scripts/check-publish-shape.mjs`), run in CI and as a publish preflight, which fails if any published `main`/`types`/`exports` entry would resolve to raw `./src/*.ts` instead of a compiled `./dist` artifact.

  No library source or runtime behavior changes.

## 0.2.0

### Minor Changes

- [#15](https://github.com/Protocol-Wealth/pwos-core/pull/15) [`1a0b471`](https://github.com/Protocol-Wealth/pwos-core/commit/1a0b47173329d808dd486f05e93cfcea4484633c) Thanks [@rivendale](https://github.com/rivendale)! - Add per-agent scoped tokens — for granting external AI clients (Claude / ChatGPT / Cursor / vendor agents) narrowed access separate from human user sessions.

  **Different from `signSession` / `verifySession`:**

  - No `email` requirement (agents aren't users)
  - Carries `agentId` + `scope` claims (level: `read_only` / `read_write` / `admin`, plus optional `resources` array for resource-level scoping like `["household:hh_123"]`)
  - Carries `tokenId` so a revocation list can deny the token before its `exp`
  - Default TTL is shorter (1 hour vs 15 min for user sessions)

  **Revocation:** caller supplies a `RevocationList` interface (`isRevoked(tokenId)`, `revoke(tokenId)`). Backed by Redis SET / Postgres index / in-memory `Set` in production; ships `InMemoryRevocationList` for tests.

  **`hasScope(claims, required, requiredResource?)`** — convenience: true if the agent's scope satisfies the required permission level AND (when supplied) the agent's `resources` array either is empty (unconstrained) or includes the required resource.

  Same crypto path as user sessions (HS256 / hand-rolled / `timingSafeEqual` / refuses non-HS256 / extras can't spoof standard claims). Verification is async because revocation-list lookup is async.

  New exports: `signAgentToken`, `verifyAgentToken`, `hasScope`, `InMemoryRevocationList`, types `AgentScope`, `AgentScopeClaim`, `AgentTokenClaims`, `RevocationList`, `SignAgentTokenOptions`, `VerifyAgentTokenOptions`.

- [#13](https://github.com/Protocol-Wealth/pwos-core/pull/13) [`4d0f9f6`](https://github.com/Protocol-Wealth/pwos-core/commit/4d0f9f62750c5cc0195d200b4f3c2523b967e8c3) Thanks [@rivendale](https://github.com/rivendale)! - Initial release: JWT session signing/verification, role-hierarchy guards, and workspace-domain restriction.

  **Zero runtime dependencies.** The HS256 implementation is hand-rolled in ~80 lines so the entire surface is auditable in one read.

  **`signSession` / `verifySession`** — HS256 only. Refuses non-HS256 algorithms (including `alg: "none"`), validates `iat` / `exp` strictly, uses `timingSafeEqual` for the signature compare, and prevents `extras` from spoofing standard claims.

  **`createRoleGuard`** — numeric-rank role hierarchy. Default tiers: `GUEST < CLIENT < EMPLOYEE < ADVISOR < PARTNER < OWNER`. Bring your own hierarchy if those don't fit.

  **`isInWorkspaceDomain` / `assertWorkspaceDomain`** — restrict sign-in to one or more workspace email domains (case-insensitive; subdomains are _not_ auto-allowed).

  For RS256 / EdDSA / multi-key scenarios, use a full JWT library behind the `verify`/`sign` shape — this package's role is the _guard_ layer, not crypto primitives.
