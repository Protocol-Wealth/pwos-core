// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * @protocolwealthos/ledger — append-only double-entry ledger primitives.
 *
 * Architectural lineage: independently re-implemented inspired by
 * Beancount's data model (GPL-2; not source-derived). Specific
 * derivation: 5-root account hierarchy, polymorphic posting/transaction
 * with sum-to-zero invariant, balance assertions as data-integrity
 * checkpoints, append-only with reverse-only edits. License-clean
 * Apache 2.0 implementation.
 *
 * Core surface:
 *   - `Account` / `Posting` / `Transaction` / `BalanceAssertion` / `Pad`
 *   - `validateTransaction` — sum-to-zero per (currency, scale), account
 *     existence + open-window checks, currency restrictions
 *   - `LedgerStore` interface + `InMemoryLedgerStore` for tests
 *   - `reverseTransaction` — the **only** way to correct a posted entry
 *   - **Bailment-mode invariants** — `verifyPooledEqualsClaims`,
 *     `detectCustodianDrift`, `claimsByClient` for advisor shadow
 *     ledgers (treasury rebalancing windows, omnibus reconciliation)
 *
 * Decimal handling: bigint with explicit scale and currency (see
 * `decimal.ts`). No float arithmetic — every transaction balances
 * exactly or it doesn't.
 *
 * v0.5.0 ships single-currency-per-leg MVP. Lots, cost basis, and
 * inventory tracking land in v0.5.1.
 */

export {
  AmountMismatchError,
  absAmount,
  addAmount,
  compareAmount,
  equalAmount,
  formatAmount,
  formatAmountValue,
  makeAmount,
  negateAmount,
  parseAmount,
  signAmount,
  sumAmounts,
  zeroAmount,
} from "./decimal.js";

export {
  asAccountName,
  isValidAccountName,
  naturalSign,
  parseAccountName,
  rootOf,
} from "./account.js";

export {
  buildTransaction,
  posting,
  reverseTransaction,
} from "./transaction.js";
export type { BuildTransactionInput } from "./transaction.js";

export {
  checkBalanceAssertion,
  validateTransaction,
} from "./validator.js";
export type { ValidateContext } from "./validator.js";

export {
  InMemoryLedgerStore,
} from "./store.js";
export type { LedgerStore } from "./store.js";

export {
  claimsByClient,
  defaultBailmentConfig,
  detectCustodianDrift,
  verifyPooledEqualsClaims,
} from "./bailment.js";
export type {
  BailmentConfig,
  CustodianBalanceReport,
  DriftFinding,
} from "./bailment.js";

export { asCurrency } from "./types.js";
export type {
  Account,
  AccountName,
  AccountRoot,
  AccountStatus,
  Amount,
  AssertionId,
  BalanceAssertion,
  BookingMethod,
  Currency,
  Ledger,
  LedgerError,
  LedgerErrorCode,
  Pad,
  PadId,
  Posting,
  PostingFlag,
  Result,
  Transaction,
  TransactionFlag,
  TxId,
} from "./types.js";
