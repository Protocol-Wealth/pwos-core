// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { describe, expect, it } from "vitest";
import {
  computeHmacSha256,
  verifyHmacSha256,
  verifyTimestampedHmacSha256,
} from "../src/hmacVerify.js";

const SECRET = "shared-secret";

describe("verifyHmacSha256", () => {
  it("accepts a matching hex signature", () => {
    const body = '{"event":"ping"}';
    const sig = computeHmacSha256(SECRET, body).toString("hex");
    const result = verifyHmacSha256({
      secret: SECRET,
      signingString: body,
      signature: sig,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a malformed hex signature", () => {
    const result = verifyHmacSha256({
      secret: SECRET,
      signingString: "x",
      signature: "ZZZZ",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("malformed_signature");
  });

  it("rejects a length-mismatched signature", () => {
    const result = verifyHmacSha256({
      secret: SECRET,
      signingString: "x",
      signature: "deadbeef",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("signature_length_mismatch");
  });

  it("rejects a wrong signature with the right length", () => {
    const wrong = computeHmacSha256("other", "x").toString("hex");
    const result = verifyHmacSha256({
      secret: SECRET,
      signingString: "x",
      signature: wrong,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("signature_mismatch");
  });

  it("supports base64 encoding", () => {
    const body = "hello";
    const sig = computeHmacSha256(SECRET, body).toString("base64");
    const result = verifyHmacSha256({
      secret: SECRET,
      signingString: body,
      signature: sig,
      encoding: "base64",
    });
    expect(result.ok).toBe(true);
  });
});

describe("verifyTimestampedHmacSha256", () => {
  const SECRET = "ts-secret";
  const body = '{"event":"x"}';
  const ts = 1_700_000_000;

  it("accepts a fresh, valid signature", () => {
    const sig = computeHmacSha256(SECRET, `${ts}.${body}`).toString("hex");
    const result = verifyTimestampedHmacSha256({
      secret: SECRET,
      rawBody: body,
      timestampSec: ts,
      nowSec: ts + 30,
      signature: sig,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a stale signature", () => {
    const sig = computeHmacSha256(SECRET, `${ts}.${body}`).toString("hex");
    const result = verifyTimestampedHmacSha256({
      secret: SECRET,
      rawBody: body,
      timestampSec: ts,
      nowSec: ts + 10_000,
      signature: sig,
      toleranceSec: 300,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("stale_timestamp");
  });
});
