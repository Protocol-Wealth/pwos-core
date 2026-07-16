// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { z } from "zod";

import { ACCOUNTING_METHOD_VERSION, ACCOUNTING_REPLAY_VERSION } from "./constants.js";
import {
  accountingAccountRefSchema,
  assetRefSchema,
  ledgerEventSchema,
  rawTransactionInputSchema,
} from "./common.js";
import {
  accountingDecimalProductFitsDerivedEnvelope,
  accountingDecimalProductsLessThanOrEqual,
  nonNegativeAccountingDecimalSchema,
  nonNegativeAccountingTotalSchema,
  nonNegativeDerivedAccountingDecimalSchema,
  positiveAccountingDecimalSchema,
} from "./decimal.js";

const trimmedString = (maxLength: number): z.ZodString =>
  z.string().max(maxLength).trim().min(1).max(maxLength);
const unixSecondsSchema = z.number().int().nonnegative();

function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export const accountingDateSchema = z.string().refine(isIsoDate, "must be an ISO calendar date");

export const priceQueryInputSchema = z.strictObject({
  coin: z.string().min(1).max(256),
  timestamp: unixSecondsSchema,
});

export const priceOverrideInputSchema = z.strictObject({
  coin: z.string().min(1).max(256),
  timestamp: unixSecondsSchema,
  price_usd: nonNegativeAccountingDecimalSchema,
});

export const priceHistoryRequestSchema = z.strictObject({
  queries: z.array(priceQueryInputSchema).min(1).max(500),
  overrides: z.array(priceOverrideInputSchema).max(500).default([]),
});

export const decodeOnchainEventsRequestSchema = z.strictObject({
  transactions: z.array(rawTransactionInputSchema).min(1).max(2_000),
});

export const basisOverrideInputSchema = z.strictObject({
  event_id: trimmedString(128),
  override_ref: trimmedString(128).nullish(),
  cost_basis_usd: nonNegativeAccountingTotalSchema,
  acquired_at: unixSecondsSchema.nullish(),
  acquisition_sequence: unixSecondsSchema.nullish(),
  acquisition_leg_index: unixSecondsSchema.default(0),
  acquisition_event_id: trimmedString(128).nullish(),
  acquisition_tx_ref: trimmedString(128).nullish(),
  source: trimmedString(128).nullish(),
  last_verified: accountingDateSchema.nullish(),
  single_lot_assertion: z.literal(true).nullish(),
  origin_lot_ref: trimmedString(128).nullish(),
});

export const asOfPriceInputSchema = z
  .strictObject({
    asset_id: trimmedString(128),
    unit_price_usd: nonNegativeAccountingDecimalSchema,
    source: trimmedString(128).nullish(),
    as_of: unixSecondsSchema.nullish(),
  })
  .superRefine((value, context) => {
    if ((value.source == null) !== (value.as_of == null)) {
      context.addIssue({
        code: "custom",
        message: "source and as_of must be supplied together",
      });
    }
  });

export const openingLotInputSchema = z
  .strictObject({
    lot_ref: trimmedString(128),
    account_ref: accountingAccountRefSchema,
    asset: assetRefSchema,
    quantity: positiveAccountingDecimalSchema,
    cost_basis_usd: nonNegativeDerivedAccountingDecimalSchema.nullish(),
    unit_cost_usd: nonNegativeDerivedAccountingDecimalSchema.nullish(),
    acquired_at: unixSecondsSchema.nullish(),
    acquisition_sequence: unixSecondsSchema.nullish(),
    acquisition_leg_index: unixSecondsSchema.default(0),
    basis_source: trimmedString(128),
    basis_override_ref: trimmedString(128).nullish(),
    basis_last_verified: accountingDateSchema.nullish(),
    acquisition_fee_usd: nonNegativeDerivedAccountingDecimalSchema.nullish(),
    unit_fee_basis_usd: nonNegativeDerivedAccountingDecimalSchema.nullish(),
    acquisition_event_id: trimmedString(128).nullish(),
    acquisition_tx_ref: trimmedString(128).nullish(),
    origin_lot_ref: trimmedString(128).nullish(),
    basis_evidence_source: trimmedString(128).nullish(),
    basis_price_source: trimmedString(128).nullish(),
    basis_price_as_of: unixSecondsSchema.nullish(),
  })
  .superRefine((value, context) => {
    if ((value.basis_price_source == null) !== (value.basis_price_as_of == null)) {
      context.addIssue({
        code: "custom",
        message: "basis_price_source and basis_price_as_of must be supplied together",
      });
    }
    const costBasis =
      value.cost_basis_usd != null
        ? [value.cost_basis_usd]
        : value.unit_cost_usd != null
          ? [value.unit_cost_usd, value.quantity]
          : null;
    const feeBasis =
      value.acquisition_fee_usd != null
        ? [value.acquisition_fee_usd]
        : value.unit_fee_basis_usd != null
          ? [value.unit_fee_basis_usd, value.quantity]
          : ["0"];
    if (costBasis !== null && !accountingDecimalProductsLessThanOrEqual(feeBasis, costBasis)) {
      context.addIssue({
        code: "custom",
        path: ["acquisition_fee_usd"],
        message: "acquisition fee basis cannot exceed effective cost basis",
      });
    }
    if (
      value.unit_cost_usd != null &&
      value.unit_fee_basis_usd != null &&
      !accountingDecimalProductsLessThanOrEqual(
        [value.unit_fee_basis_usd],
        [value.unit_cost_usd],
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["unit_fee_basis_usd"],
        message: "unit fee basis cannot exceed unit cost basis",
      });
    }
    if (costBasis !== null && !accountingDecimalProductFitsDerivedEnvelope(costBasis)) {
      context.addIssue({
        code: "custom",
        path: ["unit_cost_usd"],
        message: "effective cost basis exceeds the derived accounting decimal envelope",
      });
    }
    if (!accountingDecimalProductFitsDerivedEnvelope(feeBasis)) {
      context.addIssue({
        code: "custom",
        path: ["unit_fee_basis_usd"],
        message: "effective fee basis exceeds the derived accounting decimal envelope",
      });
    }
  });

