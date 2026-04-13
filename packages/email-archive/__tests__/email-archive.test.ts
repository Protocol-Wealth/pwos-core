// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
import { describe, expect, it } from "vitest";

import {
  evaluateQuery,
  finalizeRecord,
  hashEmail,
  isPurgeable,
  purgeableEmails,
  verifyChain,
  type ArchivedEmail,
} from "../src/index.js";

function baseEmail(overrides: Partial<ArchivedEmail> = {}): ArchivedEmail {
  return {
    id: "email_1",
    occurredAt: "2024-06-01T12:00:00Z",
    archivedAt: "2024-06-01T12:05:00Z",
    from: { address: "alice@example.com" },
    to: [{ address: "bob@example.com" }],
    subject: "Quarterly review",
    classification: "client_communication",
    direction: "outbound",
    ...overrides,
  };
}

describe("integrity (hash chain)", () => {
  it("hashEmail is deterministic for the same input", async () => {
    const email = baseEmail();
    const h1 = await hashEmail(email, "");
    const h2 = await hashEmail(email, "");
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("different previousHash produces different content hash", async () => {
    const email = baseEmail();
    const h1 = await hashEmail(email, "");
    const h2 = await hashEmail(email, "abcdef");
    expect(h1).not.toBe(h2);
  });

  it("finalizeRecord attaches contentHash + previousHash", async () => {
    const first = await finalizeRecord(baseEmail(), "");
    expect(first.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(first.previousHash).toBe("");
  });

  it("verifyChain returns null for intact chain", async () => {
    const a = await finalizeRecord(baseEmail({ id: "a" }), "");
    const b = await finalizeRecord(baseEmail({ id: "b" }), a.contentHash!);
    const c = await finalizeRecord(baseEmail({ id: "c" }), b.contentHash!);
    expect(await verifyChain([a, b, c])).toBeNull();
  });

  it("verifyChain flags tampered record", async () => {
    const a = await finalizeRecord(baseEmail({ id: "a" }), "");
    const b = await finalizeRecord(baseEmail({ id: "b" }), a.contentHash!);
    // Mutate the subject post-hash
    const tampered = { ...b, subject: "HIJACKED" };
    const broken = await verifyChain([a, tampered]);
    expect(broken).toBe("b");
  });
});

describe("retention", () => {
  const now = new Date("2026-04-13T00:00:00Z");

  it("isPurgeable true when past retentionUntil", () => {
    const e = baseEmail({ retentionUntil: "2026-01-01T00:00:00Z" });
    expect(isPurgeable(e, now)).toBe(true);
  });

  it("isPurgeable false when legal hold", () => {
    const e = baseEmail({
      retentionUntil: "2026-01-01T00:00:00Z",
      legalHold: true,
    });
    expect(isPurgeable(e, now)).toBe(false);
  });

  it("isPurgeable false when no retentionUntil", () => {
    expect(isPurgeable(baseEmail(), now)).toBe(false);
  });

  it("purgeableEmails filters correctly", () => {
    const emails = [
      baseEmail({ id: "a", retentionUntil: "2026-01-01T00:00:00Z" }),
      baseEmail({ id: "b", retentionUntil: "2027-01-01T00:00:00Z" }),
      baseEmail({ id: "c", retentionUntil: "2026-01-01T00:00:00Z", legalHold: true }),
    ];
    expect(purgeableEmails(emails, now).map((e) => e.id)).toEqual(["a"]);
  });
});

describe("query evaluator", () => {
  const emails: ArchivedEmail[] = [
    baseEmail({ id: "a", from: { address: "alice@x.com" }, subject: "Review notes" }),
    baseEmail({ id: "b", from: { address: "bob@x.com" }, subject: "Quarterly review" }),
    baseEmail({
      id: "c",
      direction: "inbound",
      from: { address: "client@y.com" },
      subject: "Tax question",
    }),
  ];

  it("from filter", () => {
    const out = evaluateQuery(emails, { from: "alice@x.com" });
    expect(out.map((e) => e.id)).toEqual(["a"]);
  });

  it("subjectContains is case-insensitive", () => {
    const out = evaluateQuery(emails, { subjectContains: "REVIEW" });
    expect(out.map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("direction filter", () => {
    const out = evaluateQuery(emails, { direction: "inbound" });
    expect(out.map((e) => e.id)).toEqual(["c"]);
  });

  it("date range filter", () => {
    const withDates: ArchivedEmail[] = [
      baseEmail({ id: "a", occurredAt: "2024-01-15T00:00:00Z" }),
      baseEmail({ id: "b", occurredAt: "2024-06-15T00:00:00Z" }),
      baseEmail({ id: "c", occurredAt: "2024-12-15T00:00:00Z" }),
    ];
    const out = evaluateQuery(withDates, {
      occurredAfter: "2024-03-01T00:00:00Z",
      occurredBefore: "2024-09-01T00:00:00Z",
    });
    expect(out.map((e) => e.id)).toEqual(["b"]);
  });

  it("withinRetention excludes purgeable unless legal hold", () => {
    const now = new Date("2026-04-13T00:00:00Z");
    const withRetention: ArchivedEmail[] = [
      baseEmail({ id: "active", retentionUntil: "2027-01-01T00:00:00Z" }),
      baseEmail({ id: "purgeable", retentionUntil: "2026-01-01T00:00:00Z" }),
      baseEmail({
        id: "hold",
        retentionUntil: "2026-01-01T00:00:00Z",
        legalHold: true,
      }),
    ];
    const out = evaluateQuery(withRetention, { withinRetention: true, includeLegalHolds: true }, now);
    expect(out.map((e) => e.id).sort()).toEqual(["active", "hold"]);
  });
});
