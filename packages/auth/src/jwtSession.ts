// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Minimal HS256 JWT signer/verifier.
 *
 * Why hand-rolled instead of `jsonwebtoken` / `jose`: this package is
 * intentionally zero-dep so consumers can audit the entire surface in
 * one read. HS256 is small enough that the implementation is auditable
 * in ~80 lines. We refuse non-HS256 algorithms, refuse the "none"
 * algorithm, validate `iat` / `exp` strictly, and use `timingSafeEqual`
 * for the signature compare.
 *
 * For RS256 / EdDSA / multi-key scenarios, use a full JWT library
 * behind the `verify`/`sign` shape exposed here (or just call your
 * library directly — this package's role is the *guard* layer, not
 * crypto primitives).
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type { Role, SessionClaims } from "./types.js";

const ALG = "HS256";

export class JwtError extends Error {
  readonly code:
    | "malformed"
    | "bad_alg"
    | "bad_signature"
    | "expired"
    | "not_yet_valid"
    | "missing_claim"
    | "issuer_mismatch"
    | "audience_mismatch";
  constructor(code: JwtError["code"], detail: string) {
    super(`jwt ${code}: ${detail}`);
    this.name = "JwtError";
    this.code = code;
  }
}

/** Base64url encode a string or Buffer.
 *
 * `=` is stripped via `replace(/=/g, "")` rather than `/=+$/g` —
 * functionally identical for base64 (where `=` only appears as 0–2
 * trailing padding chars) but the non-quantifier form avoids the
 * polynomial-redos pattern CodeQL flags on the anchored variant.
 */
function b64url(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function b64urlDecodeToString(input: string): string {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const b64 = (input + pad).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64").toString("utf8");
}

function hmacSha256(secret: string | Buffer, message: string): Buffer {
  const h = createHmac("sha256", secret);
  h.update(message);
  return h.digest();
}

export interface SignSessionOptions {
  /** Subject (user id). */
  sub: string;
  email: string;
  role: Role;
  /** Lifetime in seconds. Recommended: 900 (15 min). */
  ttlSeconds: number;
  iss?: string;
  aud?: string;
  sid?: string;
  /** Extra claims to embed (must JSON-serialize). */
  extras?: Record<string, unknown>;
  /** Inject for tests; defaults to `() => Math.floor(Date.now() / 1000)`. */
  nowSec?: () => number;
}

/**
 * Sign a session JWT with HS256. Use a 32+ byte random secret per
 * environment; rotate by re-keying with grace overlap if you need
 * zero-downtime.
 */
export function signSession(
  secret: string | Buffer,
  options: SignSessionOptions
): string {
  const now =
    options.nowSec?.() ?? Math.floor(Date.now() / 1000);
  // Spread `extras` first so standard claims always take precedence —
  // a caller can't accidentally (or maliciously) override `sub` / `exp`
  // by passing them through the extras bag.
  const claims: SessionClaims = {
    ...(options.extras ?? {}),
    sub: options.sub,
    email: options.email,
    role: options.role,
    iat: now,
    exp: now + options.ttlSeconds,
    ...(options.iss !== undefined && { iss: options.iss }),
    ...(options.aud !== undefined && { aud: options.aud }),
    ...(options.sid !== undefined && { sid: options.sid }),
  };
  const headerB64 = b64url(JSON.stringify({ alg: ALG, typ: "JWT" }));
  const payloadB64 = b64url(JSON.stringify(claims));
  const signingInput = `${headerB64}.${payloadB64}`;
  const sig = b64url(hmacSha256(secret, signingInput));
  return `${signingInput}.${sig}`;
}

export interface VerifySessionOptions {
  /** Required issuer; throws `issuer_mismatch` if claim diverges. */
  expectedIssuer?: string;
  /** Required audience; throws `audience_mismatch` if claim diverges. */
  expectedAudience?: string;
  /** Allowed clock skew when comparing `exp` (seconds). Default 0. */
  clockSkewSec?: number;
  nowSec?: () => number;
}

/**
 * Verify a session JWT signed with HS256.
 *
 * Throws `JwtError` on:
 *   - malformed token (not 3 parts, bad base64, bad JSON)
 *   - non-HS256 alg (including "none")
 *   - signature mismatch
 *   - expired (with optional skew)
 *   - missing required claims
 *   - issuer/audience mismatch
 *
 * Returns the parsed claims on success.
 */
export function verifySession(
  secret: string | Buffer,
  token: string,
  options: VerifySessionOptions = {}
): SessionClaims {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new JwtError("malformed", "expected 3 dot-separated segments");
  }
  const [headerB64, payloadB64, sigB64] = parts as [string, string, string];

  let header: { alg?: unknown; typ?: unknown };
  try {
    header = JSON.parse(b64urlDecodeToString(headerB64));
  } catch {
    throw new JwtError("malformed", "header is not valid JSON");
  }
  if (header.alg !== ALG) {
    throw new JwtError("bad_alg", `expected ${ALG}, got ${String(header.alg)}`);
  }

  // Verify signature BEFORE parsing payload — defense against payload-shaped
  // attacks via parsing side effects.
  const expectedSig = b64url(hmacSha256(secret, `${headerB64}.${payloadB64}`));
  const a = Buffer.from(sigB64);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new JwtError("bad_signature", "signature does not match");
  }

  let claims: SessionClaims;
  try {
    claims = JSON.parse(b64urlDecodeToString(payloadB64));
  } catch {
    throw new JwtError("malformed", "payload is not valid JSON");
  }

  for (const required of ["sub", "email", "role", "iat", "exp"] as const) {
    if (claims[required] === undefined || claims[required] === null) {
      throw new JwtError("missing_claim", required);
    }
  }

  const now = options.nowSec?.() ?? Math.floor(Date.now() / 1000);
  const skew = options.clockSkewSec ?? 0;
  if (typeof claims.exp !== "number" || claims.exp + skew < now) {
    throw new JwtError("expired", `exp=${claims.exp} now=${now}`);
  }
  if (typeof claims.iat !== "number" || claims.iat - skew > now) {
    throw new JwtError("not_yet_valid", `iat=${claims.iat} now=${now}`);
  }

  if (options.expectedIssuer !== undefined && claims.iss !== options.expectedIssuer) {
    throw new JwtError(
      "issuer_mismatch",
      `expected ${options.expectedIssuer}, got ${String(claims.iss)}`
    );
  }
  if (options.expectedAudience !== undefined && claims.aud !== options.expectedAudience) {
    throw new JwtError(
      "audience_mismatch",
      `expected ${options.expectedAudience}, got ${String(claims.aud)}`
    );
  }

  return claims;
}
