// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * RothConversionAnalysis v1.1.0 — TypeScript mirror of the nexus-core output shape.
 *
 * The output half of the planning ABI (the canonical definition is the dataclass
 * set in `nexus-core` `engine/planning/analysis.py`, with a generated JSON-Schema
 * in `result_schema.py`). Serializable + identity-free: `null` means
 * "unbounded / not applicable" (e.g. IRMAA headroom in the top tier) so there is
 * never an `Infinity`/`NaN`. Field names are snake_case to match the wire form.
 */

/** Result of `irmaa_headroom` for a single conversion year. */
export interface IrmaaHeadroom {
  target_premium_year: number;
  tiers_source_year: number;
  inflation_assumption: number;
  buffer: number;
  per_person: number;
  current_tier_index: number;
  in_top_tier: boolean;
  projected_current_floor: number;
  /** null when already in the top tier. */
  projected_next_floor: number | null;
  /** Room before the next cliff, net of the buffer; null in the top tier. */
  irmaa_safe_headroom: number | null;
  current_annual_surcharge: number;
  /** Incremental annual surcharge of crossing the next tier; null if none above. */
  cliff_cost_if_crossed: number | null;
}

/** 3.8% Net Investment Income Tax interaction with the conversion. */
export interface NiitInteraction {
  threshold: number;
  net_investment_income: number;
  magi_before: number;
  magi_after: number;
  niit_before: number;
  niit_after: number;
  incremental_niit: number;
}

/** How the conversion lifts preferential income (LTCG + qualified dividends). */
export interface LtcgStacking {
  preferential_income: number;
  ltcg_rate_before: number;
  ltcg_rate_after: number;
  ltcg_tax_before: number;
  ltcg_tax_after: number;
  incremental_ltcg_tax: number;
}

/** IRC §72 pro-rata treatment of after-tax basis. */
export interface ProRata {
  applies: boolean;
  nondeductible_basis: number;
  trad_ira_aggregate: number;
  basis_fraction: number;
  taxable_fraction: number;
  taxable_portion: number;
  basis_recovered: number;
}

/** Whether outside cash can pay the conversion tax. */
export interface LiquidityGate {
  taxable_liquidity: number;
  total_tax_due: number;
  gated: boolean;
  liquidity_limited_amount: number;
  note: string;
}

/** State income-tax treatment of the conversion. */
export interface StateTax {
  state_code: string;
  modeled: boolean;
  treatment: string;
  rate: number;
  incremental_state_tax: number;
  note: string;
}

/** One named sizing of a year's conversion, for side-by-side display. */
export interface ConversionOption {
  key: string;
  label: string;
  amount: number;
  marginal_rate_after: number;
  crosses_irmaa_cliff: boolean;
}

/** ACA premium-tax-credit (PTC) erosion from the conversion (contract v1.1.0).
 *  Populated only when an ACA situation is injected and someone is under 65 +
 *  marketplace-enrolled; `null` on `YearAnalysis.aca` otherwise. A
 *  flag-with-magnitude estimate, not a precise PTC determination. */
export interface AcaInteraction {
  cliff_mode: string;
  magi_pct_fpl_before: number;
  magi_pct_fpl_after: number;
  ptc_before: number;
  ptc_after: number;
  incremental_ptc_loss: number;
  crosses_hard_cliff: boolean;
}

/** Per-year conversion analysis. */
export interface YearAnalysis {
  year: number;
  ages: number[];
  target_premium_year: number;
  magi_ex_conversion: number;
  ordinary_taxable_ex_conversion: number;
  /** null = bracket not binding (no target rate / top of schedule). */
  bracket_ceiling: number | null;
  /** null = IRMAA not binding (top tier, or no Medicare beneficiary). */
  irmaa_ceiling: number | null;
  binding_ceiling: number;
  binding_constraint: BindingConstraint;
  recommended_amount: number;
  incremental_federal_tax: number;
  effective_conversion_rate: number;
  breakeven_retirement_rate: number;
  options: ConversionOption[];
  irmaa: IrmaaHeadroom;
  niit: NiitInteraction;
  ltcg: LtcgStacking;
  pro_rata: ProRata;
  state_tax: StateTax;
  liquidity: LiquidityGate;
  notes: string[];
  /** ACA PTC erosion (contract v1.1.0); null unless an ACA situation is injected
   *  and someone is under 65 + marketplace-enrolled. */
  aca?: AcaInteraction | null;
}

export type BindingConstraint =
  | "bracket"
  | "irmaa"
  | "liquidity"
  | "trad_balance"
  | "fixed_amount"
  | "none";

/** The cost of NOT converting: the future RMD drag. */
export interface DoNothingProjection {
  rmd_start_age: number;
  first_rmd_year: number;
  years_until_rmd: number;
  growth_rate_assumption: number;
  projected_trad_balance_at_rmd: number;
  first_year_rmd: number;
  first_year_rmd_marginal_rate: number;
  note: string;
  /** Pre-tax employer-plan balance folded into the RMD-drag pool (contract v1.1.0). */
  employer_plan_aggregate?: number;
  /** Survivor-year compression (contract v1.1.0): the marginal rate the first-year
   *  RMD would face if the surviving spouse filed single; null when already single/mfs. */
  survivor_first_year_rmd_marginal_rate?: number | null;
}

/** Multi-year roll-up of the recommended conversion sequence. */
export interface SequenceSummary {
  years: number[];
  recommended_by_year: number[];
  total_recommended: number;
  total_incremental_tax: number;
  residual_trad_balance: number;
  note: string;
}

/** Everything the caller must persist to reproduce + defend the analysis. */
export interface SnapshotMetadata {
  engine_version: string;
  contract_version: string;
  bracket_table_year: number;
  bracket_table_source: string;
  irmaa_tiers_source_year: number;
  irmaa_inflation_assumption: number;
  irmaa_buffer: number;
  irmaa_table_source: string;
  state_rule_source: string;
}

/** The complete, PII-free result of the composite Roth-conversion analysis. */
export interface RothConversionAnalysis {
  contract_version: string;
  engine_version: string;
  case_id: string;
  filing_status: string;
  years: YearAnalysis[];
  sequence: SequenceSummary;
  do_nothing: DoNothingProjection;
  snapshot: SnapshotMetadata;
  assumptions: string[];
  disclaimer: string;
}
