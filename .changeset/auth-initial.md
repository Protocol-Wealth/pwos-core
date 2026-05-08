---
"@protocolwealthos/auth": minor
---

Initial release: JWT session signing/verification, role-hierarchy guards, and workspace-domain restriction.

**Zero runtime dependencies.** The HS256 implementation is hand-rolled in ~80 lines so the entire surface is auditable in one read.

**`signSession` / `verifySession`** — HS256 only. Refuses non-HS256 algorithms (including `alg: "none"`), validates `iat` / `exp` strictly, uses `timingSafeEqual` for the signature compare, and prevents `extras` from spoofing standard claims.

**`createRoleGuard`** — numeric-rank role hierarchy. Default tiers: `GUEST < CLIENT < EMPLOYEE < ADVISOR < PARTNER < OWNER`. Bring your own hierarchy if those don't fit.

**`isInWorkspaceDomain` / `assertWorkspaceDomain`** — restrict sign-in to one or more workspace email domains (case-insensitive; subdomains are *not* auto-allowed).

For RS256 / EdDSA / multi-key scenarios, use a full JWT library behind the `verify`/`sign` shape — this package's role is the *guard* layer, not crypto primitives.
