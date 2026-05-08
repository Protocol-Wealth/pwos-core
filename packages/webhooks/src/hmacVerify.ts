// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Generic HMAC-SHA256 timing-safe verification for inbound webhooks.
 *
 * Vendor signatures vary in encoding (`hex`, `base64`, `base64url`) and
 * sometimes carry an `algorithm=signature` prefix (e.g. Stripe-style
 * `t=...,v1=...`). This helper takes the *canonical signing string*
 * (the bytes the vendor signs) plus the secret and the candidate
 * signature, and returns a structured pass/fail.
 *
 * For replay-attack resistance, callers must additionally:
 *   1. Bind a freshness window (timestamp in the signed payload)
 *   2. Store-and-skip on idempotency key (see `idempotency.ts`)
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type { VerificationResult } from "./types.js";

export type SignatureEncoding = "hex" | "base64" | "base64url";

export interface HmacVerifyOptions {
  /** Secret used for HMAC. */
  secret: string | Buffer;
  /** Bytes the vendor signed. Typically `${timestamp}.${rawBody}`. */
  signingString: string | Buffer;
  /** The signature delivered by the vendor (without any prefix). */
  signature: string;
  /** Encoding of the delivered signature. Default `hex`. */
  encoding?: SignatureEncoding;
}

/** Compute the canonical HMAC-SHA256 of `signingString` under `secret`. */
export function computeHmacSha256(
  secret: string | Buffer,
  signingString: string | Buffer
): Buffer {
  const h = createHmac("sha256", secret);
  h.update(signingString);
  return h.digest();
}

function decodeSignature(
  sig: string,
  encoding: SignatureEncoding
): Buffer | null {
  try {
    if (encoding === "hex") {
      if (!/^[0-9a-f]+$/i.test(sig) || sig.length % 2 !== 0) return null;
      return Buffer.from(sig, "hex");
    }
    if (encoding === "base64url") {
      const pad =
        sig.length % 4 === 0 ? "" : "=".repeat(4 - (sig.length % 4));
      const b64 = (sig + pad).replace(/-/g, "+").replace(/_/g, "/");
      return Buffer.from(b64, "base64");
    }
    return Buffer.from(sig, "base64");
  } catch {
    return null;
  }
}

export function verifyHmacSha256(options: HmacVerifyOptions): VerificationResult {
  const encoding: SignatureEncoding = options.encoding ?? "hex";
  const expected = computeHmacSha256(options.secret, options.signingString);
  const provided = decodeSignature(options.signature, encoding);
  if (!provided) {
    return { ok: false, code: "malformed_signature", detail: `signature is not valid ${encoding}` };
  }
  if (provided.length !== expected.length) {
    return {
      ok: false,
      code: "signature_length_mismatch",
      detail: `expected ${expected.length} bytes, got ${provided.length}`,
    };
  }
  if (!timingSafeEqual(provided, expected)) {
    return { ok: false, code: "signature_mismatch", detail: "HMAC does not match" };
  }
  return { ok: true };
}

/**
 * Common pattern: `${timestampSec}.${rawBody}` is the signed string,
 * where `timestampSec` is also delivered as a header. Reject signatures
 * older than `toleranceSec` to bound replay windows.
 */
export interface TimestampedHmacOptions extends Omit<HmacVerifyOptions, "signingString"> {
  rawBody: string | Buffer;
  /** The timestamp delivered alongside the signature (epoch seconds). */
  timestampSec: number;
  /** The current time to compare against (epoch seconds). */
  nowSec: number;
  /** Max age tolerated, in seconds. Default 300 (5 min). */
  toleranceSec?: number;
}

export function verifyTimestampedHmacSha256(
  options: TimestampedHmacOptions
): VerificationResult {
  const tolerance = options.toleranceSec ?? 300;
  const age = Math.abs(options.nowSec - options.timestampSec);
  if (age > tolerance) {
    return {
      ok: false,
      code: "stale_timestamp",
      detail: `signature is ${age}s old; tolerance ${tolerance}s`,
    };
  }
  const body =
    typeof options.rawBody === "string"
      ? options.rawBody
      : options.rawBody.toString("utf8");
  return verifyHmacSha256({
    secret: options.secret,
    signingString: `${options.timestampSec}.${body}`,
    signature: options.signature,
    encoding: options.encoding,
  });
}
