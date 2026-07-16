// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { z } from "zod";

import {
  ACCOUNTING_CONTRACT_VERSION,
  ACCOUNTING_EVENT_KINDS,
  ACCOUNTING_GATEWAY_TOOL_IDS,
  ACCOUNTING_METHOD_VERSION,
  ACCOUNTING_REPLAY_VERSION,
  ACCOUNTING_TOOL_IDS,
} from "./constants.js";
import { eventKindSchema, feeAllocationSchema, feePaymentSchema } from "./common.js";
import {
  nonNegativeAccountingDecimalSchema,
  nonNegativeDerivedAccountingDecimalSchema,
  positiveDerivedAccountingDecimalSchema,
  signedDerivedAccountingDecimalSchema,
} from "./decimal.js";
import { accountingDateSchema } from "./inputs.js";
import { serializedAssetRefSchema, serializedLedgerEventSchema } from "./serializedLedger.js";

const unixSecondsSchema = z.number().int().nonnegative();
const nullableString = z.string().nullable();

const responseEnvelopeShape = {
  contractVersion: z.literal(ACCOUNTING_CONTRACT_VERSION),
  disclaimer: z.string().min(1),
} as const;

export const accountingToolDiscoverySchema = z.strictObject({
  contractVersion: z.literal(ACCOUNTING_CONTRACT_VERSION),
  tools: z.array(z.enum(ACCOUNTING_GATEWAY_TOOL_IDS)).min(1),
});

const jsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);
const jsonObjectSchema = z.record(z.string(), jsonValueSchema);

const describeMethodologySchema = z.strictObject({
  method: z.literal("fifo"),
  methodVersion: z.literal(ACCOUNTING_METHOD_VERSION),
  source: z.string(),
  lastVerified: accountingDateSchema,
  reviewStatus: z.enum(["pending_governance_review", "approved"]),
  eventTreatment: z.record(eventKindSchema, z.string()),
});

export const describeAccountingResponseSchema = z.strictObject({
  ...responseEnvelopeShape,
  engine: z.literal("onchain-accounting"),
  status: z.literal("available"),
  tools: z.array(z.enum(ACCOUNTING_GATEWAY_TOOL_IDS)).min(1),
  plannedTools: z.tuple([
    z.literal("price_history"),
    z.literal("decode_onchain_events"),
    z.literal("compute_cost_basis"),
    z.literal("onchain_pnl_report"),
  ]),
  eventLedgerSchema: jsonObjectSchema,
  costBasisRequestSchema: jsonObjectSchema,
  pnlReportRequestSchema: jsonObjectSchema,
  methodology: describeMethodologySchema,
});

const pricedPriceResultSchema = z.strictObject({
  coin: z.string().min(1).max(256),
  timestamp: unixSecondsSchema,
  status: z.literal("priced"),
  priceUsd: nonNegativeAccountingDecimalSchema,
  source: z.string().min(1),
  asOf: unixSecondsSchema,
  confidence: z.number().finite().nullable(),
  reason: nullableString,
});

const unpricedPriceResultSchema = z.strictObject({
  coin: z.string().min(1).max(256),
  timestamp: unixSecondsSchema,
  status: z.literal("unpriced"),
  priceUsd: z.null(),
  source: z.null(),
  asOf: z.null(),
  confidence: z.null(),
  reason: z.string().min(1),
});

export const priceResultSchema = z.discriminatedUnion("status", [
  pricedPriceResultSchema,
  unpricedPriceResultSchema,
]);

export const priceHistoryResponseSchema = z.strictObject({
  ...responseEnvelopeShape,
  prices: z.array(priceResultSchema),
});

export const decodeOnchainEventsResponseSchema = z.strictObject({
  ...responseEnvelopeShape,
  events: z.array(serializedLedgerEventSchema),
  eventCountsByKind: z.partialRecord(eventKindSchema, z.number().int().nonnegative()),
});

export const methodologyMetadataSchema = z.strictObject({
  method: z.literal("fifo"),
  method_version: z.literal(ACCOUNTING_METHOD_VERSION),
  source: z.string(),
  last_verified: accountingDateSchema,
  review_status: z.enum(["pending_governance_review", "approved"]),
  holding_period_rule: z.string(),
  event_treatment: z.record(eventKindSchema, z.string()),
  transfer_rule: z.string(),
  fee_rule: z.string(),
});

export const calculationGapSchema = z.strictObject({
  code: z.string(),
  message: z.string(),
  event_id: nullableString,
  account_ref: nullableString,
  asset_id: nullableString,
});

export const calculationAssumptionSchema = z.strictObject({
  code: z.string(),
  message: z.string(),
  event_id: nullableString,
  transfer_ref: nullableString,
});

