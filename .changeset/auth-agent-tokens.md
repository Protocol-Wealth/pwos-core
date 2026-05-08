---
"@protocolwealthos/auth": minor
---

Add per-agent scoped tokens — for granting external AI clients (Claude / ChatGPT / Cursor / vendor agents) narrowed access separate from human user sessions.

**Different from `signSession` / `verifySession`:**
- No `email` requirement (agents aren't users)
- Carries `agentId` + `scope` claims (level: `read_only` / `read_write` / `admin`, plus optional `resources` array for resource-level scoping like `["household:hh_123"]`)
- Carries `tokenId` so a revocation list can deny the token before its `exp`
- Default TTL is shorter (1 hour vs 15 min for user sessions)

**Revocation:** caller supplies a `RevocationList` interface (`isRevoked(tokenId)`, `revoke(tokenId)`). Backed by Redis SET / Postgres index / in-memory `Set` in production; ships `InMemoryRevocationList` for tests.

**`hasScope(claims, required, requiredResource?)`** — convenience: true if the agent's scope satisfies the required permission level AND (when supplied) the agent's `resources` array either is empty (unconstrained) or includes the required resource.

Same crypto path as user sessions (HS256 / hand-rolled / `timingSafeEqual` / refuses non-HS256 / extras can't spoof standard claims). Verification is async because revocation-list lookup is async.

New exports: `signAgentToken`, `verifyAgentToken`, `hasScope`, `InMemoryRevocationList`, types `AgentScope`, `AgentScopeClaim`, `AgentTokenClaims`, `RevocationList`, `SignAgentTokenOptions`, `VerifyAgentTokenOptions`.
