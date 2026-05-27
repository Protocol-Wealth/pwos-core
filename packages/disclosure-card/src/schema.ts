// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Zod schema for the disclosure card.
 *
 * The schema constrains *shape and types*, never *values*. Adopters fill in
 * their own firm / CRD / model / retention / jurisdiction / limitations.
 * Enums on enumerated fields (oversight tier, PII mode, audit-trail rule)
 * are strict; everything else is a string or number constraint.
 */

import { z } from "zod";

import type { DisclosureCard } from "./types.js";
import { HUMAN_OVERSIGHT_TIERS, PII_HANDLING_MODES } from "./types.js";

export const operatorBlockSchema = z.object({
  firm: z.string().min(1),
  crd: z.string(),
});

export const modelBlockSchema = z.object({
  provider: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
});

export const dataRetentionBlockSchema = z.object({
  inputRetentionDays: z.number().int().nonnegative(),
  outputRetentionDays: z.number().int().nonnegative(),
  trainingUse: z.boolean(),
});

export const humanOversightBlockSchema = z.object({
  tier: z.enum(HUMAN_OVERSIGHT_TIERS),
  clientFacingRequiresApproval: z.boolean(),
  scope: z.string().min(1),
});

export const piiHandlingBlockSchema = z.object({
  mode: z.enum(PII_HANDLING_MODES),
  layerCount: z.number().int().nonnegative(),
});

export const auditTrailBlockSchema = z.object({
  rule: z.literal("SEC 204-2"),
  tamperEvident: z.boolean(),
});

export const disclosureCardSchema: z.ZodType<DisclosureCard> = z.object({
  systemName: z.string().min(1),
  version: z.string().min(1),
  operator: operatorBlockSchema,
  generatedAt: z.string().datetime(),
  model: modelBlockSchema,
  inferenceJurisdiction: z.string().min(1),
  dataRetention: dataRetentionBlockSchema,
  humanOversight: humanOversightBlockSchema,
  piiHandling: piiHandlingBlockSchema,
  knownLimitations: z.array(z.string().min(1)).readonly(),
  regulatoryBasis: z.array(z.string().min(1)).readonly(),
  auditTrail: auditTrailBlockSchema,
});
