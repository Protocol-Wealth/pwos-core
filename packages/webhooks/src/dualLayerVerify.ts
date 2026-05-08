// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Dual-layer webhook verification.
 *
 * Pattern: defense-in-depth for vendors that don't sign the body but
 * deliver a "secret" in the URL or as Basic Auth. Each layer alone is
 * weak against credential leakage; together they raise the bar.
 *
 * Layer 1 — path token: `https://your-app/webhooks/<vendor>/<TOKEN>`
 *   The TOKEN is a long random per-environment secret. A leaked URL
 *   (referer logs, browser history, naive screenshot) would let the
 *   attacker hit the endpoint, so:
 *
 * Layer 2 — Basic Auth header: `Authorization: Basic base64(user:pass)`
 *   A second secret, scoped differently (e.g. password-vault entry
 *   instead of URL fragment). Both must match.
 *
 * Both compares are timing-safe.
 *
 * Use this for vendors that don't ship HMAC body signing (Postmark
 * inbound parse, some legacy webhooks). For vendors that *do* sign,
 * prefer `verifyHmacSha256` instead — body signing is strictly
 * stronger.
 */

import { timingSafeEqual } from "node:crypto";
import type { VerificationResult } from "./types.js";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export interface DualLayerOptions {
  /** Token delivered in the URL (e.g. last path segment). */
  pathToken: string;
  /** Token expected by the application. */
  expectedPathToken: string;
  /** Authorization header value (raw, e.g. `"Basic dXNlcjpwYXNz"`). */
  authorizationHeader: string | undefined;
  /** Expected Basic Auth user. */
  expectedBasicUser: string;
  /** Expected Basic Auth password. */
  expectedBasicPassword: string;
}

export function verifyDualLayer(options: DualLayerOptions): VerificationResult {
  if (!safeEqual(options.pathToken, options.expectedPathToken)) {
    return { ok: false, code: "path_token_mismatch", detail: "path token did not match" };
  }
  const auth = options.authorizationHeader ?? "";
  if (!auth.startsWith("Basic ")) {
    return { ok: false, code: "missing_basic_auth", detail: "Authorization header is missing or not Basic" };
  }
  let decoded: string;
  try {
    decoded = Buffer.from(auth.slice("Basic ".length).trim(), "base64").toString("utf8");
  } catch {
    return { ok: false, code: "malformed_basic_auth", detail: "Authorization header is not valid base64" };
  }
  const idx = decoded.indexOf(":");
  if (idx === -1) {
    return { ok: false, code: "malformed_basic_auth", detail: "Basic auth body lacks ':' separator" };
  }
  const user = decoded.slice(0, idx);
  const pass = decoded.slice(idx + 1);
  if (!safeEqual(user, options.expectedBasicUser)) {
    return { ok: false, code: "basic_user_mismatch", detail: "basic auth user did not match" };
  }
  if (!safeEqual(pass, options.expectedBasicPassword)) {
    return { ok: false, code: "basic_password_mismatch", detail: "basic auth password did not match" };
  }
  return { ok: true };
}
