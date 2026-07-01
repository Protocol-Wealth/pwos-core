// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * PlanningContract v1.1.0 — TypeScript mirror of the canonical nexus-core shape.
 *
 * This is the input half of the ABI for the Roth-conversion + IRMAA planning
 * capability. The canonical definition is the Python dataclass + JSON-Schema in
 * `nexus-core` (`engine/planning/case.py` + `planning_contract.schema.json`);
 * `PLANNING_CONTRACT_JSON_SCHEMA` in this package is a faithful copy of that
 * schema, and these interfaces mirror it field-for-field. Keep all three in sync;
 * the JSON-Schema is the cross-language source of truth.
 *
 * INVARIANT — PII-FREE BY CONSTRUCTION. No identity field exists anywhere: an
 * opaque `case_id` (never identity-derived), birth YEARS not dates of birth,
 * aggregated balances. The identity↔case_id mapping lives only in the application
 * layer (pw-api), never in this shape. This is the Reg S-P §248.30(b) design.
 *
 * Field names are snake_case to match the wire format the engine accepts.
 */

/** Semver of the PlanningContract + RothConversionAnalysis shapes. A breaking
 *  change is a cross-repo contract event: bump MAJOR in nexus-core, this package,
 *  and pwplan-core together. */
export const PLANNING_CONTRACT_VERSION = "1.1.0" as const;

/** single = one filer; mfj = married filing jointly; mfs = married filing separately. */
export type ContractFilingStatus = "single" | "mfj" | "mfs";

/** How each year's conversion is sized. */
export type TargetRule = "fill_to_rate" | "fill_to_irmaa_tier" | "fixed_amount";

/** Optional framing only — never changes the math. */
export type Purpose = "tax_smoothing" | "irmaa_management" | "legacy";

/** Projected income for `tax_year`, BEFORE any conversion. Annual dollars;
 *  realized losses are negative gains. `"standard"` or an itemized dollar total. */
export interface IncomeExConversion {
  wages?: number;
  pension?: number;
  social_security_gross?: number;
  taxable_interest?: number;
  /** Not federally taxable, but feeds the IRMAA MAGI. */
  tax_exempt_interest?: number;
  ordinary_dividends?: number;
  /** Subset of ordinary_dividends; taxed at LTCG rates. */
  qualified_dividends?: number;
  short_term_gains?: number;
  long_term_gains?: number;
  other_ordinary?: number;
  above_the_line?: number;
  itemized_or_standard?: "standard" | number;
}

/** Aggregated, de-identified balances. No per-account identifiers. */
export interface AccountBalances {
  /** ALL Traditional/SEP/SIMPLE IRA balances summed; pro-rata applies across it. */
  trad_ira_aggregate: number;
  /** Form 8606 after-tax basis. Cannot exceed trad_ira_aggregate. */
  nondeductible_basis?: number;
  roth_balance?: number;
  first_roth_year?: number | null;
  /** Cash OUTSIDE the IRA available to pay the conversion tax. */
  taxable_liquidity?: number;
  /** Pre-tax employer-plan (401k/403b) balances (contract v1.1.0). NOT directly
   *  convertible (roll to an IRA first), but adds to the future RMD drag. */
  employer_plan_aggregate?: number;
}

export interface ConversionIntent {
  target_rule: TargetRule;
  /** Conversion years, e.g. [2026, 2027]. tax_year must be the earliest. */
  years: number[];
  /** Required when target_rule = "fill_to_rate". */
  target_rate?: number | null;
  /** Required when target_rule = "fixed_amount". */
  fixed_amount?: number | null;
  purpose?: Purpose | null;
}

/** The PII-free planning case — the canonical input to the composite engine. */
export interface PlanningContract {
  /** Semver; the engine requires a matching MAJOR. Defaults to 1.1.0. */
  contract_version?: string;
  /** Opaque; MUST NOT be identity-derived. */
  case_id: string;
  /** First conversion year; must be the earliest in intent.years. */
  tax_year: number;
  filing_status: ContractFilingStatus;
  /** Two-letter US state/territory code. */
  state_code: string;
  /** Birth YEAR only (never DOB). [self] or [self, spouse]. */
  birth_years: number[];
  /** Count on Medicare (0|1|2). IRMAA surcharge is per beneficiary. */
  medicare_enrolled?: number;
  income_ex_conversion: IncomeExConversion;
  accounts: AccountBalances;
  intent: ConversionIntent;
}
