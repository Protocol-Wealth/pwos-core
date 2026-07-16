// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { z } from "zod";

import {
  ACCOUNTING_CONTRACT_VERSION,
  ACCOUNTING_EVENT_KINDS,
  ACCOUNTING_GATEWAY_TOOL_IDS,
  ACCOUNTING_METHOD_VERSION,
  ACCOUNTING_REPLAY_VERSION,
} from "./constants.js";
import {
  accountingAccountRefSchema,
  boundedAccountingStringSchema,
  eventKindSchema,
  feeAllocationSchema,
  feePaymentSchema,
} from "./common.js";
import {
  accountingDecimalLessThanOrEqual,
  accountingDecimalSubtractEquals,
  accountingDecimalSumEquals,
  nonNegativeAccountingDecimalSchema,
  nonNegativeDerivedAccountingDecimalSchema,
  positiveDerivedAccountingDecimalSchema,
  signedDerivedAccountingDecimalSchema,
} from "./decimal.js";
import { accountingDateSchema } from "./inputs.js";
import { serializedAssetRefSchema, serializedLedgerEventSchema } from "./serializedLedger.js";

const unixSecondsSchema = z.number().int().nonnegative();
const nonNegativeIntegerSchema = z.number().int().nonnegative();
const nullableRef = (maxLength: number) => boundedAccountingStringSchema(maxLength).nullable();

const responseEnvelopeShape = {
  contractVersion: z.literal(ACCOUNTING_CONTRACT_VERSION),
  disclaimer: boundedAccountingStringSchema(2_048),
} as const;

const EXPECTED_GATEWAY_TOOLS = new Set<string>(ACCOUNTING_GATEWAY_TOOL_IDS);

/** Exact production v0.2.0 handler set; order is deliberately irrelevant. */
export const accountingGatewayToolsSchema = z
  .array(z.enum(ACCOUNTING_GATEWAY_TOOL_IDS))
  .length(ACCOUNTING_GATEWAY_TOOL_IDS.length)
  .superRefine((tools, context) => {
    const unique = new Set(tools);
    if (unique.size !== tools.length) {
      context.addIssue({ code: "custom", message: "accounting tools must be duplicate-free" });
    }
    for (const tool of EXPECTED_GATEWAY_TOOLS) {
      if (!unique.has(tool as (typeof ACCOUNTING_GATEWAY_TOOL_IDS)[number])) {
        context.addIssue({ code: "custom", message: `accounting gateway is missing ${tool}` });
      }
    }
  });

export const accountingToolDiscoverySchema = z.strictObject({
  contractVersion: z.literal(ACCOUNTING_CONTRACT_VERSION),
  tools: accountingGatewayToolsSchema,
});

/** Require contract 0.2.0 and the complete five-handler production surface. */
export function isAccountingGatewayCompatible(value: unknown): value is AccountingToolDiscovery {
  return accountingToolDiscoverySchema.safeParse(value).success;
}

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
  source: boundedAccountingStringSchema(512),
  lastVerified: accountingDateSchema,
  reviewStatus: z.enum(["pending_governance_review", "approved"]),
  eventTreatment: z.record(eventKindSchema, boundedAccountingStringSchema(512)),
});

export const describeAccountingResponseSchema = z.strictObject({
  ...responseEnvelopeShape,
  engine: z.literal("onchain-accounting"),
  status: z.literal("available"),
  tools: accountingGatewayToolsSchema,
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
  source: boundedAccountingStringSchema(128),
  asOf: unixSecondsSchema,
  confidence: z.number().finite().nullable(),
  reason: nullableRef(512),
});

const unpricedPriceResultSchema = z.strictObject({
  coin: z.string().min(1).max(256),
  timestamp: unixSecondsSchema,
  status: z.literal("unpriced"),
  priceUsd: z.null(),
  source: z.null(),
  asOf: z.null(),
  confidence: z.null(),
  reason: boundedAccountingStringSchema(512),
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
  eventCountsByKind: z.partialRecord(eventKindSchema, nonNegativeIntegerSchema),
});

