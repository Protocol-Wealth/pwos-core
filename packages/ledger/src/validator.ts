// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Transaction + balance-assertion validators.
 *
 * Three checks for a transaction at append time:
 *   1. Every referenced account exists.
 *   2. Every account is open at `tx.date` (opened on or before, not
 *      yet closed).
 *   3. Each currency's posting sum equals zero (within tolerance).
 *   4. If an account has `allowedCurrencies`, every posting on that
 *      account uses one of them.
 *
 * The validator returns a `Result<Transaction, LedgerError>` so
 * callers can branch without exception handling.
 */

import { sumAmounts } from "./decimal.js";
import type {
  Account,
  AccountName,
  BalanceAssertion,
  LedgerError,
  Result,
  Transaction,
} from "./types.js";

export interface ValidateContext {
  accounts: ReadonlyMap<AccountName, Account>;
  /** Tolerance for sum-to-zero check, in minor units. Default 0n (exact). */
  tolerance?: bigint;
}

export function validateTransaction(
  tx: Transaction,
  ctx: ValidateContext
): Result<Transaction, LedgerError> {
  const tolerance = ctx.tolerance ?? 0n;

  for (const p of tx.postings) {
    const acct = ctx.accounts.get(p.account);
    if (!acct) {
      return {
        ok: false,
        error: {
          code: "account_not_found",
          message: `account "${p.account}" not found`,
          source: { txId: tx.id, account: p.account, date: tx.date },
        },
      };
    }
    if (acct.openedOn > tx.date) {
      return {
        ok: false,
        error: {
          code: "account_not_yet_open",
          message: `account "${p.account}" not opened until ${acct.openedOn}; tx date is ${tx.date}`,
          source: { txId: tx.id, account: p.account, date: tx.date },
        },
      };
    }
    if (acct.closedOn !== undefined && acct.closedOn < tx.date) {
      return {
        ok: false,
        error: {
          code: "account_closed",
          message: `account "${p.account}" closed on ${acct.closedOn}; tx date is ${tx.date}`,
          source: { txId: tx.id, account: p.account, date: tx.date },
        },
      };
    }
    if (
      acct.allowedCurrencies !== undefined &&
      acct.allowedCurrencies.length > 0 &&
      !acct.allowedCurrencies.includes(p.amount.currency)
    ) {
      return {
        ok: false,
        error: {
          code: "currency_not_allowed",
          message: `account "${p.account}" does not allow currency "${p.amount.currency}"`,
          source: { txId: tx.id, account: p.account, date: tx.date },
        },
      };
    }
  }

  // Sum-to-zero per (currency, scale).
  const sums = sumAmounts(tx.postings.map((p) => p.amount));
  for (const [key, amount] of sums) {
    const abs = amount.value < 0n ? -amount.value : amount.value;
    if (abs > tolerance) {
      return {
        ok: false,
        error: {
          code: "transaction_unbalanced",
          message: `transaction does not balance for ${key}: residual ${amount.value.toString()} (tolerance ${tolerance.toString()})`,
          source: { txId: tx.id, date: tx.date },
        },
      };
    }
  }

  return { ok: true, value: tx };
}

/**
 * Verify a balance assertion against a current per-account balance map.
 * Returns ok if the asserted balance matches (within tolerance), or a
 * `balance_mismatch` error otherwise.
 */
export function checkBalanceAssertion(
  assertion: BalanceAssertion,
  current: Map<string, bigint>
): Result<BalanceAssertion, LedgerError> {
  const key = `${assertion.expected.currency}@${assertion.expected.scale}`;
  const observed = current.get(key) ?? 0n;
  const diff = observed - assertion.expected.value;
  const abs = diff < 0n ? -diff : diff;
  const tolerance = assertion.tolerance ?? 0n;
  if (abs > tolerance) {
    return {
      ok: false,
      error: {
        code: "balance_mismatch",
        message: `balance assertion failed for ${assertion.account} on ${assertion.date}: expected ${assertion.expected.value.toString()}, observed ${observed.toString()}, diff ${diff.toString()}`,
        source: { account: assertion.account, date: assertion.date },
      },
    };
  }
  return { ok: true, value: assertion };
}
