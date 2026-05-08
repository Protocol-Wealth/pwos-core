// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Content-Security-Policy header builder.
 *
 * Two patterns:
 *
 *   - **Production** — strict baseline (`'self'` everywhere, `'none'`
 *     for object-src / frame-ancestors / base-uri, no `'unsafe-inline'`).
 *     Inline scripts ship via sha256 hashes you compute at build time
 *     (see `cspHashExtract` if you'd like a starting point).
 *   - **Development** — same baseline plus permissive entries for HMR
 *     (`ws://`, `'unsafe-inline'` for the dev tooling that injects
 *     style tags). Always isolated to dev.
 *
 * The builder is data-in / string-out. No framework coupling. Plug into
 * Express, Hono, Cloud Run middleware, Fastify, anything.
 */

import { createHash } from "node:crypto";
import type { CspDirectives, CspSource } from "./types.js";

const DIRECTIVE_KEY_TO_NAME: Record<keyof CspDirectives, string> = {
  defaultSrc: "default-src",
  scriptSrc: "script-src",
  styleSrc: "style-src",
  imgSrc: "img-src",
  fontSrc: "font-src",
  connectSrc: "connect-src",
  frameSrc: "frame-src",
  frameAncestors: "frame-ancestors",
  formAction: "form-action",
  baseUri: "base-uri",
  objectSrc: "object-src",
  mediaSrc: "media-src",
  workerSrc: "worker-src",
  manifestSrc: "manifest-src",
  upgradeInsecureRequests: "upgrade-insecure-requests",
  reportUri: "report-uri",
  reportTo: "report-to",
};

/** Serialize a directive map into a CSP header value. */
export function buildCspHeader(directives: CspDirectives): string {
  const parts: string[] = [];
  for (const [key, name] of Object.entries(DIRECTIVE_KEY_TO_NAME) as Array<
    [keyof CspDirectives, string]
  >) {
    const value = directives[key];
    if (value === undefined) continue;
    if (key === "upgradeInsecureRequests") {
      if (value) parts.push(name);
      continue;
    }
    if (key === "reportUri" || key === "reportTo") {
      if (typeof value === "string" && value.length > 0) parts.push(`${name} ${value}`);
      continue;
    }
    if (Array.isArray(value) && value.length > 0) {
      parts.push(`${name} ${value.join(" ")}`);
    }
  }
  return parts.join("; ");
}

/**
 * Strict production CSP baseline. Caller adds:
 *   - `scriptHashes` — sha256 hex hashes of inline scripts (will be
 *     wrapped as `'sha256-<base64>'`)
 *   - `styleHashes` — same, for inline styles
 *   - `connectExtra` — extra `connect-src` entries (analytics, API
 *     subdomains, etc.) beyond `'self'`
 */
export interface StrictBaselineOptions {
  scriptHashes?: readonly string[];
  styleHashes?: readonly string[];
  connectExtra?: readonly CspSource[];
  imgExtra?: readonly CspSource[];
  upgradeInsecureRequests?: boolean;
  reportUri?: string;
}

export function strictBaseline(
  options: StrictBaselineOptions = {}
): CspDirectives {
  return {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", ...(options.scriptHashes ?? []).map(toHashSource)],
    styleSrc: ["'self'", ...(options.styleHashes ?? []).map(toHashSource)],
    imgSrc: ["'self'", "data:", ...(options.imgExtra ?? [])],
    fontSrc: ["'self'", "data:"],
    connectSrc: ["'self'", ...(options.connectExtra ?? [])],
    frameSrc: ["'self'"],
    frameAncestors: ["'none'"],
    formAction: ["'self'"],
    baseUri: ["'self'"],
    objectSrc: ["'none'"],
    workerSrc: ["'self'"],
    manifestSrc: ["'self'"],
    upgradeInsecureRequests: options.upgradeInsecureRequests ?? true,
    ...(options.reportUri !== undefined && { reportUri: options.reportUri }),
  };
}

/**
 * Development overrides. Layer on top of `strictBaseline` for local
 * dev: HMR websocket, inline-style allowance for dev tools, eval for
 * source-map debuggers.
 */
export interface DevOverrideOptions {
  /** WebSocket origin for HMR (e.g. `ws://localhost:5173`). */
  wsOrigin?: string;
  /** Allow `eval` for source-map / dev runtime introspection. */
  allowEval?: boolean;
}

export function applyDevOverrides(
  base: CspDirectives,
  options: DevOverrideOptions = {}
): CspDirectives {
  const ws = options.wsOrigin;
  return {
    ...base,
    scriptSrc: [
      ...(base.scriptSrc ?? []),
      "'unsafe-inline'",
      ...(options.allowEval ? ["'unsafe-eval'" as CspSource] : []),
    ],
    styleSrc: [...(base.styleSrc ?? []), "'unsafe-inline'"],
    connectSrc: [...(base.connectSrc ?? []), ...(ws ? [ws as CspSource] : [])],
    upgradeInsecureRequests: false,
  };
}

/** Wrap a sha256 hex digest as a CSP `'sha256-<base64>'` source. */
export function toHashSource(hexDigest: string): CspSource {
  // Allow callers to pass either hex or already-base64 — detect & convert.
  if (/^[0-9a-f]{64}$/i.test(hexDigest)) {
    const b64 = Buffer.from(hexDigest, "hex").toString("base64");
    return `'sha256-${b64}'`;
  }
  return `'sha256-${hexDigest}'`;
}

/** Compute the sha256 hex digest of inline source — useful in build steps. */
export function sha256Hex(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}
