// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Hand-rolled JSON Schema (Draft 2020-12) for the disclosure card.
 *
 * Kept hand-rolled (rather than generated from the Zod schema) for two
 * reasons: (1) zero extra deps on this package, (2) the JSON Schema is part
 * of the public reference surface — adopters / examiners can read it without
 * pulling our Zod definitions, and it stays stable across our Zod-version
 * bumps.
 *
 * If you add a field to `disclosureCardSchema`, mirror it here AND add a
 * test in `__tests__/disclosure.test.ts` that asserts the two stay in sync
 * by checking that the example instance validates against both.
 */

import { HUMAN_OVERSIGHT_TIERS, PII_HANDLING_MODES } from "./types.js";

export const DISCLOSURE_CARD_JSON_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://github.com/Protocol-Wealth/pwos-core/packages/shared/disclosure-card.schema.json",
  title: "DisclosureCard",
  description:
    "Machine-readable disclosure of an AI-assisted system's model, data, oversight, PII handling, regulatory basis, and audit-trail posture.",
  type: "object",
  required: [
    "systemName",
    "version",
    "operator",
    "generatedAt",
    "model",
    "inferenceJurisdiction",
    "dataRetention",
    "humanOversight",
    "piiHandling",
    "knownLimitations",
    "regulatoryBasis",
    "auditTrail",
  ],
  additionalProperties: false,
  properties: {
    systemName: { type: "string", minLength: 1 },
    version: { type: "string", minLength: 1 },
    operator: {
      type: "object",
      required: ["firm", "crd"],
      additionalProperties: false,
      properties: {
        firm: { type: "string", minLength: 1 },
        crd: { type: "string" },
      },
    },
    generatedAt: {
      type: "string",
      format: "date-time",
      description: "ISO-8601 datetime",
    },
    model: {
      type: "object",
      required: ["provider", "name", "version"],
      additionalProperties: false,
      properties: {
        provider: { type: "string", minLength: 1 },
        name: { type: "string", minLength: 1 },
        version: { type: "string", minLength: 1 },
      },
    },
    inferenceJurisdiction: { type: "string", minLength: 1 },
    dataRetention: {
      type: "object",
      required: ["inputRetentionDays", "outputRetentionDays", "trainingUse"],
      additionalProperties: false,
      properties: {
        inputRetentionDays: { type: "integer", minimum: 0 },
        outputRetentionDays: { type: "integer", minimum: 0 },
        trainingUse: { type: "boolean" },
      },
    },
    humanOversight: {
      type: "object",
      required: ["tier", "clientFacingRequiresApproval", "scope"],
      additionalProperties: false,
      properties: {
        tier: { type: "string", enum: [...HUMAN_OVERSIGHT_TIERS] },
        clientFacingRequiresApproval: { type: "boolean" },
        scope: { type: "string", minLength: 1 },
      },
    },
    piiHandling: {
      type: "object",
      required: ["mode", "layerCount"],
      additionalProperties: false,
      properties: {
        mode: { type: "string", enum: [...PII_HANDLING_MODES] },
        layerCount: { type: "integer", minimum: 0 },
      },
    },
    knownLimitations: {
      type: "array",
      items: { type: "string", minLength: 1 },
    },
    regulatoryBasis: {
      type: "array",
      items: { type: "string", minLength: 1 },
      description: "Append ' [VERIFY]' to any citation not independently verified.",
    },
    auditTrail: {
      type: "object",
      required: ["rule", "tamperEvident"],
      additionalProperties: false,
      properties: {
        rule: { type: "string", const: "SEC 204-2" },
        tamperEvident: { type: "boolean" },
      },
    },
  },
} as const;

/**
 * Re-export as a plain JSON-serializable object (no `as const` narrowing) so
 * callers can JSON.stringify it directly for publishing.
 */
export function getDisclosureCardJsonSchema(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(DISCLOSURE_CARD_JSON_SCHEMA)) as Record<
    string,
    unknown
  >;
}
