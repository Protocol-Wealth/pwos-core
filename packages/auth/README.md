# @protocolwealthos/auth

> JWT session signing/verification, role-hierarchy guards, and workspace-domain restriction. Zero runtime dependencies.

Apache 2.0 · Patent Pending: USPTO #64/034,215 · part of [pwos-core](https://github.com/Protocol-Wealth/pwos-core).

## What's in the box

- **`signSession` / `verifySession`** — HS256 JWT, hand-rolled in ~80 lines. Refuses non-HS256 algorithms (including `alg: "none"`), validates `iat`/`exp` strictly, uses `timingSafeEqual` on the signature compare. Designed to be auditable in one read.
- **`createRoleGuard`** — numeric-rank role hierarchy with `isAuthorizedFor` / `assertAuthorizedFor`. Default tiers: `GUEST < CLIENT < EMPLOYEE < ADVISOR < PARTNER < OWNER`. Bring your own hierarchy if those don't fit.
- **`isInWorkspaceDomain` / `assertWorkspaceDomain`** — restrict sign-in to one or more workspace email domains (e.g. your Google Workspace tenant). Case-insensitive; subdomains are *not* auto-allowed.

## Install

```sh
pnpm add @protocolwealthos/auth
```

## Quick start

```ts
import {
  signSession,
  verifySession,
  createRoleGuard,
  assertWorkspaceDomain,
} from "@protocolwealthos/auth";

const SECRET = process.env.SESSION_SECRET!; // 32+ random bytes per env

// At sign-in, after Google SSO succeeds:
assertWorkspaceDomain(googleUser.email, ["example.com"]);
const token = signSession(SECRET, {
  sub: googleUser.id,
  email: googleUser.email,
  role: "ADVISOR",
  ttlSeconds: 900, // 15 minutes
  iss: "pwos-core",
  aud: "advisor-platform",
});

// On every request:
const claims = verifySession(SECRET, request.cookies.session, {
  expectedIssuer: "pwos-core",
  expectedAudience: "advisor-platform",
});

const guard = createRoleGuard();
guard.assertAuthorizedFor(claims.role, "ADVISOR"); // throws if rank too low
```

## Why HS256 only

This package's HS256 implementation lives in `src/jwtSession.ts` — about 80 lines including all validation. You can read the entire crypto path in one sitting. RS256 / EdDSA with key rotation across multiple verifiers is genuinely worth a full library; we don't ship that here. Use `jose` or `jsonwebtoken` if you need it.

What we *do* refuse explicitly:

- `alg: "none"` — refused by alg check
- Non-`HS256` headers — refused by alg check
- Tampered payloads — caught by signature compare (`timingSafeEqual`)
- Expired tokens — `exp` validation with optional clock-skew
- Future-dated tokens — `iat` validation
- Missing `sub` / `email` / `role` / `iat` / `exp` — `missing_claim` error
- Issuer/audience drift — when you opt in via `expectedIssuer` / `expectedAudience`

## Role hierarchy

```ts
import { createRoleGuard, STANDARD_ROLE_HIERARCHY } from "@protocolwealthos/auth";

// Default hierarchy: GUEST(0) < CLIENT(10) < EMPLOYEE(20) < ADVISOR(30) < PARTNER(40) < OWNER(50)
const standard = createRoleGuard();

// Custom hierarchy:
const custom = createRoleGuard({ READER: 1, WRITER: 2, ADMIN: 3 });
custom.isAuthorizedFor("WRITER", "READER"); // true
```

## Workspace-domain restriction

```ts
import { assertWorkspaceDomain } from "@protocolwealthos/auth";

assertWorkspaceDomain("advisor@example.com", ["example.com"]); // ok
assertWorkspaceDomain("advisor@marketing.example.com", ["example.com"]); // throws — subdomains not auto-allowed
```

## License

Apache 2.0 with USPTO Application #64/034,215 defensive patent grant. See repo `LICENSE`, `NOTICE`, and `PATENTS.txt`.