export const replayMetadataSchema = z.strictObject({
  replay_version: z.literal(ACCOUNTING_REPLAY_VERSION),
  mode: z.enum(["all_events", "full_history", "opening_state"]),
  start_at: unixSecondsSchema.nullable(),
  end_at: unixSecondsSchema.nullable(),
  opening_state_ref: nullableString,
  opening_state_schema_version: nullableString,
  opening_state_source: nullableString,
  opening_state_last_verified: accountingDateSchema.nullable(),
  opening_state_basis_method: nullableString,
  opening_state_basis_method_version: nullableString,
  opening_state_snapshot_complete: z.boolean().nullable(),
  input_event_count: z.number().int(),
  replayed_event_count: z.number().int(),
  pre_period_event_count: z.number().int(),
  in_period_event_count: z.number().int(),
  post_period_excluded_count: z.number().int(),
});

export const coverageMetadataSchema = z.strictObject({
  account_count: z.number().int(),
  asset_count: z.number().int(),
  open_lot_count: z.number().int(),
  known_basis_open_lot_count: z.number().int(),
  unknown_basis_open_lot_count: z.number().int(),
  disposition_count: z.number().int(),
  complete_disposition_count: z.number().int(),
  incomplete_disposition_count: z.number().int(),
  unresolved_event_count: z.number().int(),
  unresolved_transfer_count: z.number().int(),
  unresolved_fee_count: z.number().int(),
});

export const calculationCompletenessSchema = z
  .strictObject({
    complete: z.boolean(),
    statement_ready: z.boolean(),
    gap_count: z.number().int(),
    gaps: z.array(calculationGapSchema),
  })
  .superRefine((value, context) => {
    if (value.gap_count !== value.gaps.length) {
      context.addIssue({
        code: "custom",
        path: ["gap_count"],
        message: "gap_count must equal gaps.length",
      });
    }
    if (value.complete !== (value.gap_count === 0)) {
      context.addIssue({
        code: "custom",
        path: ["complete"],
        message: "complete must match whether calculation gaps are empty",
      });
    }
  });

export const costLotSchema = z.strictObject({
  lot_ref: z.string(),
  account_ref: z.string(),
  asset: serializedAssetRefSchema,
  quantity: positiveDerivedAccountingDecimalSchema,
  cost_basis_usd: nonNegativeDerivedAccountingDecimalSchema.nullable(),
  unit_cost_usd: nonNegativeDerivedAccountingDecimalSchema.nullable(),
  acquired_at: unixSecondsSchema.nullable(),
  acquisition_sequence: unixSecondsSchema.nullable(),
  acquisition_leg_index: z.number().int(),
  basis_source: z.string(),
  basis_override_ref: nullableString,
  basis_last_verified: accountingDateSchema.nullable(),
  basis_evidence_source: nullableString,
  acquisition_fee_usd: nonNegativeDerivedAccountingDecimalSchema,
  acquisition_event_id: nullableString,
  acquisition_tx_ref: nullableString,
  origin_lot_ref: nullableString,
  basis_price_source: nullableString,
  basis_price_as_of: unixSecondsSchema.nullable(),
  market_value_usd: nonNegativeDerivedAccountingDecimalSchema.nullable(),
  unrealized_pnl_usd: signedDerivedAccountingDecimalSchema.nullable(),
  market_price_source: nullableString,
  market_price_as_of: unixSecondsSchema.nullable(),
});

export const disposalRecordSchema = z.strictObject({
  disposition_ref: z.string(),
  disposition_type: z.enum(["principal", "fee_asset"]),
  account_ref: z.string(),
  asset: serializedAssetRefSchema,
  quantity: positiveDerivedAccountingDecimalSchema,
  gross_proceeds_usd: nonNegativeDerivedAccountingDecimalSchema.nullable(),
  fee_adjustment_usd: nonNegativeDerivedAccountingDecimalSchema,
  proceeds_usd: signedDerivedAccountingDecimalSchema.nullable(),
  cost_basis_usd: nonNegativeDerivedAccountingDecimalSchema.nullable(),
  realized_gain_usd: signedDerivedAccountingDecimalSchema.nullable(),
  lot_ref: nullableString,
  acquisition_event_id: nullableString,
  acquisition_tx_ref: nullableString,
  origin_lot_ref: nullableString,
  disposal_event_id: z.string(),
  disposal_tx_ref: nullableString,
  basis_source: nullableString,
  basis_override_ref: nullableString,
  basis_last_verified: accountingDateSchema.nullable(),
  basis_evidence_source: nullableString,
  basis_fee_adjustment_usd: nonNegativeDerivedAccountingDecimalSchema,
  basis_price_source: nullableString,
  basis_price_as_of: unixSecondsSchema.nullable(),
  proceeds_price_source: nullableString,
  proceeds_price_as_of: unixSecondsSchema.nullable(),
  fee_allocation: feeAllocationSchema.nullable(),
  fee_payment: feePaymentSchema.nullable(),
  acquired_at: unixSecondsSchema.nullable(),
  disposed_at: unixSecondsSchema,
  holding_days: z.number().int().nullable(),
  term: z.enum(["short", "long"]).nullable(),
  complete: z.boolean(),
  missing_fields: z.array(z.string()),
});

