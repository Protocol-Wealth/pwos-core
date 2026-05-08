// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { describe, expect, it } from "vitest";
import {
  InMemoryRevocationList,
  hasScope,
  signAgentToken,
  verifyAgentToken,
} from "../src/agentTokens.js";
import { JwtError } from "../src/jwtSession.js";

const SECRET = "agent-secret-32-bytes-long-enough-x";

describe("signAgentToken + verifyAgentToken", () => {
  it("round-trips a valid token", async () => {
    const now = 1_700_000_000;
    const tok = signAgentToken(SECRET, {
      sub: "agent:claude:u_42",
      agentId: "claude",
      scope: { level: "read_only" },
      tokenId: "tok_1",
      ttlSeconds: 3600,
      nowSec: () => now,
    });
    const claims = await verifyAgentToken(SECRET, tok, { nowSec: () => now + 60 });
    expect(claims.agentId).toBe("claude");
    expect(claims.scope.level).toBe("read_only");
    expect(claims.tokenId).toBe("tok_1");
  });

  it("rejects expired tokens", async () => {
    const issuedAt = 1_700_000_000;
    const tok = signAgentToken(SECRET, {
      sub: "a",
      agentId: "x",
      scope: { level: "read_only" },
      tokenId: "tok_1",
      ttlSeconds: 60,
      nowSec: () => issuedAt,
    });
    await expect(
      verifyAgentToken(SECRET, tok, { nowSec: () => issuedAt + 120 })
    ).rejects.toThrow(JwtError);
  });

  it("rejects when secret differs", async () => {
    const tok = signAgentToken(SECRET, {
      sub: "a",
      agentId: "x",
      scope: { level: "read_only" },
      tokenId: "tok_1",
    });
    await expect(verifyAgentToken("wrong", tok)).rejects.toThrow(/bad_signature/);
  });

  it("rejects revoked tokens", async () => {
    const list = new InMemoryRevocationList();
    const tok = signAgentToken(SECRET, {
      sub: "a",
      agentId: "x",
      scope: { level: "read_only" },
      tokenId: "tok_revoked",
      ttlSeconds: 3600,
    });
    await list.revoke("tok_revoked");
    await expect(
      verifyAgentToken(SECRET, tok, { revocationList: list })
    ).rejects.toThrow(/revoked/);
  });

  it("does not block tokens that aren't on the revocation list", async () => {
    const list = new InMemoryRevocationList();
    const tok = signAgentToken(SECRET, {
      sub: "a",
      agentId: "x",
      scope: { level: "read_write" },
      tokenId: "tok_ok",
    });
    await expect(
      verifyAgentToken(SECRET, tok, { revocationList: list })
    ).resolves.toBeDefined();
  });

  it("does not allow extras to spoof standard claims", async () => {
    const now = 1_700_000_000;
    const tok = signAgentToken(SECRET, {
      sub: "real_agent",
      agentId: "claude",
      scope: { level: "read_only" },
      tokenId: "tok_1",
      ttlSeconds: 60,
      nowSec: () => now,
      extras: { sub: "attacker", scope: { level: "admin" } },
    });
    const claims = await verifyAgentToken(SECRET, tok, { nowSec: () => now });
    expect(claims.sub).toBe("real_agent");
    expect(claims.scope.level).toBe("read_only");
  });
});

describe("hasScope", () => {
  const claims = {
    sub: "x",
    agentId: "claude",
    scope: { level: "read_write" as const, resources: ["household:hh_1"] },
    tokenId: "t",
    iat: 0,
    exp: 9_999_999_999,
  };

  it("admin > read_write > read_only", () => {
    expect(hasScope({ ...claims, scope: { level: "admin" } }, "read_only")).toBe(true);
    expect(hasScope({ ...claims, scope: { level: "read_only" } }, "read_write")).toBe(false);
    expect(hasScope({ ...claims, scope: { level: "read_write" } }, "read_write")).toBe(true);
  });

  it("checks resource list when supplied", () => {
    expect(hasScope(claims, "read_write", "household:hh_1")).toBe(true);
    expect(hasScope(claims, "read_write", "household:hh_999")).toBe(false);
  });

  it("empty resources array means unconstrained", () => {
    expect(
      hasScope(
        { ...claims, scope: { level: "read_write", resources: [] } },
        "read_write",
        "anything"
      )
    ).toBe(true);
  });
});
