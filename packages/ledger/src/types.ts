// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Core types for the ledger.
 *
 * The ledger is **append-only** — there is no update, no delete. To
 * correct a posted transaction, append a reversing transaction (same
 * postings sign-flipped, with `reverses: txId` set). The reversing
 * pair is a recordkeeping artifact: an examiner can see both the
 * original entry and the correction.
 */

/**
 * Currency identifier. Use ISO 4217 codes for fiat (`"USD"`, `"EUR"`)
 * and tickers / CUSIPs / your own stable identifiers for securities
 * (`"AAPL"`, `"BTC"`, `"VTI"`).
 */
export type Currency = string & { readonly __brand: "Currency" };

/** Brand a string as a Currency. */
export function asCurrency(value: string): Currency {
  return value as Currency;
}

/** The five canonical account roots. */
export type AccountRoot =
  | "Assets"
  | "Liabilities"
  | "Equity"
  | "Income"
  | "Expenses";

/**
 * Account name — colon-delimited path, e.g. `"Assets:US:BofA:Checking"`.
 * The first segment must be one of `AccountRoot`. Validated by
 * `parseAccountName` / `isValidAccountName`.
 */
export type AccountName = string & { readonly __brand: "AccountName" };

/**
 * Booking method drives lot selection on reductions (sells, transfers
 * out). v0.5.0 ships single-currency MVP without lot tracking; lot
 * selection becomes meaningful in v0.5.1 when `Cost` is added.
 *
 * - `STRICT` — refuse reductions that don't match an existing lot exactly
 * - `FIFO` / `LIFO` / `HIFO` — first / last / highest-cost lot first
 * - `AVERAGE` — weighted average across all open lots
 * - `NONE` — no lot tracking; treat the inventory as a single bucket
 */
export type BookingMethod =
  | "STRICT"
  | "FIFO"
  | "LIFO"
  | "HIFO"
  | "AVERAGE"
  | "NONE";

/** Decimal amount: bigint value with explicit scale + currency. See `decimal.ts`. */
export interface Amount {
  /** Signed integer in minor units (e.g. 150n at scale 2 = 1.50). */
  value: bigint;
  /** Number of decimal places (0–18). */
  scale: number;
  currency: Currency;
}

export type AccountStatus = "open" | "closed";

/**
 * An account in the ledger. Accounts must be opened before use; once
 * closed, they cannot be re-opened (open a new account at a new name
 * if needed).
 *
 * `allowedCurrencies` constrains postings on this account to specific
 * currencies — useful for enforcing "this is a USD-only checking
 * account" or "this is the AAPL position lot".
 */
export interface Account {
  name: AccountName;
  root: AccountRoot;
  openedOn: string; // ISO-8601 date
  closedOn?: string;
  allowedCurrencies?: readonly Currency[];
  booking: BookingMethod;
  meta: Readonly<Record<string, string>>;
}

export type PostingFlag = "*" | "!" | "?";

/** One leg of a transaction. */
export interface Posting {
  account: AccountName;
  amount: Amount;
  flag?: PostingFlag;
  meta?: Readonly<Record<string, string>>;
}

export type TransactionFlag = "*" | "!" | "?";

export type TxId = string & { readonly __brand: "TxId" };

/**
 * A transaction is the unit of accounting. The validator enforces:
 *   - all referenced accounts exist and are open at `date`
 *   - per-currency sum of postings equals zero (within tolerance 0n)
 *   - currency restrictions on each account satisfied
 *
 * `reverses` is set when this transaction was created to undo a
 * previously-posted transaction. A reversing transaction with
 * sign-flipped postings is the **only** way to correct an error;
 * mutation is forbidden.
 */
export interface Transaction {
  id: TxId;
  date: string; // ISO-8601 date the economic event occurred
  flag: TransactionFlag;
  payee?: string;
  narration: string;
  tags: ReadonlySet<string>;
  links: ReadonlySet<string>;
  postings: readonly Posting[];
  meta: Readonly<Record<string, string>>;
  /** Wall-clock time the row was committed (separate from the event date). */
  recordedAt: string; // ISO-8601 timestamp
  /** Set when this transaction reverses a prior one. */
  reverses?: TxId;
}

export type AssertionId = string & { readonly __brand: "AssertionId" };

/**
 * Balance assertion: at the start of `date`, `account` holds exactly
 * `expected` (within `tolerance`). If the replayed inventory diverges,
 * the ledger raises `BalanceAssertionFailed` — the canonical
 * "you forgot to record a transaction" detector.
 */
export interface BalanceAssertion {
  id: AssertionId;
  date: string;
  account: AccountName;
  expected: Amount;
  tolerance?: bigint; // in minor units of `expected.scale`; default 0n
  recordedAt: string;
}

export type PadId = string & { readonly __brand: "PadId" };

/**
 * Pad: bootstrap entry that imputes a transaction between two accounts
 * to make the next balance assertion pass. Always flagged `imputed:
 * true` — an imputed entry is not an observed event. Use for opening
 * balances; refuse for ongoing operations.
 */
export interface Pad {
  id: PadId;
  date: string;
  account: AccountName;
  sourceAccount: AccountName;
  imputed: true;
  recordedAt: string;
}

export type LedgerErrorCode =
  | "account_not_found"
  | "account_closed"
  | "account_not_yet_open"
  | "currency_not_allowed"
  | "transaction_unbalanced"
  | "balance_mismatch"
  | "duplicate_id"
  | "invalid_account_name"
  | "invalid_amount"
  | "bailment_invariant"
  | "internal";

export interface LedgerError {
  code: LedgerErrorCode;
  message: string;
  source?: { txId?: TxId; account?: AccountName; date?: string };
}

/** Aggregate read-side view of the ledger at a point in time. */
export interface Ledger {
  accounts: ReadonlyMap<AccountName, Account>;
  transactions: readonly Transaction[];
  balances: ReadonlyMap<AccountName, ReadonlyMap<string, Amount>>; // account → "currency@scale" → balance
  assertions: readonly BalanceAssertion[];
  pads: readonly Pad[];
  errors: readonly LedgerError[];
}

/** Result type used by validators. */
export type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };
