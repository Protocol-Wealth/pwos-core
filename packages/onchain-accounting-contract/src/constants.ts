// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/** Deployed nexus-core accounting gateway contract version. */
export const ACCOUNTING_CONTRACT_VERSION = "0.2.0" as const;

/** FIFO calculation-method version carried by contract 0.2.0 results. */
export const ACCOUNTING_METHOD_VERSION = "2.0.0" as const;

/** Report-window replay protocol version carried by contract 0.2.0. */
export const ACCOUNTING_REPLAY_VERSION = "1.0.0" as const;

/** Calculation tools exposed by the accounting gateway. */
export const ACCOUNTING_TOOL_IDS = [
  "price_history",
  "decode_onchain_events",
  "compute_cost_basis",
  "onchain_pnl_report",
] as const;

/** All REST gateway handlers, including contract introspection. */
export const ACCOUNTING_GATEWAY_TOOL_IDS = ["describe", ...ACCOUNTING_TOOL_IDS] as const;

/** Normalized event kinds in the v0.2.0 event ledger. */
export const ACCOUNTING_EVENT_KINDS = [
  "acquire",
  "dispose",
  "swap",
  "transfer_in",
  "transfer_out",
  "deposit",
  "withdraw",
  "lp_add",
  "lp_remove",
  "stake",
  "unstake",
  "claim",
  "fee",
  "other",
] as const;

/** Caller-reviewed treatment for ambiguous DeFi events. */
export const ACCOUNTING_TAX_TREATMENTS = ["taxable_exchange", "unknown"] as const;

/** Caller-reviewed ownership treatment for transfers. */
export const ACCOUNTING_TRANSFER_TREATMENTS = [
  "same_owner",
  "external",
  "unknown",
] as const;

/** Where a transaction fee is applied exactly once. */
export const ACCOUNTING_FEE_ALLOCATIONS = [
  "acquisition_basis",
  "disposition_proceeds",
  "none",
  "unknown",
] as const;

/** How the transaction fee was paid. */
export const ACCOUNTING_FEE_PAYMENTS = ["fiat", "digital_asset", "unknown"] as const;

export type AccountingToolId = (typeof ACCOUNTING_TOOL_IDS)[number];
export type AccountingGatewayToolId = (typeof ACCOUNTING_GATEWAY_TOOL_IDS)[number];
export type AccountingEventKind = (typeof ACCOUNTING_EVENT_KINDS)[number];
export type AccountingTaxTreatment = (typeof ACCOUNTING_TAX_TREATMENTS)[number];
export type AccountingTransferTreatment = (typeof ACCOUNTING_TRANSFER_TREATMENTS)[number];
export type AccountingFeeAllocation = (typeof ACCOUNTING_FEE_ALLOCATIONS)[number];
export type AccountingFeePayment = (typeof ACCOUNTING_FEE_PAYMENTS)[number];
