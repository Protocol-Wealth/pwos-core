// SPDX-License-Identifier: MIT-0 OR Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Workspace configuration assertion.
 *
 * Vendors expose per-workspace data-retention controls. A helper in this
 * package cannot see that contract. `assertWorkspace` compares a workspace
 * id the caller supplies with a workspace id the caller expects. Both
 * values are local configuration. Rotating the API key while leaving the
 * workspace id in place does not change the result, unless the caller also
 * passes a fingerprint of the credential that will sign requests and an
 * allowlist of fingerprints maintained outside that env var.
 *
 * What a passing result means:
 *   - `assurance: "configuration"` — the workspace ids matched. Credential
 *     membership was not checked. Provider retention was not checked.
 *   - `assurance: "configuration-and-credential"` — the ids matched and
 *     the fingerprint was in the caller-supplied allowlist. Provider
 *     retention was still not checked. The allowlist is only as trustworthy
 *     as the process that put fingerprints in it.
 *
 * `retentionVerified` is always `false`. This module does not call a
 * provider, does not log credentials, and does not infer a retention
 * policy from a locally editable value. Call it at boot, and again with
 * the fingerprint of the key a given request will send, before you treat
 * the process as pointed at the workspace you configured.
 */

import { timingSafeEqual } from "node:crypto";

import { sha256Hex } from "./auditRow.js";
import type { CredentialProvenance, GuardrailPosture, WorkspaceAssertionConfig } from "./types.js";

export class WorkspaceMismatchError extends Error {
  readonly expected: string;
  readonly actual: string | undefined;
  constructor(expected: string, actual: string | undefined) {
    super(
      `AI workspace assertion failed: expected "${expected}", got "${actual ?? "<unset>"}". ` +
        `This check compares configured workspace ids. It does not verify provider retention or which credential signs requests.`,
    );
    this.name = "WorkspaceMismatchError";
    this.expected = expected;
    this.actual = actual;
  }
}

/**
 * The signing credential's fingerprint was missing or not in the
 * caller-supplied allowlist. The workspace id may still have matched.
 */
export class CredentialBindingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CredentialBindingError";
  }
}

export type WorkspaceAssurance = "configuration" | "configuration-and-credential";

export type CredentialFingerprintStatus = "not-provided" | "unchecked" | "allowed" | "rejected";

export interface AssertWorkspaceResult {
  ok: boolean;
  posture: GuardrailPosture;
  message: string;
  /**
   * How far this call looked. Never a provider retention verdict.
   * `"configuration-and-credential"` means the fingerprint was on the
   * caller-supplied list, not that the vendor confirmed the workspace.
   */
  assurance: WorkspaceAssurance;
  /** Always false. This helper does not verify a provider retention policy. */
  retentionVerified: false;
  credentialFingerprint: CredentialFingerprintStatus;
}

const CONFIGURATION_OK =
  "Configured workspace id matches. This is a configuration assertion only: provider retention policy was not verified, and credential membership was not checked.";

const CREDENTIAL_OK =
  "Configured workspace id matches and the signing-credential fingerprint is in the caller-supplied allowlist. Provider retention policy was not verified.";

const CREDENTIAL_MISSING =
  "Signing credential fingerprint was not supplied. A matching workspace id does not verify credential membership or provider retention.";

const CREDENTIAL_REJECTED =
  "Signing credential fingerprint is not in the caller-supplied allowlist. Workspace id configuration was not treated as retention compliance.";

/**
 * SHA-256 hex of the credential that will sign requests.
 * Pass the result as `CredentialProvenance.fingerprint`. Do not log `secret`.
 */
export function fingerprintCredential(secret: string | Buffer): string {
  return sha256Hex(typeof secret === "string" ? secret : secret);
}

