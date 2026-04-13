// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
import { describe, expect, it } from "vitest";

import {
  BooksAndRecordsBundle,
  DEFAULT_POLICIES,
  RetentionCalculator,
  classifySeverity,
  classifyStatus,
  evaluateCalendar,
  nextOccurrence,
  notifiableIncidents,
  policiesNeedingReview,
  policyStatus,
  summarize,
  upcomingOrOverdue,
  vendorStatus,
  vendorsNeedingReview,
  verifyBundle,
  type ComplianceEvent,
  type PIIIncident,
  type PolicyReview,
  type VendorAssessment,
} from "../src/index.js";

// ──────────────────────────────────────────────────────────────────────
// Retention
// ──────────────────────────────────────────────────────────────────────

describe("RetentionCalculator", () => {
  const calc = new RetentionCalculator();

  it("computes 5-year deadline for advisory records", () => {
    const eventAt = new Date("2024-01-15");
    const deadline = calc.retentionDeadline("advisory_record", eventAt);
    expect(deadline?.toISOString().slice(0, 10)).toBe("2029-01-15");
  });

  it("isPurgeable reflects retention deadline", () => {
    const eventAt = "2020-01-01";
    expect(calc.isPurgeable("advisory_record", eventAt, new Date("2024-06-01"))).toBe(false);
    expect(calc.isPurgeable("advisory_record", eventAt, new Date("2026-01-01"))).toBe(true);
  });

  it("daysUntilPurgeable returns negative for overdue", () => {
    const days = calc.daysUntilPurgeable(
      "advisory_record",
      "2015-01-01",
      new Date("2024-01-01"),
    );
    expect(days).toBeLessThan(0);
  });

  it("policyFor returns undefined for unregistered category", () => {
    expect(calc.policyFor("other")).toBeUndefined();
  });

  it("caller can override defaults", () => {
    const custom = new RetentionCalculator([
      { id: "my", category: "advisory_record", retentionYears: 10, triggerEvent: "creation" },
    ]);
    const deadline = custom.retentionDeadline("advisory_record", new Date("2024-01-15"));
    expect(deadline?.toISOString().slice(0, 10)).toBe("2034-01-15");
  });

  it("DEFAULT_POLICIES covers the core SEC categories", () => {
    const categories = new Set(DEFAULT_POLICIES.map((p) => p.category));
    expect(categories.has("advisory_record")).toBe(true);
    expect(categories.has("audit_log")).toBe(true);
    expect(categories.has("client_communication")).toBe(true);
    expect(categories.has("marketing")).toBe(true);
    expect(categories.has("pii")).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────
// Calendar
// ──────────────────────────────────────────────────────────────────────

describe("calendar", () => {
  it("annual recurrence returns next occurrence same year when future", () => {
    const result = nextOccurrence(
      { type: "annual", month: 12, day: 31 },
      new Date("2026-06-01"),
    );
    expect(result?.toISOString().slice(0, 10)).toBe("2026-12-31");
  });

  it("annual recurrence rolls to next year when date has passed", () => {
    const result = nextOccurrence(
      { type: "annual", month: 3, day: 31 },
      new Date("2026-06-01"),
    );
    expect(result?.toISOString().slice(0, 10)).toBe("2027-03-31");
  });

  it("quarterly recurrence offsets from quarter-end", () => {
    // 45-day offset from quarter-end is the standard 13F deadline
    const result = nextOccurrence(
      { type: "quarterly", offsetDays: 45 },
      new Date("2026-01-15"),
    );
    // Q1 ends Mar 31 → due May 15
    expect(result?.toISOString().slice(0, 10)).toBe("2026-05-15");
  });

  it("classifyStatus maps day counts to states", () => {
    expect(classifyStatus(-1)).toBe("overdue");
    expect(classifyStatus(0)).toBe("due_today");
    expect(classifyStatus(15)).toBe("upcoming");
    expect(classifyStatus(90)).toBe("current");
    expect(classifyStatus(null)).toBe("current");
  });

  it("evaluateCalendar populates nextDueAt and status", () => {
    const events: ComplianceEvent[] = [
      {
        id: "adv",
        title: "ADV annual amendment",
        description: "File Form ADV annual amendment",
        priority: "high",
        recurrence: { type: "annual", month: 3, day: 31 },
      },
    ];
    const asOf = new Date("2026-03-20");
    const evaluated = evaluateCalendar(events, asOf);
    expect(evaluated[0].nextDueAt?.toISOString().slice(0, 10)).toBe("2026-03-31");
    expect(evaluated[0].daysUntilDue).toBe(11);
    expect(evaluated[0].status).toBe("upcoming");
  });

  it("upcomingOrOverdue filters to actionable items", () => {
    const events: ComplianceEvent[] = [
      {
        id: "near",
        title: "Near",
        description: "",
        priority: "high",
        recurrence: { type: "annual", month: 3, day: 31 },
      },
      {
        id: "far",
        title: "Far",
        description: "",
        priority: "low",
        recurrence: { type: "annual", month: 12, day: 31 },
      },
    ];
    const asOf = new Date("2026-03-20");
    const actionable = upcomingOrOverdue(events, 30, asOf);
    expect(actionable.map((e) => e.id)).toEqual(["near"]);
  });
});

// ──────────────────────────────────────────────────────────────────────
// Books & Records
// ──────────────────────────────────────────────────────────────────────

describe("BooksAndRecordsBundle", () => {
  it("builds manifest with counts + hashes", async () => {
    const bundle = new BooksAndRecordsBundle({
      periodStart: "2024-01-01",
      periodEnd: "2024-12-31",
      requestedBy: "SEC examiner",
      firm: { name: "Demo Capital", crd: "000000" },
      now: () => new Date("2026-01-01T00:00:00Z"),
    });
    bundle.addSection("audit_log", [{ id: "a1" }, { id: "a2" }]);
    bundle.addSection("communications", [{ id: "c1" }]);

    const out = await bundle.build();
    expect(out.manifest.counts).toEqual({ audit_log: 2, communications: 1 });
    expect(out.manifest.generatedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(out.manifest.sectionHashes?.audit_log).toMatch(/^[0-9a-f]{64}$/);
    expect(out.manifest.sectionHashes?.communications).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects duplicate section names", () => {
    const bundle = new BooksAndRecordsBundle({
      periodStart: "2024-01-01",
      periodEnd: "2024-12-31",
    });
    bundle.addSection("audit_log", []);
    expect(() => bundle.addSection("audit_log", [])).toThrow(/already added/);
  });

  it("verifyBundle returns null for intact bundle", async () => {
    const bundle = new BooksAndRecordsBundle({
      periodStart: "2024-01-01",
      periodEnd: "2024-12-31",
    });
    bundle.addSection("audit_log", [{ id: "a1" }]);
    const out = await bundle.build();
    expect(await verifyBundle(out)).toBeNull();
  });

  it("verifyBundle flags tampered payload", async () => {
    const bundle = new BooksAndRecordsBundle({
      periodStart: "2024-01-01",
      periodEnd: "2024-12-31",
    });
    bundle.addSection("audit_log", [{ id: "a1", action: "create" }]);
    const out = await bundle.build();
    // Tamper with the payload
    (out.sections.audit_log[0] as Record<string, unknown>).action = "delete";
    expect(await verifyBundle(out)).toBe("audit_log");
  });

  it("canonicalizes so key order does not change the hash", async () => {
    const bundleA = new BooksAndRecordsBundle({ periodStart: "x", periodEnd: "y" });
    bundleA.addSection("s", [{ a: 1, b: 2, c: 3 }]);
    const bundleB = new BooksAndRecordsBundle({ periodStart: "x", periodEnd: "y" });
    bundleB.addSection("s", [{ c: 3, b: 2, a: 1 }]);
    const outA = await bundleA.build();
    const outB = await bundleB.build();
    expect(outA.manifest.sectionHashes?.s).toBe(outB.manifest.sectionHashes?.s);
  });
});

// ──────────────────────────────────────────────────────────────────────
// Incidents
// ──────────────────────────────────────────────────────────────────────

describe("incidents", () => {
  const baseIncident: PIIIncident = {
    id: "inc_1",
    detectedAt: "2026-01-15T12:00:00Z",
    description: "Email field reached LLM endpoint",
    severity: "low",
    disposition: "blocked",
    affectedRecords: 1,
  };

  it("classifies severity based on disposition + records", () => {
    expect(classifySeverity({ disposition: "blocked", affectedRecords: 1 })).toBe("low");
    expect(classifySeverity({ disposition: "blocked", affectedRecords: 50 })).toBe("medium");
    expect(classifySeverity({ disposition: "redacted", affectedRecords: 15 })).toBe("medium");
    expect(classifySeverity({ disposition: "warned", affectedRecords: 5 })).toBe("medium");
    expect(classifySeverity({ disposition: "warned", affectedRecords: 500 })).toBe("high");
    expect(classifySeverity({ disposition: "exposed", affectedRecords: 5 })).toBe("high");
    expect(
      classifySeverity({ disposition: "exposed", affectedRecords: 5, reportedToClient: true }),
    ).toBe("critical");
    expect(classifySeverity({ disposition: "exposed", affectedRecords: 500 })).toBe("critical");
  });

  it("summarize aggregates across severities and dispositions", () => {
    const incidents: PIIIncident[] = [
      baseIncident,
      { ...baseIncident, id: "inc_2", severity: "high", disposition: "exposed", affectedRecords: 3 },
      { ...baseIncident, id: "inc_3", severity: "medium", disposition: "warned", affectedRecords: 10 },
    ];
    const summary = summarize(incidents);
    expect(summary.totalIncidents).toBe(3);
    expect(summary.bySeverity.low).toBe(1);
    expect(summary.bySeverity.medium).toBe(1);
    expect(summary.bySeverity.high).toBe(1);
    expect(summary.byDisposition.blocked).toBe(1);
    expect(summary.byDisposition.exposed).toBe(1);
    expect(summary.byDisposition.warned).toBe(1);
    expect(summary.exposureCount).toBe(1);
    expect(summary.recordsAffected).toBe(14);
  });

  it("notifiableIncidents picks critical exposures", () => {
    const incidents: PIIIncident[] = [
      { ...baseIncident, id: "inc_c", severity: "critical", disposition: "exposed" },
      { ...baseIncident, id: "inc_h", severity: "high", disposition: "exposed" },
      { ...baseIncident, id: "inc_b", severity: "low", disposition: "blocked" },
    ];
    const notifiable = notifiableIncidents(incidents);
    expect(notifiable.map((i) => i.id)).toEqual(["inc_c"]);
  });
});

// ──────────────────────────────────────────────────────────────────────
// Policy / Vendor review
// ──────────────────────────────────────────────────────────────────────

describe("policy + vendor review", () => {
  const asOf = new Date("2026-04-13T00:00:00Z");

  it("policyStatus 'current' for recent review", () => {
    const p: Pick<PolicyReview, "lastReviewedAt" | "reviewCadenceMonths"> = {
      lastReviewedAt: "2026-01-01T00:00:00Z",
      reviewCadenceMonths: 12,
    };
    expect(policyStatus(p, asOf)).toBe("current");
  });

  it("policyStatus 'overdue' when cadence passed", () => {
    const p = {
      lastReviewedAt: "2024-01-01T00:00:00Z",
      reviewCadenceMonths: 12,
    };
    expect(policyStatus(p, asOf)).toBe("overdue");
  });

  it("policyStatus 'overdue' when never reviewed", () => {
    const p = { reviewCadenceMonths: 12 };
    expect(policyStatus(p, asOf)).toBe("overdue");
  });

  it("policiesNeedingReview filters to actionable", () => {
    const policies: PolicyReview[] = [
      {
        id: "a",
        policyName: "current",
        reviewCadenceMonths: 12,
        lastReviewedAt: "2026-01-01T00:00:00Z",
        status: "current",
      },
      {
        id: "b",
        policyName: "overdue",
        reviewCadenceMonths: 12,
        lastReviewedAt: "2024-01-01T00:00:00Z",
        status: "current",
      },
    ];
    const needy = policiesNeedingReview(policies, asOf);
    expect(needy.map((p) => p.id)).toEqual(["b"]);
  });

  it("vendor review mirrors policy review semantics", () => {
    const vendor: Pick<VendorAssessment, "lastReviewedAt" | "reviewCadenceMonths"> = {
      lastReviewedAt: "2024-01-01T00:00:00Z",
      reviewCadenceMonths: 12,
    };
    expect(vendorStatus(vendor, asOf)).toBe("overdue");
  });

  it("vendorsNeedingReview filters overdue + review_due", () => {
    const vendors: VendorAssessment[] = [
      {
        id: "v1",
        vendorName: "current",
        servicesProvided: "x",
        dataCategories: [],
        criticality: "medium",
        reviewCadenceMonths: 12,
        lastReviewedAt: "2026-01-01T00:00:00Z",
        status: "current",
      },
      {
        id: "v2",
        vendorName: "overdue",
        servicesProvided: "x",
        dataCategories: [],
        criticality: "high",
        reviewCadenceMonths: 12,
        lastReviewedAt: "2024-01-01T00:00:00Z",
        status: "current",
      },
    ];
    const needy = vendorsNeedingReview(vendors, asOf);
    expect(needy.map((v) => v.id)).toEqual(["v2"]);
  });
});
