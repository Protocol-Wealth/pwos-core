// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { z } from "zod";

import {
  ACCOUNTING_EVENT_KINDS,
  ACCOUNTING_FEE_ALLOCATIONS,
  ACCOUNTING_FEE_PAYMENTS,
  ACCOUNTING_TAX_TREATMENTS,
  ACCOUNTING_TRANSFER_TREATMENTS,
} from "./constants.js";
import {
  accountingDecimalProductEquals,
  nonNegativeAccountingDecimalSchema,
  nonNegativeAccountingTotalSchema,
  positiveAccountingDecimalSchema,
} from "./decimal.js";

const EVM_ADDRESS = /0x[0-9a-f]{40}/i;
const BITCOIN_BECH32 = /(?:^|[^0-9a-z])(?:bc1|tb1)[02-9ac-hj-np-z]{20,}(?:$|[^0-9a-z])/i;
const BASE58_ADDRESS = /(?:^|[^1-9A-HJ-NP-Za-km-z])[1-9A-HJ-NP-Za-km-z]{32,44}(?:$|[^1-9A-HJ-NP-Za-km-z])/;
const BITCOIN_LEGACY = /(?:^|[^1-9A-HJ-NP-Za-km-z])[123mn][1-9A-HJ-NP-Za-km-z]{25,34}(?:$|[^1-9A-HJ-NP-Za-km-z])/;

const trimmedString = (maxLength: number): z.ZodString =>
  z.string().max(maxLength).trim().min(1).max(maxLength);

const unixSecondsSchema = z.number().int().nonnegative();

function isOpaqueAccountRef(value: string): boolean {
  return !(
    EVM_ADDRESS.test(value) ||
    BITCOIN_BECH32.test(value) ||
    BITCOIN_LEGACY.test(value) ||
    BASE58_ADDRESS.test(value)
  );
}

/** Opaque account reference; supported-chain raw wallet shapes fail closed. */
export const accountingAccountRefSchema = trimmedString(128).refine(
  isOpaqueAccountRef,
  "account_ref must be opaque; raw wallet addresses are not accepted",
);

export const eventKindSchema = z.enum(ACCOUNTING_EVENT_KINDS);
export const taxTreatmentSchema = z.enum(ACCOUNTING_TAX_TREATMENTS);
export const transferTreatmentSchema = z.enum(ACCOUNTING_TRANSFER_TREATMENTS);
export const feeAllocationSchema = z.enum(ACCOUNTING_FEE_ALLOCATIONS);
export const feePaymentSchema = z.enum(ACCOUNTING_FEE_PAYMENTS);

/** Public-safe asset identity. Account/wallet ownership does not belong here. */
export const assetRefSchema = z.strictObject({
  asset_id: trimmedString(128),
  symbol: z.string().max(32).nullish(),
  chain: z.string().max(32).trim().toLowerCase().min(1).max(32).nullish(),
  decimals: z.number().int().min(0).max(36).nullish(),
});

function addPriceProvenanceIssues(
  value: {
    amount: string;
    direction: "in" | "out";
    role: "principal" | "fee";
    unit_price_usd?: string | null;
    usd_value?: string | null;
    price_source?: string | null;
    price_as_of?: number | null;
  },
  context: z.RefinementCtx,
  label: "leg" | "movement",
): void {
  if ((value.price_source == null) !== (value.price_as_of == null)) {
    context.addIssue({
      code: "custom",
      message: "price_source and price_as_of must be supplied together",
    });
  }
  if (
    value.unit_price_usd != null &&
    value.usd_value != null &&
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
      message: `fee ${label}s must have direction='out'`,
    });
  }
}

export const ledgerLegSchema = z
  .strictObject({
    asset: assetRefSchema,
    direction: z.enum(["in", "out"]),
    amount: positiveAccountingDecimalSchema,
    unit_price_usd: nonNegativeAccountingDecimalSchema.nullish(),
    usd_value: nonNegativeAccountingTotalSchema.nullish(),
    role: z.enum(["principal", "fee"]).default("principal"),
    price_source: trimmedString(128).nullish(),
    price_as_of: unixSecondsSchema.nullish(),
  })
  .superRefine((value, context) => addPriceProvenanceIssues(value, context, "leg"));