const sharedResultShape = {
  ...responseEnvelopeShape,
  method: z.literal("fifo"),
  methodology: methodologyMetadataSchema,
  replay: replayMetadataSchema,
  coverage: coverageMetadataSchema,
  completeness: calculationCompletenessSchema,
  assumptions: z.array(calculationAssumptionSchema),
} as const;

function addStatementReadinessIssues(
  value: {
    methodology: { review_status: "pending_governance_review" | "approved" };
    replay: { mode: "all_events" | "full_history" | "opening_state" };
    completeness: { complete: boolean; statement_ready: boolean };
  },
  context: z.RefinementCtx,
): void {
  const expected =
    value.completeness.complete &&
    value.replay.mode !== "all_events" &&
    value.methodology.review_status === "approved";
  if (value.completeness.statement_ready !== expected) {
    context.addIssue({
      code: "custom",
      path: ["completeness", "statement_ready"],
      message: "statement_ready must remain false until calculation, replay, and governance pass",
    });
  }
}

export const costBasisTotalsSchema = z.strictObject({
  open_cost_basis_usd: nonNegativeDerivedAccountingDecimalSchema.nullable(),
  open_market_value_usd: nonNegativeDerivedAccountingDecimalSchema.nullable(),
  open_unrealized_pnl_usd: signedDerivedAccountingDecimalSchema.nullable(),
  realized_gain_usd: signedDerivedAccountingDecimalSchema.nullable(),
});

export const computeCostBasisResponseSchema = z
  .strictObject({
    ...sharedResultShape,
    open_lots: z.array(costLotSchema),
    disposals: z.array(disposalRecordSchema),
    totals: costBasisTotalsSchema,
    warnings: z.array(z.string()),
  })
  .superRefine(addStatementReadinessIssues);

const pnlBucketShape = {
  realized_gain_usd: signedDerivedAccountingDecimalSchema,
  short_term_gain_usd: signedDerivedAccountingDecimalSchema,
  long_term_gain_usd: signedDerivedAccountingDecimalSchema,
  proceeds_usd: signedDerivedAccountingDecimalSchema,
  cost_basis_usd: nonNegativeDerivedAccountingDecimalSchema,
  disposal_count: z.number().int(),
  incomplete_count: z.number().int(),
  calculation_gap_count: z.number().int(),
  complete: z.boolean(),
} as const;

export const pnlBucketSchema = z.strictObject(pnlBucketShape);
export const pnlYearSchema = z.strictObject({ year: z.number().int(), ...pnlBucketShape });

export const onchainPnlReportResponseSchema = z
  .strictObject({
    ...sharedResultShape,
    summary: pnlBucketSchema,
    by_year: z.array(pnlYearSchema),
    dispositions: z.array(disposalRecordSchema),
    warnings: z.array(z.string()),
  })
  .superRefine(addStatementReadinessIssues);

export type AccountingToolDiscovery = z.infer<typeof accountingToolDiscoverySchema>;
export type DescribeAccountingResponse = z.infer<typeof describeAccountingResponseSchema>;
export type PriceResult = z.infer<typeof priceResultSchema>;
export type PriceHistoryResponse = z.infer<typeof priceHistoryResponseSchema>;
export type DecodeOnchainEventsResponse = z.infer<typeof decodeOnchainEventsResponseSchema>;
export type MethodologyMetadata = z.infer<typeof methodologyMetadataSchema>;
export type CalculationGap = z.infer<typeof calculationGapSchema>;
export type CalculationAssumption = z.infer<typeof calculationAssumptionSchema>;
export type ReplayMetadata = z.infer<typeof replayMetadataSchema>;
export type CoverageMetadata = z.infer<typeof coverageMetadataSchema>;
export type CalculationCompleteness = z.infer<typeof calculationCompletenessSchema>;
export type CostLot = z.infer<typeof costLotSchema>;
export type DisposalRecord = z.infer<typeof disposalRecordSchema>;
export type CostBasisTotals = z.infer<typeof costBasisTotalsSchema>;
export type ComputeCostBasisResponse = z.infer<typeof computeCostBasisResponseSchema>;
export type PnlBucket = z.infer<typeof pnlBucketSchema>;
export type PnlYear = z.infer<typeof pnlYearSchema>;
export type OnchainPnlReportResponse = z.infer<typeof onchainPnlReportResponseSchema>;

/** Stable treatment keys expected in every v0.2.0 methodology response. */
export const ACCOUNTING_EVENT_TREATMENT_KEYS = ACCOUNTING_EVENT_KINDS;
