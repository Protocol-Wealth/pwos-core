// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
import { describe, expect, it, vi } from "vitest";

import { EXAMPLE_DISCLOSURE_CARD } from "@protocolwealthos/disclosure-card";

import {
  wrapWithCompliance,
  type ComplianceAuditContext,
} from "../src/index.js";

// A representative nexus-core-style tool output: target weights + a regime +
// a disclaimer. The wrapper must carry this through unchanged.
const ALLOCATION_OUTPUT = {
  weights: { us_equity: 0.6, intl_equity: 0.2, bonds: 0.2 },
  expectedReturn: 0.071,
  expectedVol: 0.124,
  sharpe: 0.41,
  regime: "expansion",
  disclaimer: "Engine disclaimer — superseded by the firm envelope.",
} as const;

const FIRM_DISCLAIMER =
  "Informational only; not investment advice. Subject to advisor review under SEC Rule 206(4)-1.";

describe("wrapWithCompliance", () => {
  it("wraps the payload and attaches the validated card + disclaimer", async () => {
    const env = await wrapWithCompliance(ALLOCATION_OUTPUT, {
      disclosureCard: EXAMPLE_DISCLOSURE_CARD,
      disclaimer: FIRM_DISCLAIMER,
      generatedAt: "2026-06-15T00:00:00Z",
    });

    expect(env.data).toEqual(ALLOCATION_OUTPUT);
    expect(env.disclaimer).toBe(FIRM_DISCLAIMER);
    expect(env.disclosureCard.systemName).toBe(EXAMPLE_DISCLOSURE_CARD.systemName);
    expect(env.meta.generatedAt).toBe("2026-06-15T00:00:00Z");
  });

  it("preserves the wrapped data by reference, unchanged", async () => {
    const env = await wrapWithCompliance(ALLOCATION_OUTPUT, {
      disclosureCard: EXAMPLE_DISCLOSURE_CARD,
      disclaimer: FIRM_DISCLAIMER,
    });

    // Same reference, byte-for-byte identical — the wrapper never mutates the
    // engine output (its embedded disclaimer survives alongside the firm one).
    expect(env.data).toBe(ALLOCATION_OUTPUT);
    expect(env.data.disclaimer).toBe(ALLOCATION_OUTPUT.disclaimer);
  });

  it("omits auditId and provenanceHash when no hooks are supplied", async () => {
    const env = await wrapWithCompliance(ALLOCATION_OUTPUT, {
      disclosureCard: EXAMPLE_DISCLOSURE_CARD,
      disclaimer: FIRM_DISCLAIMER,
    });

    expect("auditId" in env.meta).toBe(false);
    expect("provenanceHash" in env.meta).toBe(false);
    expect(env.meta.auditId).toBeUndefined();
    expect(env.meta.provenanceHash).toBeUndefined();
    // generatedAt is always present.
    expect(typeof env.meta.generatedAt).toBe("string");
  });

  it("populates auditId and provenanceHash when both hooks are present", async () => {
    const recordAudit = vi.fn(async () => "audit_row_42");
    const hashProvenance = vi.fn(async () => "sha256:abc123");

    const env = await wrapWithCompliance(ALLOCATION_OUTPUT, {
      disclosureCard: EXAMPLE_DISCLOSURE_CARD,
      disclaimer: FIRM_DISCLAIMER,
      toolName: "optimize_allocation",
      generatedAt: "2026-06-15T00:00:00Z",
      recordAudit,
      hashProvenance,
    });

    expect(env.meta.auditId).toBe("audit_row_42");
    expect(env.meta.provenanceHash).toBe("sha256:abc123");

    // Provenance hook sees the unwrapped payload.
    expect(hashProvenance).toHaveBeenCalledWith(ALLOCATION_OUTPUT);

    // Audit hook receives a PII-free context naming what was wrapped.
    expect(recordAudit).toHaveBeenCalledTimes(1);
    const ctx = recordAudit.mock.calls[0]![0] as ComplianceAuditContext;
    expect(ctx.toolName).toBe("optimize_allocation");
    expect(ctx.disclaimer).toBe(FIRM_DISCLAIMER);
    expect(ctx.generatedAt).toBe("2026-06-15T00:00:00Z");
    expect(ctx.disclosureCard.systemName).toBe(EXAMPLE_DISCLOSURE_CARD.systemName);
  });

  it("populates only the field whose hook is supplied", async () => {
    const auditOnly = await wrapWithCompliance(ALLOCATION_OUTPUT, {
      disclosureCard: EXAMPLE_DISCLOSURE_CARD,
      disclaimer: FIRM_DISCLAIMER,
      recordAudit: async () => "audit_only",
    });
    expect(auditOnly.meta.auditId).toBe("audit_only");
    expect("provenanceHash" in auditOnly.meta).toBe(false);

    const provOnly = await wrapWithCompliance(ALLOCATION_OUTPUT, {
      disclosureCard: EXAMPLE_DISCLOSURE_CARD,
      disclaimer: FIRM_DISCLAIMER,
      hashProvenance: async () => "sha256:only",
    });
    expect(provOnly.meta.provenanceHash).toBe("sha256:only");
    expect("auditId" in provOnly.meta).toBe(false);
  });

  it("defaults toolName to 'unknown' when not supplied", async () => {
    const recordAudit = vi.fn(async () => "id");
    await wrapWithCompliance(ALLOCATION_OUTPUT, {
      disclosureCard: EXAMPLE_DISCLOSURE_CARD,
      disclaimer: FIRM_DISCLAIMER,
      recordAudit,
    });
    const ctx = recordAudit.mock.calls[0]![0] as ComplianceAuditContext;
    expect(ctx.toolName).toBe("unknown");
  });

  it("rejects a malformed disclosure card before running any hook", async () => {
    const recordAudit = vi.fn(async () => "should_not_run");
    const hashProvenance = vi.fn(async () => "should_not_run");

    // Missing required blocks (operator, model, ...) — disclosure-card's Zod
    // parser must reject this at the boundary.
    const malformed = { systemName: "Broken", version: "0.0.0" };

    await expect(
      wrapWithCompliance(ALLOCATION_OUTPUT, {
        disclosureCard: malformed,
        disclaimer: FIRM_DISCLAIMER,
        recordAudit,
        hashProvenance,
      }),
    ).rejects.toThrow();

    expect(recordAudit).not.toHaveBeenCalled();
    expect(hashProvenance).not.toHaveBeenCalled();
  });

  it("rejects an empty or non-string disclaimer", async () => {
    await expect(
      wrapWithCompliance(ALLOCATION_OUTPUT, {
        disclosureCard: EXAMPLE_DISCLOSURE_CARD,
        disclaimer: "   ",
      }),
    ).rejects.toThrow(/non-empty string/);

    await expect(
      wrapWithCompliance(ALLOCATION_OUTPUT, {
        disclosureCard: EXAMPLE_DISCLOSURE_CARD,
        // @ts-expect-error — exercising the runtime guard against a non-string.
        disclaimer: 123,
      }),
    ).rejects.toThrow(/non-empty string/);
  });

  it("wraps a nested-report payload shape too (build_planning_report)", async () => {
    const reportOutput = {
      report: { title: "2026 Roth ladder", sections: ["intro", "schedule"] },
      disclaimer: "engine copy",
    };

    const env = await wrapWithCompliance(reportOutput, {
      disclosureCard: EXAMPLE_DISCLOSURE_CARD,
      disclaimer: FIRM_DISCLAIMER,
      toolName: "build_planning_report",
    });

    expect(env.data).toBe(reportOutput);
    expect(env.data.report.title).toBe("2026 Roth ladder");
    expect(env.disclaimer).toBe(FIRM_DISCLAIMER);
  });
});
