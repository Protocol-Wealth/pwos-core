// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * JSON-Schema (Draft 2020-12) for the PlanningContract — a faithful copy of the
 * canonical `nexus-core` `engine/planning/planning_contract.schema.json`.
 *
 * Kept hand-mirrored (zero deps) so adopters/examiners can validate the wire
 * shape without the engine. The nexus-core `.json` is the cross-language source
 * of truth; if it changes, mirror it here and bump PLANNING_CONTRACT_VERSION.
 */

export const PLANNING_CONTRACT_JSON_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://nexusmcp.site/schemas/planning-contract-1.1.0.json",
  title: "PlanningContract",
  description:
    "PII-free case shape for multi-year Roth-conversion + IRMAA analysis. Canonical cross-language source of truth, mirrored by the nexus-core dataclass and the TypeScript @protocolwealthos/planning-contract package. Version 1.1.0 (additive-only since 1.0.0 — added accounts.employer_plan_aggregate).",
  type: "object",
  additionalProperties: false,
  required: [
    "case_id",
    "tax_year",
    "filing_status",
    "state_code",
    "birth_years",
    "income_ex_conversion",
    "accounts",
    "intent",
  ],
  properties: {
    contract_version: {
      type: "string",
      description: "Semver of the PlanningContract shape. Engine requires a matching MAJOR.",
      pattern: "^\\d+\\.\\d+\\.\\d+$",
      default: "1.1.0",
    },
    case_id: {
      type: "string",
      minLength: 1,
      description:
        "Opaque case identifier. MUST NOT be identity-derived. The identity<->case_id mapping lives only in the application layer (pw-api), never here.",
    },
    tax_year: {
      type: "integer",
      minimum: 2000,
      maximum: 2100,
      description: "First conversion year. Must be the earliest in intent.years.",
    },
    filing_status: {
      type: "string",
      enum: ["single", "mfj", "mfs"],
      description: "single = one filer; mfj = married filing jointly; mfs = married filing separately.",
    },
    state_code: {
      type: "string",
      pattern: "^[A-Za-z]{2}$",
      description:
        "Two-letter US state/territory code. Drives state treatment of the conversion (e.g. PA exempts IRA->Roth conversions past retirement age).",
    },
    birth_years: {
      type: "array",
      description: "Birth YEAR only (never DOB). One entry [self] or two [self, spouse].",
      minItems: 1,
      maxItems: 2,
      items: { type: "integer", minimum: 1900, maximum: 2100 },
    },
    medicare_enrolled: {
      type: "integer",
      minimum: 0,
      maximum: 2,
      default: 0,
      description: "Count of people on Medicare (0|1|2). IRMAA surcharge is per beneficiary.",
    },
    income_ex_conversion: {
      type: "object",
      additionalProperties: false,
      description: "Projected income for tax_year, BEFORE any conversion. Realized losses are negative gains.",
      properties: {
        wages: { type: "number", default: 0 },
        pension: { type: "number", default: 0 },
        social_security_gross: { type: "number", minimum: 0, default: 0 },
        taxable_interest: { type: "number", default: 0 },
        tax_exempt_interest: {
          type: "number",
          minimum: 0,
          default: 0,
          description: "Not federally taxable, but feeds the IRMAA MAGI.",
        },
        ordinary_dividends: { type: "number", minimum: 0, default: 0 },
        qualified_dividends: {
          type: "number",
          minimum: 0,
          default: 0,
          description: "Subset of ordinary_dividends; taxed at LTCG rates.",
        },
        short_term_gains: {
          type: "number",
          default: 0,
          description: "Taxed as ordinary income. Negative = realized short-term loss.",
        },
        long_term_gains: {
          type: "number",
          default: 0,
          description: "Preferential rates. Negative = realized long-term loss.",
        },
        other_ordinary: { type: "number", default: 0 },
        above_the_line: {
          type: "number",
          minimum: 0,
          default: 0,
          description: "Above-the-line deductions (subtracted from gross to reach AGI).",
        },
        itemized_or_standard: {
          default: "standard",
          description: '"standard" to take the standard deduction, or a number for the itemized total.',
          oneOf: [
            { type: "string", const: "standard" },
            { type: "number", minimum: 0 },
          ],
        },
      },
    },
    accounts: {
      type: "object",
      additionalProperties: false,
      required: ["trad_ira_aggregate"],
      description: "Aggregated, de-identified balances. No per-account identifiers.",
      properties: {
        trad_ira_aggregate: {
          type: "number",
          minimum: 0,
          description: "ALL Traditional/SEP/SIMPLE IRA balances summed; pro-rata applies across the total.",
        },
        nondeductible_basis: {
          type: "number",
          minimum: 0,
          default: 0,
          description: "Form 8606 after-tax basis. Cannot exceed trad_ira_aggregate.",
        },
        roth_balance: { type: "number", minimum: 0, default: 0 },
        first_roth_year: {
          type: ["integer", "null"],
          default: null,
          description: "Year the first Roth was funded (5-year-clock context).",
        },
        taxable_liquidity: {
          type: "number",
          minimum: 0,
          default: 0,
          description: "Cash OUTSIDE the IRA available to pay the conversion tax.",
        },
        employer_plan_aggregate: {
          type: "number",
          minimum: 0,
          default: 0,
          description:
            "Pre-tax employer-plan (401k/403b) balances. Added in v1.1.0. NOT directly convertible (roll to an IRA first), but adds to the future RMD drag.",
        },
      },
    },
    intent: {
      type: "object",
      additionalProperties: false,
      required: ["target_rule", "years"],
      properties: {
        target_rule: {
          type: "string",
          enum: ["fill_to_rate", "fill_to_irmaa_tier", "fixed_amount"],
        },
        target_rate: {
          type: ["number", "null"],
          exclusiveMinimum: 0,
          exclusiveMaximum: 1,
          description: "Required when target_rule = fill_to_rate (e.g. 0.24).",
        },
        fixed_amount: {
          type: ["number", "null"],
          exclusiveMinimum: 0,
          description: "Required when target_rule = fixed_amount.",
        },
        years: {
          type: "array",
          minItems: 1,
          uniqueItems: true,
          items: { type: "integer", minimum: 2000, maximum: 2100 },
          description: "Conversion years, e.g. [2026, 2027]. tax_year must be the earliest.",
        },
        purpose: {
          description: "Optional framing only; never changes the math.",
          anyOf: [
            { type: "string", enum: ["tax_smoothing", "irmaa_management", "legacy"] },
            { type: "null" },
          ],
        },
      },
    },
  },
} as const;

/** Return the PlanningContract JSON-Schema (a fresh deep copy, safe to mutate). */
export function getPlanningContractJsonSchema(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(PLANNING_CONTRACT_JSON_SCHEMA)) as Record<string, unknown>;
}
