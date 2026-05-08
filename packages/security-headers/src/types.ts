// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/** Build mode — production tightens, development loosens for HMR. */
export type BuildMode = "production" | "development";

/**
 * CSP source-list value. We use a string union for the well-known
 * keywords plus arbitrary strings (host source / scheme source / nonce-
 * `'nonce-…'` / hash-`'sha256-…'`).
 */
export type CspSource =
  | "'self'"
  | "'none'"
  | "'strict-dynamic'"
  | "'unsafe-inline'"
  | "'unsafe-eval'"
  | (string & {});

export interface CspDirectives {
  defaultSrc?: readonly CspSource[];
  scriptSrc?: readonly CspSource[];
  styleSrc?: readonly CspSource[];
  imgSrc?: readonly CspSource[];
  fontSrc?: readonly CspSource[];
  connectSrc?: readonly CspSource[];
  frameSrc?: readonly CspSource[];
  frameAncestors?: readonly CspSource[];
  formAction?: readonly CspSource[];
  baseUri?: readonly CspSource[];
  objectSrc?: readonly CspSource[];
  mediaSrc?: readonly CspSource[];
  workerSrc?: readonly CspSource[];
  manifestSrc?: readonly CspSource[];
  /** When true, emits `upgrade-insecure-requests`. */
  upgradeInsecureRequests?: boolean;
  /** Optional report-uri / report-to. */
  reportUri?: string;
  reportTo?: string;
}

/** A flat header map suitable for any HTTP framework. */
export type HeaderMap = Record<string, string>;
