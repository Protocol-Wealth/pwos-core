// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Role-hierarchy guard.
 *
 * Resolves "is actor with role X authorized for an operation requiring
 * role Y" against a numeric rank table. Higher rank = more authority;
 * the actor must rank at or above the required role.
 *
 * The hierarchy is data — not baked into the runtime — so applications
 * can model their own role tiers and guards still compose.
 */

import { STANDARD_ROLE_HIERARCHY } from "./types.js";
import type { Role, RoleHierarchy } from "./types.js";

export class UnknownRoleError extends Error {
  readonly role: string;
  constructor(role: string) {
    super(`Unknown role "${role}" — not present in the configured hierarchy.`);
    this.name = "UnknownRoleError";
    this.role = role;
  }
}

export interface RoleGuard {
  /** True if `actor` ranks at or above `required`. */
  isAuthorizedFor(actor: Role, required: Role): boolean;
  /** Throws if not authorized. */
  assertAuthorizedFor(actor: Role, required: Role): void;
  /** Numeric rank for a role. Throws `UnknownRoleError` if the role is unknown. */
  rankOf(role: Role): number;
  /** The hierarchy passed at construction time (frozen reference). */
  readonly hierarchy: RoleHierarchy;
}

export class UnauthorizedError extends Error {
  readonly actor: Role;
  readonly required: Role;
  constructor(actor: Role, required: Role) {
    super(`Role "${actor}" is not authorized for operations requiring "${required}".`);
    this.name = "UnauthorizedError";
    this.actor = actor;
    this.required = required;
  }
}

/**
 * Build a guard against a custom hierarchy. Default is
 * `STANDARD_ROLE_HIERARCHY` (GUEST < CLIENT < EMPLOYEE < ADVISOR <
 * PARTNER < OWNER).
 */
export function createRoleGuard(
  hierarchy: RoleHierarchy = STANDARD_ROLE_HIERARCHY
): RoleGuard {
  function rankOf(role: Role): number {
    const rank = hierarchy[role];
    if (rank === undefined) {
      throw new UnknownRoleError(String(role));
    }
    return rank;
  }
  function isAuthorizedFor(actor: Role, required: Role): boolean {
    return rankOf(actor) >= rankOf(required);
  }
  function assertAuthorizedFor(actor: Role, required: Role): void {
    if (!isAuthorizedFor(actor, required)) {
      throw new UnauthorizedError(actor, required);
    }
  }
  return { isAuthorizedFor, assertAuthorizedFor, rankOf, hierarchy };
}
