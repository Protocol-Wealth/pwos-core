// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Disclosure-card tests.
 *
 * Three concerns covered:
 *   - The Zod schema accepts the example and rejects shape violations.
 *   - The hand-rolled JSON Schema stays in sync with the Zod schema's
 *     top-level required fields (the most common drift point).
 *   - The `[VERIFY]` CI gate (`assertNoVerifyMarkers`) actually catches
 *     an unverified citation.
 */

import { describe, expect, it } from "vitest";

import {
  assertNoVerifyMarkers,
  DISCLOSURE_CARD_JSON_SCHEMA,
  disclosureCardSchema,
  EXAMPLE_DISCLOSURE_CARD,
  getDisclosureCardJsonSchema,
  parseDisclosureCard,
  safeParseDisclosureCard,
  type DisclosureCard,
} from "../src/index.js";

describe("disclosureCardSchema — happy path", () => {
  it("validates the bundled example", () => {
    expect(() => parseDisclosureCard(EXAMPLE_DISCLOSURE_CARD)).not.toThrow();
  });

  it("safeParse returns success on the example", () => {
    const result = safeParseDisclosureCard(EXAMPLE_DISCLOSURE_CARD);
    expect(result.success).toBe(true);
  });

  it("returned object has the expected top-level keys", () => {
    const parsed = parseDisclosureCard(EXAMPLE_DISCLOSURE_CARD);
    expect(Object.keys(parsed).sort()).toEqual(
      [
        "auditTrail",
        "dataRetention",
        "generatedAt",
        "humanOversight",
        "inferenceJurisdiction",
        "knownLimitations",
        "model",
        "operator",
        "piiHandling",
        "regulatoryBasis",
        "systemName",
        "version",
      ].sort(),
    );
  });
});

describe("disclosureCardSchema — shape violations", () => {
  const baseValid = EXAMPLE_DISCLOSURE_CARD;

  it("rejects missing systemName", () => {
    const { systemName: _omit, ...rest } = baseValid;
    expect(safeParseDisclosureCard(rest).success).toBe(false);
  });

  it("rejects empty systemName", () => {
    expect(
      safeParseDisclosureCard({ ...baseValid, systemName: "" }).success,
    ).toBe(false);
  });

  it("rejects non-ISO generatedAt", () => {
    expect(
      safeParseDisclosureCard({ ...baseValid, generatedAt: "not-a-date" }).success,
    ).toBe(false);
  });

  it("rejects unknown humanOversight.tier", () => {
    expect(
      safeParseDisclosureCard({
        ...baseValid,
        humanOversight: {
          ...baseValid.humanOversight,
          tier: "skynet" as never,
        },
      }).success,
    ).toBe(false);
  });

  it("rejects unknown piiHandling.mode", () => {
    expect(
      safeParseDisclosureCard({
        ...baseValid,
        piiHandling: {
          ...baseValid.piiHandling,
          mode: "purge" as never,
        },
      }).success,
    ).toBe(false);
  });

  it("rejects auditTrail.rule other than the canonical SEC 204-2", () => {
    expect(
      safeParseDisclosureCard({
        ...baseValid,
        auditTrail: { rule: "SEC 17a-4" as never, tamperEvident: true },
      }).success,
    ).toBe(false);
  });

  it("rejects negative retention days", () => {
    expect(
      safeParseDisclosureCard({
        ...baseValid,
        dataRetention: {
          ...baseValid.dataRetention,
          inputRetentionDays: -1,
        },
      }).success,
    ).toBe(false);
  });
});

describe("assertNoVerifyMarkers — CI gate", () => {
  it("detects [VERIFY] in the bundled example (the example is intentionally not publish-ready)", () => {
    // The bundled example carries a "[VERIFY]" suffix on one citation to
    // demonstrate the pattern; an adopter publishing a real card must
    // remove all [VERIFY] suffixes (after independently verifying each
    // rule citation) before the CI gate will let it ship.
    expect(() => assertNoVerifyMarkers(EXAMPLE_DISCLOSURE_CARD)).toThrow(/VERIFY/);
  });

  it("passes on a card with all citations verified", () => {
    const verified: DisclosureCard = {
      ...EXAMPLE_DISCLOSURE_CARD,
      regulatoryBasis: EXAMPLE_DISCLOSURE_CARD.regulatoryBasis.map((c) =>
        c.replace(/\s*\[VERIFY\]/g, "").trim(),
      ),
    };
    expect(() => assertNoVerifyMarkers(verified)).not.toThrow();
  });
});

describe("JSON Schema sync with Zod schema", () => {
  it("JSON Schema is JSON-serializable", () => {
    const round = JSON.parse(JSON.stringify(DISCLOSURE_CARD_JSON_SCHEMA));
    expect(round).toEqual(DISCLOSURE_CARD_JSON_SCHEMA);
  });

  it("getDisclosureCardJsonSchema returns a plain object equal to the const", () => {
    const dynamic = getDisclosureCardJsonSchema();
    expect(dynamic).toEqual(JSON.parse(JSON.stringify(DISCLOSURE_CARD_JSON_SCHEMA)));
  });

  it("top-level required fields match the Zod schema's keys", () => {
    // ZodObject exposes `.shape` — this is the structural-drift guard.
    const zodKeys = Object.keys(disclosureCardSchema._def.schema?.shape ?? {});
    // Some zod versions wrap in `_def.schema`; some store directly on shape.
    // Cover both.
    const directKeys = Object.keys(
      (disclosureCardSchema as unknown as { shape?: Record<string, unknown> }).shape ?? {},
    );
    const observedKeys = (zodKeys.length > 0 ? zodKeys : directKeys).sort();

    const jsonRequired = [...DISCLOSURE_CARD_JSON_SCHEMA.required].sort();

    expect(observedKeys).toEqual(jsonRequired);
  });
});