export const methodologyMetadataSchema = z.strictObject({
  method: z.literal("fifo"),
  method_version: z.literal(ACCOUNTING_METHOD_VERSION),
  source: boundedAccountingStringSchema(512),
  last_verified: accountingDateSchema,
  review_status: z.enum(["pending_governance_review", "approved"]),
  holding_period_rule: boundedAccountingStringSchema(2_048),
  event_treatment: z.record(eventKindSchema, boundedAccountingStringSchema(512)),
  transfer_rule: boundedAccountingStringSchema(2_048),
  fee_rule: boundedAccountingStringSchema(2_048),
});

export const calculationGapSchema = z.strictObject({
  code: boundedAccountingStringSchema(128),
  message: boundedAccountingStringSchema(2_048),
  event_id: nullableRef(128),
  account_ref: accountingAccountRefSchema.nullable(),
  asset_id: nullableRef(128),
});

export const calculationAssumptionSchema = z.strictObject({
  code: boundedAccountingStringSchema(128),
  message: boundedAccountingStringSchema(2_048),
  event_id: nullableRef(128),
  transfer_ref: nullableRef(128),
});

export const replayMetadataSchema = z
  .strictObject({
    replay_version: z.literal(ACCOUNTING_REPLAY_VERSION),
    mode: z.enum(["all_events", "full_history", "opening_state"]),
    start_at: unixSecondsSchema.nullable(),
    end_at: unixSecondsSchema.nullable(),
    opening_state_ref: nullableRef(128),
    opening_state_schema_version: nullableRef(32),
    opening_state_source: nullableRef(128),
    opening_state_last_verified: accountingDateSchema.nullable(),
    opening_state_basis_method: nullableRef(32),
    opening_state_basis_method_version: nullableRef(32),
    opening_state_snapshot_complete: z.boolean().nullable(),
    input_event_count: nonNegativeIntegerSchema,
    replayed_event_count: nonNegativeIntegerSchema,
    pre_period_event_count: nonNegativeIntegerSchema,
    in_period_event_count: nonNegativeIntegerSchema,
    post_period_excluded_count: nonNegativeIntegerSchema,
  })
  .superRefine((value, context) => {
    if (value.replayed_event_count !== value.pre_period_event_count + value.in_period_event_count) {
      context.addIssue({
        code: "custom",
        path: ["replayed_event_count"],
        message: "replayed_event_count must partition into pre-period and in-period events",
      });
    }
    if (value.input_event_count !== value.replayed_event_count + value.post_period_excluded_count) {
      context.addIssue({
        code: "custom",
        path: ["input_event_count"],
        message: "input_event_count must partition into replayed and post-period events",
      });
    }

    const openingFields = [
      value.opening_state_ref,
      value.opening_state_schema_version,
      value.opening_state_source,
      value.opening_state_last_verified,
      value.opening_state_basis_method,
      value.opening_state_basis_method_version,
      value.opening_state_snapshot_complete,
    ];
    if (value.mode === "all_events") {
      if (
        value.start_at !== null ||
        value.end_at !== null ||
        openingFields.some((field) => field !== null) ||
        value.pre_period_event_count !== 0 ||
        value.post_period_excluded_count !== 0
      ) {
        context.addIssue({ code: "custom", message: "all_events replay metadata is inconsistent" });
      }
      return;
    }

    if (value.start_at === null || value.end_at === null || value.end_at <= value.start_at) {
      context.addIssue({ code: "custom", message: "bounded replay requires valid start/end bounds" });
    }
    if (value.mode === "full_history" && openingFields.some((field) => field !== null)) {
      context.addIssue({ code: "custom", message: "full_history replay cannot carry opening state" });
    }
    if (
      value.mode === "opening_state" &&
      (value.opening_state_ref === null ||
        value.opening_state_schema_version !== ACCOUNTING_METHOD_VERSION ||
        value.opening_state_source === null ||
        value.opening_state_last_verified === null ||
        value.opening_state_basis_method !== "fifo" ||
        value.opening_state_basis_method_version !== ACCOUNTING_METHOD_VERSION ||
        value.opening_state_snapshot_complete !== true)
    ) {
      context.addIssue({ code: "custom", message: "opening_state replay metadata is incomplete" });
    }
  });

