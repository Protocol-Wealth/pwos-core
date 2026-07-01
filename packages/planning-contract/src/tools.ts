// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * MCP tool definitions for the Roth-conversion + IRMAA planning capability.
 *
 * These are *declarations only* — the math lives in the nexus-core Python engine
 * and is reached over the planning gateway (`POST /mcp/tools/{id}`). Registering
 * them here means the agent path (pw-os-v2 / pw-api) inherits the tools, their
 * tiers, and the disclaimer/PII filter pipeline for free; no engine logic is
 * duplicated in TypeScript.
 *
 * The full input shape for `contract` is `PLANNING_CONTRACT_JSON_SCHEMA`; the
 * tool schemas describe it in prose to stay LLM-legible (deeply nested unions
 * confuse both models and reviewers).
 */

import {
  ToolTier,
  type JsonSchema,
  type ObjectSchema,
  type ToolDefinition,
  type ToolRegistry,
} from "@protocolwealthos/mcp-tools";

const PLANNING_TAGS = ["financial", "planning", "read", "roth", "irmaa"] as const;

const CONTRACT_PROPERTY: JsonSchema = {
  type: "object",
  additionalProperties: true,
  description:
    "A PII-free PlanningContract v1.1.0 (snake_case). Required: case_id (opaque, never identity-derived), tax_year (the earliest conversion year), filing_status (single|mfj|mfs), state_code (2-letter), birth_years (YEARS not DOBs), income_ex_conversion (wages/pension/social_security_gross/.../itemized_or_standard), accounts (trad_ira_aggregate, nondeductible_basis, roth_balance, taxable_liquidity; optional employer_plan_aggregate), and intent (target_rule fill_to_rate|fill_to_irmaa_tier|fixed_amount, years[], target_rate?, fixed_amount?). See PLANNING_CONTRACT_JSON_SCHEMA for the full schema.",
};

const OPTIONAL_TABLE: JsonSchema = {
  type: "object",
  additionalProperties: true,
};

const COMPOSITE_INPUT: ObjectSchema = {
  type: "object",
  required: ["contract"],
  properties: {
    contract: CONTRACT_PROPERTY,
    irmaa_inflation: {
      type: "number",
      description: "Annual assumption to project IRMAA floors to year N+2 (default 0.03).",
    },
    irmaa_buffer: {
      type: "number",
      description: "Dollars held below each projected IRMAA floor as a margin (default 5000).",
    },
    growth_rate: {
      type: "number",
      description: "Annual growth for the inter-year IRA balance + the do-nothing RMD projection (default 0.05).",
    },
    bracket_table: {
      ...OPTIONAL_TABLE,
      description: "Optional snapshotted federal bracket table; omit to use the engine reference basis.",
    },
    irmaa_table: {
      ...OPTIONAL_TABLE,
      description: "Optional snapshotted IRMAA tiers; omit to use the engine reference.",
    },
    state_rule: {
      ...OPTIONAL_TABLE,
      description: "Optional state treatment; omit to leave state tax unmodeled.",
    },
  },
};

/** `analyze_roth_conversion` — the composite multi-year analysis. */
export const ANALYZE_ROTH_CONVERSION_TOOL: ToolDefinition = {
  name: "analyze_roth_conversion",
  description:
    "Analyze a multi-year Roth-conversion plan for a retiree where the binding constraint is usually IRMAA (Medicare premium surcharges), not the tax bracket. For each intent year it sizes the conversion under min(bracket ceiling, projected-IRMAA ceiling), gates it by outside liquidity, applies IRC §72 pro-rata, and reports the all-in cost (federal incl. the Social-Security torpedo, LTCG stacking, NIIT, state treatment), the IRMAA cliff cost if crossed, the breakeven rate, and the do-nothing RMD drag. Read-only, PII-free; pass a PlanningContract under `contract`.",
  tier: ToolTier.ADVISOR,
  tags: PLANNING_TAGS,
  annotations: {
    title: "Roth conversion + IRMAA analysis",
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: false,
  },
  input_schema: COMPOSITE_INPUT,
};

/** `sequence_conversions` — the multi-year split roll-up only. */
export const SEQUENCE_CONVERSIONS_TOOL: ToolDefinition = {
  name: "sequence_conversions",
  description:
    "Return the multi-year Roth-conversion split + totals across the intent years against both the bracket and projected-IRMAA ceilings (the roll-up only; analyze_roth_conversion returns the same split with full per-year detail). Read-only, PII-free; pass a PlanningContract under `contract`.",
  tier: ToolTier.ADVISOR,
  tags: PLANNING_TAGS,
  annotations: {
    title: "Roth conversion sequencer",
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: false,
  },
  input_schema: COMPOSITE_INPUT,
};

/** `irmaa_headroom` — room before the next projected IRMAA cliff. */
export const IRMAA_HEADROOM_TOOL: ToolDefinition = {
  name: "irmaa_headroom",
  description:
    "Compute the room before the next PROJECTED Medicare IRMAA cliff in a target premium year. IRMAA runs on a 2-year MAGI lookback (a conversion in year N drives premiums in N+2), so the source-year tier floors are projected forward at an inflation assumption and a buffer is held below the projected floor. It is a cliff: $1 over a floor applies the whole tier's surcharge, per beneficiary. Read-only.",
  tier: ToolTier.ADVISOR,
  tags: PLANNING_TAGS,
  annotations: {
    title: "IRMAA headroom",
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: false,
  },
  input_schema: {
    type: "object",
    required: ["target_premium_year", "magi_ex_conversion", "per_person", "inflation", "buffer"],
    properties: {
      target_premium_year: {
        type: "integer",
        description: "conversion_year + 2 (the 2-year MAGI lookback).",
      },
      magi_ex_conversion: {
        type: "number",
        description: "Conversion-year MAGI BEFORE any conversion (AGI + tax-exempt interest).",
      },
      per_person: {
        type: "integer",
        description: "Medicare beneficiaries in the target year (IRMAA is per beneficiary).",
      },
      inflation: {
        type: "number",
        description: "Annual assumption to project the source-year floors to the target year.",
      },
      buffer: {
        type: "number",
        description: "Dollars held below the projected next floor as a margin.",
      },
      filing_status: {
        type: "string",
        enum: ["single", "mfj", "mfs"],
        description: "Selects the reference IRMAA table when irmaa_table is omitted.",
      },
      source_year: {
        type: "integer",
        description: "Published source year for the reference IRMAA table (default 2025).",
      },
      irmaa_table: {
        ...OPTIONAL_TABLE,
        description: "Optional snapshotted IRMAA tiers; omit to use the reference.",
      },
    },
  },
};

/** All planning tool definitions, in registration order. */
export const PLANNING_TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  ANALYZE_ROTH_CONVERSION_TOOL,
  SEQUENCE_CONVERSIONS_TOOL,
  IRMAA_HEADROOM_TOOL,
];

/** Register the planning tools on an existing {@link ToolRegistry}. */
export function registerPlanningTools(registry: ToolRegistry): void {
  registry.registerAll(PLANNING_TOOL_DEFINITIONS);
}
