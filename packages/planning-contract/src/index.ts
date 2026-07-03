// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * @protocolwealthos/planning-contract
 *
 * The TypeScript mirror of the Roth-conversion + IRMAA planning ABI: the PII-free
 * `PlanningContract` input shape, the `RothConversionAnalysis` output shape, the
 * canonical JSON-Schema, and the MCP tool definitions. The math lives in the
 * nexus-core Python engine; this package is the shared shape pw-api and
 * pwplan-core build against, and the tool registry the agent path uses.
 *
 * PII-free by construction — no type here carries identity (opaque case_id,
 * birth years not DOBs). See contract.ts.
 *
 * Defensive patent: USPTO #64/034,215.
 */

export const VERSION = "0.3.1";

export {
  PLANNING_CONTRACT_VERSION,
  type AccountBalances,
  type ContractFilingStatus,
  type ConversionIntent,
  type IncomeExConversion,
  type PlanningContract,
  type Purpose,
  type TargetRule,
} from "./contract.js";

export {
  type AcaInteraction,
  type BindingConstraint,
  type ConversionOption,
  type DoNothingProjection,
  type IrmaaHeadroom,
  type LiquidityGate,
  type LtcgStacking,
  type NiitInteraction,
  type ProRata,
  type RothConversionAnalysis,
  type SequenceSummary,
  type SnapshotMetadata,
  type StateTax,
  type YearAnalysis,
} from "./analysis.js";

export {
  PLANNING_CONTRACT_JSON_SCHEMA,
  getPlanningContractJsonSchema,
} from "./jsonSchema.js";

export {
  ANALYZE_ROTH_CONVERSION_TOOL,
  IRMAA_HEADROOM_TOOL,
  PLANNING_TOOL_DEFINITIONS,
  SEQUENCE_CONVERSIONS_TOOL,
  registerPlanningTools,
} from "./tools.js";