export const coverageMetadataSchema = z
  .strictObject({
    account_count: nonNegativeIntegerSchema,
    asset_count: nonNegativeIntegerSchema,
    open_lot_count: nonNegativeIntegerSchema,
    known_basis_open_lot_count: nonNegativeIntegerSchema,
    unknown_basis_open_lot_count: nonNegativeIntegerSchema,
    disposition_count: nonNegativeIntegerSchema,
    complete_disposition_count: nonNegativeIntegerSchema,
    incomplete_disposition_count: nonNegativeIntegerSchema,
    unresolved_event_count: nonNegativeIntegerSchema,
    unresolved_transfer_count: nonNegativeIntegerSchema,
    unresolved_fee_count: nonNegativeIntegerSchema,
  })
  .superRefine((value, context) => {
    if (
      value.open_lot_count !==
      value.known_basis_open_lot_count + value.unknown_basis_open_lot_count
    ) {
      context.addIssue({
        code: "custom",
        path: ["open_lot_count"],
        message: "open_lot_count must partition by known and unknown basis",
      });
    }
    if (
      value.disposition_count !==
      value.complete_disposition_count + value.incomplete_disposition_count
    ) {
      context.addIssue({
        code: "custom",
        path: ["disposition_count"],
        message: "disposition_count must partition by completeness",
      });
    }
  });