const TRANSFER_KINDS = new Set(["transfer_in", "transfer_out"]);
const TAX_TREATMENT_KINDS = new Set([
  "deposit",
  "withdraw",
  "lp_add",
  "lp_remove",
  "stake",
  "unstake",
]);

export const ledgerEventSchema = z
  .strictObject({
    event_id: trimmedString(128),
    account_ref: accountingAccountRefSchema,
    kind: eventKindSchema,
    timestamp: unixSecondsSchema,
    sequence: unixSecondsSchema.nullish(),
    tx_ref: trimmedString(128).nullish(),
    legs: z.array(ledgerLegSchema).min(1),
    fee_usd: nonNegativeAccountingTotalSchema.nullish(),
    fee_allocation: feeAllocationSchema.nullish(),
    fee_payment: feePaymentSchema.nullish(),
    transfer_ref: trimmedString(128).nullish(),
    transfer_treatment: transferTreatmentSchema.nullish(),
    tax_treatment: taxTreatmentSchema.nullish(),
  })
  .superRefine((value, context) => {
    if (
      !TRANSFER_KINDS.has(value.kind) &&
      (value.transfer_ref != null || value.transfer_treatment != null)
    ) {
      context.addIssue({
        code: "custom",
        message: "transfer metadata is only valid for transfer events",
      });
    }
    if (value.tax_treatment != null && !TAX_TREATMENT_KINDS.has(value.kind)) {
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

export const eventLedgerSchema = z.strictObject({
  events: z.array(ledgerEventSchema).default([]),
});

export const movementInputSchema = z
  .strictObject({
    asset: assetRefSchema,
    direction: z.enum(["in", "out"]),
    amount: positiveAccountingDecimalSchema,
    counterparty: z.string().max(256).nullish(),
    unit_price_usd: nonNegativeAccountingDecimalSchema.nullish(),
    usd_value: nonNegativeAccountingTotalSchema.nullish(),
    role: z.enum(["principal", "fee"]).default("principal"),
    price_source: trimmedString(128).nullish(),
    price_as_of: unixSecondsSchema.nullish(),
  })
  .superRefine((value, context) => addPriceProvenanceIssues(value, context, "movement"));

export const rawTransactionInputSchema = z
  .strictObject({
    account_ref: accountingAccountRefSchema,
    chain: z.string().max(32).trim().toLowerCase().min(1).max(32),
    timestamp: unixSecondsSchema,
    sequence: unixSecondsSchema.nullish(),
    movements: z.array(movementInputSchema).min(1),
    tx_ref: trimmedString(128).nullish(),
    protocol_hint: z.string().max(64).nullish(),
    method: z.string().max(64).nullish(),
    fee_usd: nonNegativeAccountingTotalSchema.nullish(),
    fee_allocation: feeAllocationSchema.nullish(),
    fee_payment: feePaymentSchema.nullish(),
    transfer_ref: trimmedString(128).nullish(),
    transfer_treatment: transferTreatmentSchema.nullish(),
    tax_treatment: taxTreatmentSchema.nullish(),
  })
  .superRefine((value, context) => {
    if (
      value.fee_payment === "fiat" &&
      value.movements.some((movement) => movement.role === "fee")
    ) {
      context.addIssue({
        code: "custom",
        path: ["fee_payment"],
        message: "fiat fee_payment cannot include fee movements",
      });
    }
    value.movements.forEach((movement, index) => {
      if (movement.asset.chain != null && movement.asset.chain !== value.chain) {
        context.addIssue({
          code: "custom",
          path: ["movements", index, "asset", "chain"],
          message: "movement asset chain must match transaction chain",
        });
      }
    });
  });

export type AssetRef = z.infer<typeof assetRefSchema>;
export type LedgerLeg = z.infer<typeof ledgerLegSchema>;
export type LedgerEvent = z.infer<typeof ledgerEventSchema>;
export type EventLedger = z.infer<typeof eventLedgerSchema>;
export type MovementInput = z.infer<typeof movementInputSchema>;
export type RawTransactionInput = z.infer<typeof rawTransactionInputSchema>;
