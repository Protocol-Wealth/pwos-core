// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { describe, expect, it } from "vitest";
import { verifyDualLayer } from "../src/dualLayerVerify.js";

const baseOk = {
  pathToken: "tok_xxx",
  expectedPathToken: "tok_xxx",
  authorizationHeader: "Basic " + Buffer.from("user:pass").toString("base64"),
  expectedBasicUser: "user",
  expectedBasicPassword: "pass",
};

describe("verifyDualLayer", () => {
  it("accepts a correct pair", () => {
    expect(verifyDualLayer(baseOk).ok).toBe(true);
  });

  it("rejects path-token mismatch", () => {
    const r = verifyDualLayer({ ...baseOk, pathToken: "tok_other" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("path_token_mismatch");
  });

  it("rejects missing or non-Basic Authorization header", () => {
    const r1 = verifyDualLayer({ ...baseOk, authorizationHeader: undefined });
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.code).toBe("missing_basic_auth");
    const r2 = verifyDualLayer({ ...baseOk, authorizationHeader: "Bearer xx" });
    expect(r2.ok).toBe(false);
  });

  it("rejects user mismatch", () => {
    const r = verifyDualLayer({
      ...baseOk,
      authorizationHeader: "Basic " + Buffer.from("attacker:pass").toString("base64"),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("basic_user_mismatch");
  });

  it("rejects password mismatch", () => {
    const r = verifyDualLayer({
      ...baseOk,
      authorizationHeader: "Basic " + Buffer.from("user:wrong").toString("base64"),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("basic_password_mismatch");
  });

  it("rejects malformed base64 in the header", () => {
    const r = verifyDualLayer({
      ...baseOk,
      authorizationHeader: "Basic noColonHere",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("malformed_basic_auth");
  });
});
