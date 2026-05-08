// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Standard security-header builders.
 *
 * Each function returns a value suitable for the named header. Compose
 * via `buildSecurityHeaders` to get a flat map you can hand to any
 * framework's response object.
 */

import type { BuildMode, CspDirectives, HeaderMap } from "./types.js";
import { buildCspHeader } from "./cspBuilder.js";

export interface HstsOptions {
  /** Max-age in seconds. Default 63072000 (2 years — preload list requirement). */
  maxAgeSeconds?: number;
  /** Include subdomains. Default true. */
  includeSubDomains?: boolean;
  /** Mark eligible for browser preload list. Default true. */
  preload?: boolean;
}

export function buildHsts(options: HstsOptions = {}): string {
  const maxAge = options.maxAgeSeconds ?? 63072000;
  const parts = [`max-age=${maxAge}`];
  if (options.includeSubDomains ?? true) parts.push("includeSubDomains");
  if (options.preload ?? true) parts.push("preload");
  return parts.join("; ");
}

export type FrameOptions = "DENY" | "SAMEORIGIN";

export type ReferrerPolicy =
  | "no-referrer"
  | "no-referrer-when-downgrade"
  | "origin"
  | "origin-when-cross-origin"
  | "same-origin"
  | "strict-origin"
  | "strict-origin-when-cross-origin"
  | "unsafe-url";

export interface PermissionsPolicyDirectives {
  /** Map directive → `*` for all, `()` for none, or a list of allowed origins. */
  [directive: string]: "*" | "()" | readonly string[];
}

/** Serialize Permissions-Policy. */
export function buildPermissionsPolicy(
  directives: PermissionsPolicyDirectives
): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(directives)) {
    if (v === "*") parts.push(`${k}=*`);
    else if (v === "()") parts.push(`${k}=()`);
    else if (Array.isArray(v))
      parts.push(`${k}=(${v.map((s) => `"${s}"`).join(" ")})`);
  }
  return parts.join(", ");
}

export interface BuildSecurityHeadersOptions {
  mode: BuildMode;
  csp: CspDirectives;
  hsts?: HstsOptions | false;
  frameOptions?: FrameOptions;
  referrerPolicy?: ReferrerPolicy;
  /** Permissions-Policy directives. Common locked-down defaults applied if omitted. */
  permissionsPolicy?: PermissionsPolicyDirectives;
}

const DEFAULT_PERMISSIONS_POLICY: PermissionsPolicyDirectives = {
  accelerometer: "()",
  camera: "()",
  geolocation: "()",
  gyroscope: "()",
  magnetometer: "()",
  microphone: "()",
  payment: "()",
  usb: "()",
};

/** Compose all standard security headers into a flat map. */
export function buildSecurityHeaders(
  options: BuildSecurityHeadersOptions
): HeaderMap {
  const headers: HeaderMap = {
    "Content-Security-Policy": buildCspHeader(options.csp),
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": options.frameOptions ?? "DENY",
    "Referrer-Policy": options.referrerPolicy ?? "strict-origin-when-cross-origin",
    "Permissions-Policy": buildPermissionsPolicy(
      options.permissionsPolicy ?? DEFAULT_PERMISSIONS_POLICY
    ),
  };
  // HSTS only on production; localhost browsers reject it in dev anyway.
  if (options.mode === "production" && options.hsts !== false) {
    headers["Strict-Transport-Security"] = buildHsts(options.hsts ?? {});
  }
  return headers;
}