export const openingStateInputSchema = z.strictObject({
  schema_version: z.literal(ACCOUNTING_METHOD_VERSION),
  basis_method: z.literal("fifo"),
  basis_method_version: z.literal(ACCOUNTING_METHOD_VERSION),
  snapshot_complete: z.literal(true),
  state_ref: trimmedString(128),
  as_of: unixSecondsSchema,
  source: trimmedString(128),
  last_verified: accountingDateSchema,
  lots: z.array(openingLotInputSchema).max(5_000).default([]),
});

export const reportWindowInputSchema = z
  .strictObject({
    replay_version: z.literal(ACCOUNTING_REPLAY_VERSION).default(ACCOUNTING_REPLAY_VERSION),
    start_at: unixSecondsSchema,
    end_at: unixSecondsSchema,
    full_history: z.boolean().default(false),
    opening_state: openingStateInputSchema.nullish(),
  })
  .superRefine((value, context) => {
    if (value.end_at <= value.start_at) {
      context.addIssue({
        code: "custom",
        path: ["end_at"],
        message: "report window end_at must be greater than start_at",
      });
    }
    if (value.full_history === (value.opening_state != null)) {
      context.addIssue({
        code: "custom",
        message: "choose exactly one of full_history or opening_state",
      });
    }
    if (value.opening_state != null && value.opening_state.as_of !== value.start_at - 1) {
      context.addIssue({
        code: "custom",
        path: ["opening_state", "as_of"],
        message: "opening_state.as_of must immediately precede report start_at",
      });
    }
  });

const costBasisRequestShape = {
  events: z.array(ledgerEventSchema).max(5_000),
  overrides: z.array(basisOverrideInputSchema).max(1_000).default([]),
  report_window: reportWindowInputSchema.nullish(),
  method: z.literal("fifo").default("fifo"),
} as const;

function addQuietPeriodIssue(
  value: { events: readonly unknown[]; report_window?: unknown },
  context: z.RefinementCtx,
): void {
  if (value.events.length === 0 && value.report_window == null) {
    context.addIssue({
      code: "custom",
      path: ["events"],
      message: "events must not be empty without a report_window",
    });
  }
}

export const computeCostBasisRequestSchema = z
  .strictObject({
    ...costBasisRequestShape,
    as_of_prices: z.array(asOfPriceInputSchema).max(2_000).default([]),
  })
  .superRefine(addQuietPeriodIssue);

export const onchainPnlReportRequestSchema = z
  .strictObject(costBasisRequestShape)
  .superRefine(addQuietPeriodIssue);

export type PriceQueryInput = z.infer<typeof priceQueryInputSchema>;
export type PriceOverrideInput = z.infer<typeof priceOverrideInputSchema>;
export type PriceHistoryRequest = z.infer<typeof priceHistoryRequestSchema>;
export type DecodeOnchainEventsRequest = z.infer<typeof decodeOnchainEventsRequestSchema>;
export type BasisOverrideInput = z.infer<typeof basisOverrideInputSchema>;
export type AsOfPriceInput = z.infer<typeof asOfPriceInputSchema>;
export type OpeningLotInput = z.infer<typeof openingLotInputSchema>;
export type OpeningStateInput = z.infer<typeof openingStateInputSchema>;
export type ReportWindowInput = z.infer<typeof reportWindowInputSchema>;
export type ComputeCostBasisRequest = z.infer<typeof computeCostBasisRequestSchema>;
export type OnchainPnlReportRequest = z.infer<typeof onchainPnlReportRequestSchema>;
