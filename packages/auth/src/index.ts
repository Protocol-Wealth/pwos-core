// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * @protocolwealthos/auth — JWT session signing/verification, role
 * hierarchy guards, and workspace-domain restriction.
 *
 * Zero runtime dependencies. The HS256 implementation is hand-rolled in
 * ~80 lines so the entire surface is auditable in one read.
 */

export {
  signSession,
  verifySession,
  JwtError,
} from "./jwtSession.js";
export type {
  SignSessionOptions,
  VerifySessionOptions,
} from "./jwtSession.js";

export {
  createRoleGuard,
  UnauthorizedError,
  UnknownRoleError,
} from "./roleGuard.js";
export type { RoleGuard } from "./roleGuard.js";

export {
  isInWorkspaceDomain,
  assertWorkspaceDomain,
  WorkspaceDomainError,
} from "./workspaceDomainGuard.js";

export { STANDARD_ROLE_HIERARCHY } from "./types.js";
export type {
  Role,
  RoleHierarchy,
  SessionClaims,
  StandardRole,
} from "./types.js";
