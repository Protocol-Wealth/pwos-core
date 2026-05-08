// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * @protocolwealthos/security-headers — framework-agnostic builders for
 * the standard browser security headers.
 *
 * Returns a flat `Record<string, string>` you can hand to any HTTP
 * framework's response object. No middleware adapter, no opinions
 * about your routing.
 *
 * Default posture is intentionally strict: HSTS preload (2-year
 * max-age), X-Frame-Options DENY, Permissions-Policy locking down
 * sensors and payment, strict-origin-when-cross-origin Referrer-Policy.
 * Override per-application as needed.
 */

export {
  buildCspHeader,
  strictBaseline,
  applyDevOverrides,
  toHashSource,
  sha256Hex,
} from "./cspBuilder.js";
export type {
  StrictBaselineOptions,
  DevOverrideOptions,
} from "./cspBuilder.js";

export {
  buildHsts,
  buildPermissionsPolicy,
  buildSecurityHeaders,
} from "./headers.js";
export type {
  BuildSecurityHeadersOptions,
  FrameOptions,
  HstsOptions,
  PermissionsPolicyDirectives,
  ReferrerPolicy,
} from "./headers.js";

export type { BuildMode, CspDirectives, CspSource, HeaderMap } from "./types.js";
