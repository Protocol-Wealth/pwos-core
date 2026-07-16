// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { z } from "zod";

import {
  accountingAccountRefSchema,
  eventKindSchema,
  feeAllocationSchema,
  feePaymentSchema,
  taxTreatmentSchema,
  transferTreatmentSchema,
} from "./common.js";
import {
  accountingDecimalProductEquals,
  nonNegativeAccountingDecimalSchema,
  nonNegativeAccountingTotalSchema,
  positiveAccountingDecimalSchema,
} from "./decimal.js";

const unixSecondsSchema = z.number().int().nonnegative();

/** Exact `model_dump(mode="json")` asset shape: nullable fields are present. */
export const serializedAssetRefSchema = z.strictObject({
  asset_id: z.string().min(1).max(128),
  symbol: z.string().max(32).nullable(),
  chain: z.string().min(1).max(32).nullable(),
  decimals: z.number().int().min(0).max(36).nullable(),
});

export const serializedLedgerLegSchema = z
  .strictObject({
    asset: serializedAssetRefSchema,
    direction: z.enum(["in", "out"]),
    amount: positiveAccountingDecimalSchema,
    unit_price_usd: nonNegativeAccountingDecimalSchema.nullable(),
    usd_value: nonNegativeAccountingTotalSchema.nullable(),
    role: z.enum(["principal", "fee"]),
    price_source: z.string().min(1).max(128).nullable(),
    price_as_of: unixSecondsSchema.nullable(),
  })
  .superRefine((value, context) => {
    if ((value.price_source === null) !== (value.price_as_of === null)) {
      context.addIssue({
        code: "custom",
        message: "price_source and price_as_of must be supplied together",
      });
    }
    if (
      value.unit_price_usd !== null &&
      value.usd_value !== null &&
      !accountingDecimalProductEquals(value.unit_price_usd, value.amount, value.usd_value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["usd_value"],
        message: "usd_value must equal unit_price_usd multiplied by amount",
      });
    }
    if (value.role === "fee" && value.direction !== "out") {
      context.addIssue({
        code: "custom",
        path: ["direction"],
        message: "fee legs must have direction='out'",
      });
    }
  });

export const serializedLedgerEventSchema = z
  .strictObject({
    event_id: z.string().min(1).max(128),
    account_ref: accountingAccountRefSchema,
    kind: eventKindSchema,
    timestamp: unixSecondsSchema,
    sequence: unixSecondsSchema.nullable(),
    tx_ref: z.string().min(1).max(128).nullable(),
    legs: z.array(serializedLedgerLegSchema).min(1),
    fee_usd: nonNegativeAccountingTotalSchema.nullable(),
    fee_allocation: feeAllocationSchema.nullable(),
    fee_payment: feePaymentSchema.nullable(),
    transfer_ref: z.string().min(1).max(128).nullable(),
    transfer_treatment: transferTreatmentSchema.nullable(),
    tax_treatment: taxTreatmentSchema.nullable(),
  })
  .superRefine((value, context) => {
    const isTransfer = value.kind === "transfer_in" || value.kind === "transfer_out";
    if (!isTransfer && (value.transfer_ref !== null || value.transfer_treatment !== null)) {
      context.addIssue({
        code: "custom",
        message: "transfer metadata is only valid for transfer events",
      });
    }
    const allowsTaxTreatment = [
      "deposit",
      "withdraw",
      "lp_add",
      "lp_remove",
      "stake",
      "unstake",
    ].includes(value.kind);
    if (value.tax_treatment !== null && !allowsTaxTreatment) {
      context.addIssue({
        code: "custom",
        path: ["tax_treatment"],
        message: "tax_treatment is only valid for ambiguous DeFi events",
      });
    }
    if (value.fee_payment === "fiat" && value.legs.some((leg) => leg.role === "fee")) {
      context.addIssue({
        code: "custom",
        path: ["fee_payment"],
        message: "fiat fee_payment cannot include fee legs",
      });
    }
  });

export type SerializedAssetRef = z.infer<typeof serializedAssetRefSchema>;
export type SerializedLedgerLeg = z.infer<typeof serializedLedgerLegSchema>;
export type SerializedLedgerEvent = z.infer<typeof serializedLedgerEventSchema>;