function fingerprintListed(fingerprint: string, allowed: readonly string[]): boolean {
  const candidate = Buffer.from(fingerprint, "utf8");
  let matched = false;
  for (const entry of allowed) {
    const other = Buffer.from(entry, "utf8");
    if (other.length === candidate.length && timingSafeEqual(candidate, other)) {
      matched = true;
    }
  }
  return matched;
}

interface CredentialCheck {
  ok: boolean;
  message: string;
  assurance: WorkspaceAssurance;
  credentialFingerprint: CredentialFingerprintStatus;
}

function checkCredential(config: WorkspaceAssertionConfig): CredentialCheck {
  if (config.allowedCredentialFingerprints === undefined) {
    return {
      ok: true,
      message: CONFIGURATION_OK,
      assurance: "configuration",
      credentialFingerprint: config.credential ? "unchecked" : "not-provided",
    };
  }
  const credential: CredentialProvenance | undefined = config.credential;
  if (!credential || credential.fingerprint.length === 0 || credential.source.length === 0) {
    return {
      ok: false,
      message: CREDENTIAL_MISSING,
      assurance: "configuration",
      credentialFingerprint: "rejected",
    };
  }
  if (!fingerprintListed(credential.fingerprint, config.allowedCredentialFingerprints)) {
    return {
      ok: false,
      message: CREDENTIAL_REJECTED,
      assurance: "configuration",
      credentialFingerprint: "rejected",
    };
  }
  return {
    ok: true,
    message: CREDENTIAL_OK,
    assurance: "configuration-and-credential",
    credentialFingerprint: "allowed",
  };
}

function fail(posture: GuardrailPosture, error: Error, credential: CredentialCheck): AssertWorkspaceResult {
  if (posture === "block") throw error;
  return {
    ok: false,
    posture,
    message: error.message,
    assurance: credential.assurance,
    retentionVerified: false,
    credentialFingerprint: credential.credentialFingerprint,
  };
}

/**
 * Assert configured workspace identity, and optionally the signing credential.
 *
 * - Throws `WorkspaceMismatchError` when the workspace ids differ and
 *   posture is `block` (the default).
 * - Throws `CredentialBindingError` when an allowlist is set and the
 *   signing-credential fingerprint is missing or not listed.
 * - Returns `{ ok: false }` instead of throwing when posture is `warn`.
 * - A successful result still has `retentionVerified: false`.
 */
export function assertWorkspace(config: WorkspaceAssertionConfig): AssertWorkspaceResult {
  const posture = config.posture ?? "block";
  const credential = checkCredential(config);
  if (config.actual !== config.expected) {
    return fail(posture, new WorkspaceMismatchError(config.expected, config.actual), {
      ...credential,
      assurance: "configuration",
      credentialFingerprint: credential.ok ? credential.credentialFingerprint : "rejected",
    });
  }
  if (!credential.ok) {
    return fail(posture, new CredentialBindingError(credential.message), credential);
  }
  return {
    ok: true,
    posture,
    message: credential.message,
    assurance: credential.assurance,
    retentionVerified: false,
    credentialFingerprint: credential.credentialFingerprint,
  };
}

export interface AssertWorkspaceFromEnvBinding {
  credential?: CredentialProvenance;
  allowedCredentialFingerprints?: readonly string[];
}

/**
 * Read a workspace id from `process.env[envVar]` and assert it.
 *
 * The environment variable is configuration. It is not the credential
 * that signs a request. Pass `binding` with a fingerprint of that
 * credential when a key rotation must fail this check even though the
 * workspace id did not change.
 */
export function assertWorkspaceFromEnv(
  expected: string,
  envVar: string,
  posture: GuardrailPosture = "block",
  binding?: AssertWorkspaceFromEnvBinding,
): AssertWorkspaceResult {
  const actual = typeof process !== "undefined" ? process.env?.[envVar] : undefined;
  return assertWorkspace({
    expected,
    actual,
    posture,
    credential: binding?.credential,
    allowedCredentialFingerprints: binding?.allowedCredentialFingerprints,
  });
}
