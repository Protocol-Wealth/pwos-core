// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Workspace-domain guard.
 *
 * Many advisor platforms gate sign-in to "only employees of a particular
 * Google Workspace / Microsoft 365 tenant". Configure one or more
 * allowed domains; reject any session whose email is outside.
 *
 * Comparison is case-insensitive and trims whitespace. Subdomains are
 * NOT auto-allowed — `marketing.example.com` does not satisfy
 * `example.com` unless you explicitly list it.
 */

export class WorkspaceDomainError extends Error {
  readonly email: string;
  readonly allowed: readonly string[];
  constructor(email: string, allowed: readonly string[]) {
    super(
      `Email "${email}" is not in any allowed workspace domain (${allowed.join(", ") || "<none configured>"}).`
    );
    this.name = "WorkspaceDomainError";
    this.email = email;
    this.allowed = allowed;
  }
}

function extractDomain(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at === -1 || at === trimmed.length - 1) return null;
  return trimmed.slice(at + 1);
}

/** True if the email's domain is in the allowed list. */
export function isInWorkspaceDomain(
  email: string,
  allowedDomains: readonly string[]
): boolean {
  const domain = extractDomain(email);
  if (!domain) return false;
  return allowedDomains.some((d) => d.trim().toLowerCase() === domain);
}

/** Throws `WorkspaceDomainError` if the email's domain is not allowed. */
export function assertWorkspaceDomain(
  email: string,
  allowedDomains: readonly string[]
): void {
  if (!isInWorkspaceDomain(email, allowedDomains)) {
    throw new WorkspaceDomainError(email, allowedDomains);
  }
}
