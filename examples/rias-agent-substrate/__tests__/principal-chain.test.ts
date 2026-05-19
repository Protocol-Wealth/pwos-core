// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * Tests for principal-chain validation + audit-detail formatting.
 *
 * The principal chain (advisor → session → client) is the authorization
 * trace recorded on every agent memory read. Validation failure means the
 * agent composer fails closed — no context returned, no client memory
 * accessed.
 */

import { describe, expect, it } from "vitest";

import {
  chainAuditDetails,
  validatePrincipalChain,
  type PrincipalChain,
} from "../src/index.js";

describe("validatePrincipalChain", () => {
  it("returns the authorized client set when chain is well-formed and authorized", async () => {
    const authorized = new Set(["client_a"]);
    const result = await validatePrincipalChain(
      { advisorId: "adv_1", sessionId: "sess_1", clientId: "client_a" },
      async () => authorized,
    );
    expect(result).toEqual(authorized);
  });

  it("throws when advisorId is missing", async () => {
    await expect(
      validatePrincipalChain(
        { advisorId: "", sessionId: "sess_1", clientId: "client_a" },
        async () => new Set(["client_a"]),
      ),
    ).rejects.toThrow(/incomplete/);
  });

  it("throws when sessionId is missing", async () => {
    await expect(
      validatePrincipalChain(
        { advisorId: "adv_1", sessionId: "", clientId: "client_a" },
        async () => new Set(["client_a"]),
      ),
    ).rejects.toThrow(/incomplete/);
  });

  it("throws when clientId is missing", async () => {
    await expect(
      validatePrincipalChain(
        { advisorId: "adv_1", sessionId: "sess_1", clientId: "" },
        async () => new Set(["client_a"]),
      ),
    ).rejects.toThrow(/incomplete/);
  });

  it("throws when advisor is not authorized for the named client", async () => {
    await expect(
      validatePrincipalChain(
        { advisorId: "adv_1", sessionId: "sess_1", clientId: "client_b" },
        async () => new Set(["client_a"]),
      ),
    ).rejects.toThrow(/not authorized for client client_b/);
  });
});

describe("chainAuditDetails", () => {
  it("formats the chain into a stable shape for audit_log.details", () => {
    const chain: PrincipalChain = {
      advisorId: "adv_1",
      sessionId: "sess_1",
      clientId: "client_a",
      auditEntryId: "audit_abc",
    };
    expect(chainAuditDetails(chain)).toEqual({
      advisor_id: "adv_1",
      session_id: "sess_1",
      client_id: "client_a",
      audit_entry_id: "audit_abc",
    });
  });

  it("omits audit_entry_id from the formatted output when not yet anchored", () => {
    const chain: PrincipalChain = {
      advisorId: "adv_1",
      sessionId: "sess_1",
      clientId: "client_a",
    };
    const details = chainAuditDetails(chain);
    expect(details.audit_entry_id).toBeUndefined();
  });
});