export const calculationCompletenessSchema = z
  .strictObject({
    complete: z.boolean(),
    statement_ready: z.boolean(),
    gap_count: nonNegativeIntegerSchema,
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

export const costLotSchema = z
  .strictObject({
    lot_ref: boundedAccountingStringSchema(256),
    account_ref: accountingAccountRefSchema,
    asset: serializedAssetRefSchema,
    quantity: positiveDerivedAccountingDecimalSchema,
    cost_basis_usd: nonNegativeDerivedAccountingDecimalSchema.nullable(),
    unit_cost_usd: nonNegativeDerivedAccountingDecimalSchema.nullable(),
    acquired_at: unixSecondsSchema.nullable(),
    acquisition_sequence: unixSecondsSchema.nullable(),
    acquisition_leg_index: nonNegativeIntegerSchema,
    basis_source: boundedAccountingStringSchema(128),
    basis_override_ref: nullableRef(128),
    basis_last_verified: accountingDateSchema.nullable(),
    basis_evidence_source: nullableRef(128),
    acquisition_fee_usd: nonNegativeDerivedAccountingDecimalSchema,
    acquisition_event_id: nullableRef(128),
    acquisition_tx_ref: nullableRef(128),
    origin_lot_ref: nullableRef(256),
    basis_price_source: nullableRef(128),
    basis_price_as_of: unixSecondsSchema.nullable(),
    market_value_usd: nonNegativeDerivedAccountingDecimalSchema.nullable(),
    unrealized_pnl_usd: signedDerivedAccountingDecimalSchema.nullable(),
    market_price_source: nullableRef(128),
    market_price_as_of: unixSecondsSchema.nullable(),
  })
  .superRefine((value, context) => {
    if ((value.basis_price_source === null) !== (value.basis_price_as_of === null)) {
      context.addIssue({ code: "custom", message: "basis price provenance must be paired" });
    }
    if ((value.market_price_source === null) !== (value.market_price_as_of === null)) {
      context.addIssue({ code: "custom", message: "market price provenance must be paired" });
    }
    if (value.market_value_usd === null && value.market_price_source !== null) {
      context.addIssue({ code: "custom", message: "market price provenance requires market value" });
    }
    const canCalculateUnrealized = value.market_value_usd !== null && value.cost_basis_usd !== null;
    if (canCalculateUnrealized !== (value.unrealized_pnl_usd !== null)) {
      context.addIssue({
        code: "custom",
        path: ["unrealized_pnl_usd"],
        message: "unrealized PnL nullability must match market value and basis",
      });
    } else if (
      canCalculateUnrealized &&
      !accountingDecimalSubtractEquals(
        value.market_value_usd!,
        value.cost_basis_usd!,
        value.unrealized_pnl_usd!,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["unrealized_pnl_usd"],
        message: "unrealized_pnl_usd must equal market value minus cost basis",
      });
    }
    if (
      value.cost_basis_usd !== null &&
      !accountingDecimalLessThanOrEqual(value.acquisition_fee_usd, value.cost_basis_usd)
    ) {
      context.addIssue({
        code: "custom",
        path: ["acquisition_fee_usd"],
        message: "acquisition fee basis cannot exceed remaining cost basis",
      });
    }
  });

const disposalMissingFieldSchema = z.enum([
  "matching_lot",
  "proceeds_usd",
  "cost_basis_usd",
  "acquired_at",
  "basis_provenance",
  "proceeds_price_provenance",
]);

export const disposalRecordSchema = z
  .strictObject({
    disposition_ref: boundedAccountingStringSchema(256),
    disposition_type: z.enum(["principal", "fee_asset"]),
    account_ref: accountingAccountRefSchema,
    asset: serializedAssetRefSchema,
    quantity: positiveDerivedAccountingDecimalSchema,
    gross_proceeds_usd: nonNegativeDerivedAccountingDecimalSchema.nullable(),
    fee_adjustment_usd: nonNegativeDerivedAccountingDecimalSchema,
    proceeds_usd: nonNegativeDerivedAccountingDecimalSchema.nullable(),
    cost_basis_usd: nonNegativeDerivedAccountingDecimalSchema.nullable(),
    realized_gain_usd: signedDerivedAccountingDecimalSchema.nullable(),
    lot_ref: nullableRef(256),
    acquisition_event_id: nullableRef(128),
    acquisition_tx_ref: nullableRef(128),
    origin_lot_ref: nullableRef(256),
    disposal_event_id: boundedAccountingStringSchema(128),
    disposal_tx_ref: nullableRef(128),
    basis_source: nullableRef(128),
    basis_override_ref: nullableRef(128),
    basis_last_verified: accountingDateSchema.nullable(),
    basis_evidence_source: nullableRef(128),
    basis_fee_adjustment_usd: nonNegativeDerivedAccountingDecimalSchema,
    basis_price_source: nullableRef(128),
    basis_price_as_of: unixSecondsSchema.nullable(),
    proceeds_price_source: nullableRef(128),
    proceeds_price_as_of: unixSecondsSchema.nullable(),
    fee_allocation: feeAllocationSchema.nullable(),
    fee_payment: feePaymentSchema.nullable(),
    acquired_at: unixSecondsSchema.nullable(),
    disposed_at: unixSecondsSchema,
    holding_days: nonNegativeIntegerSchema.nullable(),
    term: z.enum(["short", "long"]).nullable(),
    complete: z.boolean(),
    missing_fields: z.array(disposalMissingFieldSchema),
  })
  .superRefine((value, context) => {
    if (new Set(value.missing_fields).size !== value.missing_fields.length) {
      context.addIssue({ code: "custom", path: ["missing_fields"], message: "missing fields must be unique" });
    }
    if ((value.basis_price_source === null) !== (value.basis_price_as_of === null)) {
      context.addIssue({ code: "custom", message: "basis price provenance must be paired" });
    }
    if ((value.proceeds_price_source === null) !== (value.proceeds_price_as_of === null)) {
      context.addIssue({ code: "custom", message: "proceeds price provenance must be paired" });
    }
    if ((value.gross_proceeds_usd === null) !== (value.proceeds_usd === null)) {
      context.addIssue({
        code: "custom",
        path: ["proceeds_usd"],
        message: "gross and net proceeds must have matching nullability",
      });
    } else if (
      value.gross_proceeds_usd !== null &&
      !accountingDecimalSubtractEquals(
        value.gross_proceeds_usd,
        value.fee_adjustment_usd,
        value.proceeds_usd!,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["proceeds_usd"],
        message: "proceeds_usd must equal gross proceeds minus fee adjustment",
      });
    }

    const canCalculateGain = value.proceeds_usd !== null && value.cost_basis_usd !== null;
    if (canCalculateGain !== (value.realized_gain_usd !== null)) {
      context.addIssue({
        code: "custom",
        path: ["realized_gain_usd"],
        message: "realized gain nullability must match proceeds and basis",
      });
    } else if (
      canCalculateGain &&
      !accountingDecimalSubtractEquals(
        value.proceeds_usd!,
        value.cost_basis_usd!,
        value.realized_gain_usd!,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["realized_gain_usd"],
        message: "realized_gain_usd must equal proceeds minus cost basis",
      });
    }

    const hasHoldingPeriod = value.acquired_at !== null;
    if (
      hasHoldingPeriod !== (value.holding_days !== null && value.term !== null) ||
      (!hasHoldingPeriod && (value.holding_days !== null || value.term !== null))
    ) {
      context.addIssue({ code: "custom", message: "holding period fields must match acquired_at" });
    }
    if (value.acquired_at !== null && value.disposed_at < value.acquired_at) {
      context.addIssue({
        code: "custom",
        path: ["disposed_at"],
        message: "disposal cannot precede acquisition",
      });
    }

    const missing = new Set(value.missing_fields);
    if (value.complete !== (missing.size === 0)) {
      context.addIssue({
        code: "custom",
        path: ["complete"],
        message: "complete must match missing_fields",
      });
    }
    if (missing.has("matching_lot") !== (value.lot_ref === null)) {
      context.addIssue({
        code: "custom",
        path: ["lot_ref"],
        message: "matching-lot status is inconsistent",
      });
    }
    if (missing.has("cost_basis_usd") !== (value.cost_basis_usd === null)) {
      context.addIssue({
        code: "custom",
        path: ["cost_basis_usd"],
        message: "basis missing-field status is inconsistent",
      });
    }
    if (missing.has("acquired_at") !== (value.acquired_at === null)) {
      context.addIssue({
        code: "custom",
        path: ["acquired_at"],
        message: "acquisition-date missing-field status is inconsistent",
      });
    }
    if (value.lot_ref === null) {
      const shortfallFields = new Set(["matching_lot", "cost_basis_usd", "acquired_at"]);
      if ([...missing].some((field) => !shortfallFields.has(field))) {
        context.addIssue({
          code: "custom",
          path: ["missing_fields"],
          message: "unmatched-lot missing fields do not match the Nexus shortfall shape",
        });
      }
    } else {
      const lacksBasisProvenance =
        (value.basis_price_source === null || value.basis_price_as_of === null) &&
        (value.basis_evidence_source === null || value.basis_last_verified === null);
      if (missing.has("proceeds_usd") !== (value.proceeds_usd === null)) {
        context.addIssue({
          code: "custom",
          path: ["proceeds_usd"],
          message: "proceeds missing-field status is inconsistent",
        });
      }
      if (missing.has("basis_provenance") !== lacksBasisProvenance) {
        context.addIssue({
          code: "custom",
          path: ["basis_provenance"],
          message: "basis-provenance missing-field status is inconsistent",
        });
      }
      if (
        missing.has("proceeds_price_provenance") !==
        (value.proceeds_price_source === null || value.proceeds_price_as_of === null)
      ) {
        context.addIssue({
          code: "custom",
          path: ["proceeds_price_provenance"],
          message: "proceeds-provenance missing-field status is inconsistent",
        });
      }
    }
    if (
      value.complete &&
      (value.realized_gain_usd === null ||
        value.proceeds_price_source === null ||
        (value.basis_price_source === null && value.basis_evidence_source === null))
    ) {
      context.addIssue({
        code: "custom",
        path: ["complete"],
        message: "complete disposition lacks critical values or provenance",
      });
    }
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

interface CalculationResultLike {
  methodology: { review_status: "pending_governance_review" | "approved" };
  replay: { mode: "all_events" | "full_history" | "opening_state" };
  coverage: z.infer<typeof coverageMetadataSchema>;
  completeness: z.infer<typeof calculationCompletenessSchema>;
}

function addCalculationPartitionIssues(
  value: CalculationResultLike,
  disposals: z.infer<typeof disposalRecordSchema>[],
  context: z.RefinementCtx,
): void {
  const completeDisposals = disposals.filter((disposal) => disposal.complete).length;
  if (
    value.coverage.disposition_count !== disposals.length ||
    value.coverage.complete_disposition_count !== completeDisposals ||
    value.coverage.incomplete_disposition_count !== disposals.length - completeDisposals
  ) {
    context.addIssue({
      code: "custom",
      path: ["coverage", "disposition_count"],
      message: "coverage disposition counts must match serialized dispositions",
    });
  }

  const expectedStatementFlag =
    value.completeness.complete &&
    value.replay.mode !== "all_events" &&
    value.methodology.review_status === "approved";
  if (value.completeness.statement_ready !== expectedStatementFlag) {
    context.addIssue({
      code: "custom",
      path: ["completeness", "statement_ready"],
      message: "engine statement_ready must match calculation, replay, and methodology state",
    });
  }
  if (
    value.completeness.complete &&
    (completeDisposals !== disposals.length ||
      value.coverage.incomplete_disposition_count !== 0 ||
      value.coverage.unresolved_event_count !== 0 ||
      value.coverage.unresolved_transfer_count !== 0 ||
      value.coverage.unresolved_fee_count !== 0)
  ) {
    context.addIssue({
      code: "custom",
      path: ["completeness", "complete"],
      message: "complete calculation cannot contain incomplete or unresolved coverage",
    });
  }
}

export const costBasisTotalsSchema = z.strictObject({
  open_cost_basis_usd: nonNegativeDerivedAccountingDecimalSchema.nullable(),
  open_market_value_usd: nonNegativeDerivedAccountingDecimalSchema.nullable(),
  open_unrealized_pnl_usd: signedDerivedAccountingDecimalSchema.nullable(),
  realized_gain_usd: signedDerivedAccountingDecimalSchema.nullable(),
});

function addNullableAggregateIssue(
  values: readonly (string | null)[],
  total: string | null,
  path: string,
  context: z.RefinementCtx,
  requireWhenKnown: boolean,
): void {
  const allKnown = values.every((value): value is string => value !== null);
  if ((!allKnown && total !== null) || (requireWhenKnown && allKnown && total === null)) {
    context.addIssue({
      code: "custom",
      path: ["totals", path],
      message: `${path} nullability is inconsistent`,
    });
  } else if (allKnown && total !== null && !accountingDecimalSumEquals(values, total)) {
    context.addIssue({
      code: "custom",
      path: ["totals", path],
      message: `${path} does not equal its components`,
    });
  }
}

export const computeCostBasisResponseSchema = z
  .strictObject({
    ...sharedResultShape,
    open_lots: z.array(costLotSchema),
    disposals: z.array(disposalRecordSchema),
    totals: costBasisTotalsSchema,
    warnings: z.array(boundedAccountingStringSchema(2_048)),
  })
  .superRefine((value, context) => {
    addCalculationPartitionIssues(value, value.disposals, context);
    const serializedAccounts = new Set([
      ...value.open_lots.map((lot) => lot.account_ref),
      ...value.disposals.map((disposal) => disposal.account_ref),
    ]);
    const serializedAssets = new Set([
      ...value.open_lots.map((lot) => lot.asset.asset_id),
      ...value.disposals.map((disposal) => disposal.asset.asset_id),
    ]);
    if (value.coverage.account_count < serializedAccounts.size) {
      context.addIssue({
        code: "custom",
        path: ["coverage", "account_count"],
        message: "account_count cannot be below serialized account coverage",
      });
    }
    if (value.coverage.asset_count < serializedAssets.size) {
      context.addIssue({
        code: "custom",
        path: ["coverage", "asset_count"],
        message: "asset_count cannot be below serialized asset coverage",
      });
    }
    const knownOpenLots = value.open_lots.filter((lot) => lot.cost_basis_usd !== null).length;
    if (
      value.coverage.open_lot_count !== value.open_lots.length ||
      value.coverage.known_basis_open_lot_count !== knownOpenLots ||
      value.coverage.unknown_basis_open_lot_count !== value.open_lots.length - knownOpenLots
    ) {
      context.addIssue({
        code: "custom",
        path: ["coverage", "open_lot_count"],
        message: "coverage open-lot counts must match serialized lots",
      });
    }
    if (value.completeness.complete && knownOpenLots !== value.open_lots.length) {
      context.addIssue({
        code: "custom",
        path: ["completeness", "complete"],
        message: "complete calculation cannot contain unknown open-lot basis",
      });
    }
    addNullableAggregateIssue(
      value.open_lots.map((lot) => lot.cost_basis_usd),
      value.totals.open_cost_basis_usd,
      "open_cost_basis_usd",
      context,
      false,
    );
    addNullableAggregateIssue(
      value.open_lots.map((lot) => lot.market_value_usd),
      value.totals.open_market_value_usd,
      "open_market_value_usd",
      context,
      false,
    );
    addNullableAggregateIssue(
      value.open_lots.map((lot) => lot.unrealized_pnl_usd),
      value.totals.open_unrealized_pnl_usd,
      "open_unrealized_pnl_usd",
      context,
      false,
    );
    addNullableAggregateIssue(
      value.disposals.map((disposal) => disposal.realized_gain_usd),
      value.totals.realized_gain_usd,
      "realized_gain_usd",
      context,
      true,
    );
  });

const pnlBucketShape = {
  realized_gain_usd: signedDerivedAccountingDecimalSchema,
  short_term_gain_usd: signedDerivedAccountingDecimalSchema,
  long_term_gain_usd: signedDerivedAccountingDecimalSchema,
  proceeds_usd: nonNegativeDerivedAccountingDecimalSchema,
  cost_basis_usd: nonNegativeDerivedAccountingDecimalSchema,
  disposal_count: nonNegativeIntegerSchema,
  incomplete_count: nonNegativeIntegerSchema,
  calculation_gap_count: nonNegativeIntegerSchema,
  complete: z.boolean(),
} as const;

export const pnlBucketSchema = z.strictObject(pnlBucketShape);
export const pnlYearSchema = z.strictObject({
  year: z.number().int().min(1970),
  ...pnlBucketShape,
});

interface PnlBucketLike {
  realized_gain_usd: string;
  short_term_gain_usd: string;
  long_term_gain_usd: string;
  proceeds_usd: string;
  cost_basis_usd: string;
  disposal_count: number;
  incomplete_count: number;
  calculation_gap_count: number;
  complete: boolean;
}

function addPnlBucketIssues(
  bucket: PnlBucketLike,
  disposals: z.infer<typeof disposalRecordSchema>[],
  completeness: z.infer<typeof calculationCompletenessSchema>,
  path: readonly (string | number)[],
  context: z.RefinementCtx,
): void {
  const incompleteCount = disposals.filter((disposal) => !disposal.complete).length;
  const included = disposals.filter(
    (disposal) =>
      disposal.realized_gain_usd !== null &&
      disposal.proceeds_usd !== null &&
      disposal.cost_basis_usd !== null,
  );
  const checks: Array<[keyof PnlBucketLike, string[]]> = [
    ["realized_gain_usd", included.map((item) => item.realized_gain_usd!)],
    [
      "short_term_gain_usd",
      included
        .filter((item) => item.term === "short")
        .map((item) => item.realized_gain_usd!),
    ],
    [
      "long_term_gain_usd",
      included
        .filter((item) => item.term === "long")
        .map((item) => item.realized_gain_usd!),
    ],
    ["proceeds_usd", included.map((item) => item.proceeds_usd!)],
    ["cost_basis_usd", included.map((item) => item.cost_basis_usd!)],
  ];
  for (const [field, values] of checks) {
    const actual = bucket[field];
    if (typeof actual !== "string" || !accountingDecimalSumEquals(values, actual)) {
      context.addIssue({
        code: "custom",
        path: [...path, field],
        message: `${String(field)} does not match dispositions`,
      });
    }
  }
  if (bucket.disposal_count !== disposals.length || bucket.incomplete_count !== incompleteCount) {
    context.addIssue({
      code: "custom",
      path: [...path, "disposal_count"],
      message: "PnL bucket counts do not match dispositions",
    });
  }
  if (bucket.calculation_gap_count !== completeness.gap_count) {
    context.addIssue({
      code: "custom",
      path: [...path, "calculation_gap_count"],
      message: "PnL bucket gap count does not match calculation",
    });
  }
  if (bucket.complete !== (incompleteCount === 0 && completeness.complete)) {
    context.addIssue({
      code: "custom",
      path: [...path, "complete"],
      message: "PnL bucket completeness is inconsistent",
    });
  }
}

function dispositionUtcYear(timestamp: number): number | null {
  const date = new Date(timestamp * 1_000);
  return Number.isNaN(date.getTime()) ? null : date.getUTCFullYear();
}

export const onchainPnlReportResponseSchema = z
  .strictObject({
    ...sharedResultShape,
    summary: pnlBucketSchema,
    by_year: z.array(pnlYearSchema),
    dispositions: z.array(disposalRecordSchema),
    warnings: z.array(boundedAccountingStringSchema(2_048)),
  })
  .superRefine((value, context) => {
    addCalculationPartitionIssues(value, value.dispositions, context);
    const serializedAccounts = new Set(value.dispositions.map((item) => item.account_ref));
    const serializedAssets = new Set(value.dispositions.map((item) => item.asset.asset_id));
    if (value.coverage.account_count < serializedAccounts.size) {
      context.addIssue({
        code: "custom",
        path: ["coverage", "account_count"],
        message: "account_count cannot be below serialized account coverage",
      });
    }
    if (value.coverage.asset_count < serializedAssets.size) {
      context.addIssue({
        code: "custom",
        path: ["coverage", "asset_count"],
        message: "asset_count cannot be below serialized asset coverage",
      });
    }
    addPnlBucketIssues(value.summary, value.dispositions, value.completeness, ["summary"], context);

    const byYear = new Map<number, z.infer<typeof disposalRecordSchema>[]>();
    for (const disposal of value.dispositions) {
      const year = dispositionUtcYear(disposal.disposed_at);
      if (year === null) {
        context.addIssue({
          code: "custom",
          path: ["dispositions"],
          message: "disposition timestamp cannot map to a UTC year",
        });
        continue;
      }
      const items = byYear.get(year) ?? [];
      items.push(disposal);
      byYear.set(year, items);
    }
    const expectedYears = [...byYear.keys()].sort((left, right) => left - right);
    const actualYears = value.by_year.map((bucket) => bucket.year);
    if (
      actualYears.length !== expectedYears.length ||
      actualYears.some((year, index) => year !== expectedYears[index])
    ) {
      context.addIssue({
        code: "custom",
        path: ["by_year"],
        message: "by_year must be a complete sorted partition of dispositions",
      });
    }
    value.by_year.forEach((bucket, index) => {
      addPnlBucketIssues(
        bucket,
        byYear.get(bucket.year) ?? [],
        value.completeness,
        ["by_year", index],
        context,
      );
    });
  });

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
