// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { JwtError, signSession, verifySession } from "../src/jwtSession.js";

function b64url(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

const SECRET = "test-secret-32-bytes-long-enough-yes";

describe("signSession + verifySession", () => {
  it("round-trips a valid token", () => {
    const now = 1_700_000_000;
    const token = signSession(SECRET, {
      sub: "u_1",
      email: "advisor@example.com",
      role: "ADVISOR",
      ttlSeconds: 900,
      iss: "pwos-core-test",
      nowSec: () => now,
    });
    const claims = verifySession(SECRET, token, { nowSec: () => now + 60 });
    expect(claims.sub).toBe("u_1");
    expect(claims.email).toBe("advisor@example.com");
    expect(claims.role).toBe("ADVISOR");
    expect(claims.exp).toBe(now + 900);
  });

  it("rejects an expired token", () => {
    const issuedAt = 1_700_000_000;
    const token = signSession(SECRET, {
      sub: "u_1",
      email: "a@e.com",
      role: "ADVISOR",
      ttlSeconds: 60,
      nowSec: () => issuedAt,
    });
    expect(() =>
      verifySession(SECRET, token, { nowSec: () => issuedAt + 120 })
    ).toThrow(JwtError);
  });

  it("rejects a token with the wrong secret", () => {
    const token = signSession(SECRET, {
      sub: "u_1",
      email: "a@e.com",
      role: "ADVISOR",
      ttlSeconds: 60,
    });
    expect(() => verifySession("a-different-secret", token)).toThrow(
      /bad_signature/
    );
  });

  it("rejects a token with alg=none in the header", () => {
    const header = b64url(JSON.stringify({ alg: "none", typ: "JWT" }));
    const payload = b64url(
      JSON.stringify({
        sub: "u_1",
        email: "a@e.com",
        role: "OWNER",
        iat: 0,
        exp: 9_999_999_999,
      })
    );
    expect(() => verifySession(SECRET, `${header}.${payload}.`)).toThrow(/bad_alg/);
  });

  it("enforces issuer and audience when expected", () => {
    const token = signSession(SECRET, {
      sub: "u_1",
      email: "a@e.com",
      role: "ADVISOR",
      ttlSeconds: 900,
      iss: "issuer-A",
      aud: "audience-X",
    });
    expect(() =>
      verifySession(SECRET, token, { expectedIssuer: "issuer-B" })
    ).toThrow(/issuer_mismatch/);
    expect(() =>
      verifySession(SECRET, token, { expectedAudience: "audience-Y" })
    ).toThrow(/audience_mismatch/);
    expect(() =>
      verifySession(SECRET, token, {
        expectedIssuer: "issuer-A",
        expectedAudience: "audience-X",
      })
    ).not.toThrow();
  });

  it("rejects malformed tokens", () => {
    expect(() => verifySession(SECRET, "not-a-jwt")).toThrow(/malformed/);
    expect(() => verifySession(SECRET, "a.b")).toThrow(/malformed/);
  });

  it("rejects a token missing required claims", () => {
    const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = b64url(
      JSON.stringify({ sub: "u_1", iat: 0, exp: 9_999_999_999 })
    );
    const sig = b64url(
      createHmac("sha256", SECRET).update(`${header}.${payload}`).digest()
    );
    expect(() => verifySession(SECRET, `${header}.${payload}.${sig}`)).toThrow(
      /missing_claim/
    );
  });

  it("does not allow extras to spoof standard claims", () => {
    const now = 1_700_000_000;
    const token = signSession(SECRET, {
      sub: "u_real",
      email: "a@e.com",
      role: "ADVISOR",
      ttlSeconds: 60,
      nowSec: () => now,
      // Adversarial: try to override sub via extras.
      extras: { sub: "u_attacker", custom: "ok" },
    });
    const claims = verifySession(SECRET, token, { nowSec: () => now });
    expect(claims.sub).toBe("u_real");
    expect((claims as Record<string, unknown>).custom).toBe("ok");
  });
});
