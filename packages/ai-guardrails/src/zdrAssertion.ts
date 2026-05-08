// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Workspace assertion — fail-fast at boot if the configured workspace
 * doesn't match expectations.
 *
 * Why: vendors like Anthropic offer per-workspace data-retention controls
 * (e.g. Zero Data Retention). A credential rotation that silently moves
 * traffic to a non-ZDR workspace would route firm data through a path that
 * doesn't satisfy your obligations. Asserting at boot turns a silent
 * misconfiguration into a loud crash.
 *
 * The assertion is content-free: we compare workspace ids, not data.
 */

import type {
  GuardrailPosture,
  WorkspaceAssertionConfig,
} from "./types.js";

export class WorkspaceMismatchError extends Error {
  readonly expected: string;
  readonly actual: string | undefined;
  constructor(expected: string, actual: string | undefined) {
    super(
      `AI workspace assertion failed: expected "${expected}", got "${actual ?? "<unset>"}".`
    );
    this.name = "WorkspaceMismatchError";
    this.expected = expected;
    this.actual = actual;
  }
}

export interface AssertWorkspaceResult {
  ok: boolean;
  posture: GuardrailPosture;
  message: string;
}

/**
 * Assert a workspace id matches the expected value.
 *
 * - Throws `WorkspaceMismatchError` if posture is `block` (default).
 * - Returns `{ ok: false, posture: "warn", message }` if posture is `warn`.
 * - Returns `{ ok: true }` on match.
 *
 * Call this at process start — before any AI client is constructed —
 * so a misconfigured deploy never ships its first request.
 */
export function assertWorkspace(
  config: WorkspaceAssertionConfig
): AssertWorkspaceResult {
  const posture = config.posture ?? "block";
  if (config.actual === config.expected) {
    return { ok: true, posture, message: "workspace match" };
  }
  const err = new WorkspaceMismatchError(config.expected, config.actual);
  if (posture === "block") {
    throw err;
  }
  return { ok: false, posture, message: err.message };
}

/**
 * Convenience: read a workspace id from `process.env[envVar]` and assert.
 * Most consumers want this form. Returns the asserted value on success.
 */
export function assertWorkspaceFromEnv(
  expected: string,
  envVar: string,
  posture: GuardrailPosture = "block"
): AssertWorkspaceResult {
  const actual = typeof process !== "undefined" ? process.env?.[envVar] : undefined;
  return assertWorkspace({ expected, actual, posture });
}
