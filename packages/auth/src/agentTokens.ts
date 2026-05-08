// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Per-agent scoped tokens.
 *
 * The era.app pattern adapted to advisor platforms: when an external
 * AI client (Claude / ChatGPT / Cursor / a vendor agent) needs to
 * call your tools, mint it a **separate token from the human session**
 * with a narrower scope and an explicit revocation path.
 *
 * Different from `signSession`/`verifySession`:
 *   - No `email` requirement (agents aren't users)
 *   - Carries `agentId` + `scope` claims
 *   - Carries `tokenId` so a revocation list can deny it
 *   - Default TTL is shorter (1 hour vs 15 min for user sessions)
 *
 * Revocation: caller supplies a `RevocationList` interface (Redis,
 * Postgres, in-memory). Verification fails if the token's `tokenId`
 * is in the list. The list is the source of truth; the token by itself
 * never expires faster than its `exp`.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { JwtError } from "./jwtSession.js";

const ALG = "HS256";

export type AgentScope = "read_only" | "read_write" | "admin";

/** A scope with optional resource constraints. */
export interface AgentScopeClaim {
  /** Permission level. */
  level: AgentScope;
  /**
   * Optional resource scoping (e.g. `["household:hh_123"]` or
   * `["account:acc_456:read"]`). Empty array = unconstrained at the
   * level granted.
   */
  resources?: readonly string[];
}

export interface AgentTokenClaims {
  /** Subject — the agent's stable id (e.g. `"agent:claude:user_123"`). */
  sub: string;
  /** Agent identifier — vendor + instance. */
  agentId: string;
  scope: AgentScopeClaim;
  /** Per-token id; revocation lists check against this. */
  tokenId: string;
  /** Issued-at, epoch seconds. */
  iat: number;
  /** Expires-at, epoch seconds. */
  exp: number;
  iss?: string;
  aud?: string;
  [extra: string]: unknown;
}

export interface SignAgentTokenOptions {
  /** Agent's stable id. */
  sub: string;
  agentId: string;
  scope: AgentScopeClaim;
  /** Stable per-token id (UUID / ULID recommended). */
  tokenId: string;
  /** Lifetime in seconds. Default 3600 (1 hour). */
  ttlSeconds?: number;
  iss?: string;
  aud?: string;
  extras?: Record<string, unknown>;
  nowSec?: () => number;
}

function b64url(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/=+$/g, "")
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

/** Sign an agent token with HS256. */
export function signAgentToken(
  secret: string | Buffer,
  options: SignAgentTokenOptions
): string {
  const now = options.nowSec?.() ?? Math.floor(Date.now() / 1000);
  const ttl = options.ttlSeconds ?? 3600;
  const claims: AgentTokenClaims = {
    ...(options.extras ?? {}),
    sub: options.sub,
    agentId: options.agentId,
    scope: options.scope,
    tokenId: options.tokenId,
    iat: now,
    exp: now + ttl,
    ...(options.iss !== undefined && { iss: options.iss }),
    ...(options.aud !== undefined && { aud: options.aud }),
  };
  const headerB64 = b64url(JSON.stringify({ alg: ALG, typ: "JWT" }));
  const payloadB64 = b64url(JSON.stringify(claims));
  const signingInput = `${headerB64}.${payloadB64}`;
  const sig = b64url(hmacSha256(secret, signingInput));
  return `${signingInput}.${sig}`;
}

/**
 * Revocation list. Implementations should be O(1) lookup —
 * Redis SET, Postgres index, in-memory `Set`. The default
 * `InMemoryRevocationList` is for tests; production should back this
 * with shared storage so all verifiers see the same revocations.
 */
export interface RevocationList {
  isRevoked(tokenId: string): Promise<boolean>;
  revoke(tokenId: string): Promise<void>;
}

export class InMemoryRevocationList implements RevocationList {
  private readonly revoked = new Set<string>();
  async isRevoked(tokenId: string): Promise<boolean> {
    return this.revoked.has(tokenId);
  }
  async revoke(tokenId: string): Promise<void> {
    this.revoked.add(tokenId);
  }
  /** Test helper: clear all revocations. */
  clear(): void {
    this.revoked.clear();
  }
}

export interface VerifyAgentTokenOptions {
  expectedIssuer?: string;
  expectedAudience?: string;
  clockSkewSec?: number;
  nowSec?: () => number;
  /** Optional revocation list. If supplied, throws `revoked` on hit. */
  revocationList?: RevocationList;
}

/** Verify an agent token. Same crypto path as `verifySession`, plus revocation. */
export async function verifyAgentToken(
  secret: string | Buffer,
  token: string,
  options: VerifyAgentTokenOptions = {}
): Promise<AgentTokenClaims> {
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

  const expectedSig = b64url(hmacSha256(secret, `${headerB64}.${payloadB64}`));
  const a = Buffer.from(sigB64);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new JwtError("bad_signature", "signature does not match");
  }

  let claims: AgentTokenClaims;
  try {
    claims = JSON.parse(b64urlDecodeToString(payloadB64));
  } catch {
    throw new JwtError("malformed", "payload is not valid JSON");
  }

  for (const required of ["sub", "agentId", "scope", "tokenId", "iat", "exp"] as const) {
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

  if (options.revocationList) {
    const revoked = await options.revocationList.isRevoked(claims.tokenId);
    if (revoked) {
      throw new JwtError("expired", `token ${claims.tokenId} revoked`);
    }
  }

  return claims;
}

/**
 * Scope check helper. True if the agent's scope satisfies the
 * `required` permission level AND (if `requiredResource` is supplied)
 * the agent's `resources` array either is empty (unconstrained) or
 * includes the required resource.
 */
export function hasScope(
  claims: AgentTokenClaims,
  required: AgentScope,
  requiredResource?: string
): boolean {
  const order: Record<AgentScope, number> = {
    read_only: 0,
    read_write: 1,
    admin: 2,
  };
  if (order[claims.scope.level] < order[required]) return false;
  if (requiredResource === undefined) return true;
  if (!claims.scope.resources || claims.scope.resources.length === 0) return true;
  return claims.scope.resources.includes(requiredResource);
}
