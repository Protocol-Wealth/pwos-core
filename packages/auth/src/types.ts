// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Standard role tiers. Order is meaningful: each tier inherits the
 * authorities of the tier below it. `isAuthorizedFor(actor, "ADVISOR")`
 * returns true for actors with role `ADVISOR`, `PARTNER`, or `OWNER`.
 *
 * Extend `Role` with custom string roles if your application needs more
 * granularity, but keep the hierarchy declared explicitly via
 * `RoleHierarchy` so guards can resolve "is X authorized for Y" without
 * baking assumptions into the runtime.
 */
export type StandardRole =
  | "GUEST"
  | "CLIENT"
  | "EMPLOYEE"
  | "ADVISOR"
  | "PARTNER"
  | "OWNER";

export type Role = StandardRole | (string & {});

/**
 * Numeric rank for each role, ascending. Higher rank = more authority.
 * Provide a custom hierarchy if your role set differs.
 */
export type RoleHierarchy = Record<Role, number>;

export const STANDARD_ROLE_HIERARCHY: RoleHierarchy = Object.freeze({
  GUEST: 0,
  CLIENT: 10,
  EMPLOYEE: 20,
  ADVISOR: 30,
  PARTNER: 40,
  OWNER: 50,
});

/**
 * Session claims persisted in the JWT. Standard JWT registered claims plus
 * the role and workspace-domain claims advisors need at the route layer.
 *
 * `email` is required for the workspace-domain guard; everything else is
 * standard JWT.
 */
export interface SessionClaims {
  /** Subject — opaque user id. */
  sub: string;
  /** Email used for workspace-domain enforcement. */
  email: string;
  /** Role claim — drives `isAuthorizedFor` resolution. */
  role: Role;
  /** Issued-at, epoch seconds. */
  iat: number;
  /** Expires-at, epoch seconds. */
  exp: number;
  /** Issuer (your application identifier). */
  iss?: string;
  /** Audience. */
  aud?: string;
  /** Optional opaque session id for revocation lookups. */
  sid?: string;
  /** Caller-defined extras (kept on the JWT, surfaced on verify). */
  [extra: string]: unknown;
}
