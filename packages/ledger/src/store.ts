// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Append-only ledger store.
 *
 * The defining property: rows can be appended but never updated or
 * deleted. To correct a posted transaction, call `reverse(txId, …)` —
 * which builds a sign-flipped transaction and appends it. The original
 * row stays in the chain, and the audit trail shows both.
 *
 * The store is intentionally minimal — `appendTransaction`,
 * `appendBalance`, `appendPad`, plus account lifecycle. Read methods
 * (`getLedger`, `balanceAt`) materialize state by replaying events.
 *
 * Implementations should:
 *   - Persist append-only (Postgres with the BEFORE DELETE / BEFORE
 *     UPDATE trigger from `@protocolwealthos/audit-log`'s SQL template
 *     is the canonical model).
 *   - Write one audit-log row per append, with the canonical JSON +
 *     content hash chained to the prior row.
 *   - Run validators before persisting; the contract is "validated +
 *     persisted + audit-logged" all-or-nothing.
 *
 * Ships with `InMemoryLedgerStore` for tests and dev — not safe across
 * multiple workers.
 */

import { addAmount, makeAmount } from "./decimal.js";
import { reverseTransaction } from "./transaction.js";
import { checkBalanceAssertion, validateTransaction } from "./validator.js";
import type {
  Account,
  AccountName,
  Amount,
  AssertionId,
  BalanceAssertion,
  LedgerError,
  Pad,
  PadId,
  Posting,
  Result,
  Transaction,
  TxId,
} from "./types.js";

export interface LedgerStore {
  // ── account lifecycle ───────────────────────────────────────────
  openAccount(account: Account): Promise<Result<Account, LedgerError>>;
  closeAccount(
    name: AccountName,
    on: string
  ): Promise<Result<AccountName, LedgerError>>;

  // ── append-only ─────────────────────────────────────────────────
  appendTransaction(tx: Transaction): Promise<Result<Transaction, LedgerError>>;
  appendBalance(
    assertion: BalanceAssertion
  ): Promise<Result<BalanceAssertion, LedgerError>>;
  appendPad(pad: Pad): Promise<Result<Pad, LedgerError>>;

  /** Build + append a reversing transaction for `originalId`. */
  reverse(
    originalId: TxId,
    newId: TxId,
    options?: { date?: string; narration?: string }
  ): Promise<Result<Transaction, LedgerError>>;

  // ── reads ──────────────────────────────────────────────────────
  getAccount(name: AccountName): Promise<Account | undefined>;
  listAccounts(): Promise<readonly Account[]>;
  listTransactions(filter?: {
    accountPrefix?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<readonly Transaction[]>;
  /** Current balance of `account` keyed by `${currency}@${scale}`. */
  balancesFor(account: AccountName): Promise<ReadonlyMap<string, Amount>>;
}

export class InMemoryLedgerStore implements LedgerStore {
  private readonly accounts = new Map<AccountName, Account>();
  private readonly transactions: Transaction[] = [];
  private readonly assertions: BalanceAssertion[] = [];
  private readonly pads: Pad[] = [];
  private readonly txIds = new Set<string>();
  private readonly assertionIds = new Set<string>();
  private readonly padIds = new Set<string>();
  /** Per-account running balances, keyed `${currency}@${scale}` → `value`. */
  private readonly balances = new Map<AccountName, Map<string, bigint>>();

  async openAccount(account: Account): Promise<Result<Account, LedgerError>> {
    if (this.accounts.has(account.name)) {
      return {
        ok: false,
        error: {
          code: "duplicate_id",
          message: `account "${account.name}" already opened`,
          source: { account: account.name },
        },
      };
    }
    this.accounts.set(account.name, account);
    return { ok: true, value: account };
  }

  async closeAccount(
    name: AccountName,
    on: string
  ): Promise<Result<AccountName, LedgerError>> {
    const acct = this.accounts.get(name);
    if (!acct) {
      return {
        ok: false,
        error: {
          code: "account_not_found",
          message: `account "${name}" not found`,
          source: { account: name },
        },
      };
    }
    this.accounts.set(name, { ...acct, closedOn: on });
    return { ok: true, value: name };
  }

  async appendTransaction(
    tx: Transaction
  ): Promise<Result<Transaction, LedgerError>> {
    if (this.txIds.has(tx.id)) {
      return {
        ok: false,
        error: {
          code: "duplicate_id",
          message: `transaction id "${tx.id}" already exists`,
          source: { txId: tx.id },
        },
      };
    }
    const validation = validateTransaction(tx, { accounts: this.accounts });
    if (!validation.ok) return validation;
    this.transactions.push(tx);
    this.txIds.add(tx.id);
    this.applyToBalances(tx.postings);
    return { ok: true, value: tx };
  }

  async appendBalance(
    assertion: BalanceAssertion
  ): Promise<Result<BalanceAssertion, LedgerError>> {
    if (this.assertionIds.has(assertion.id)) {
      return {
        ok: false,
        error: {
          code: "duplicate_id",
          message: `balance assertion id "${assertion.id}" already exists`,
          source: { account: assertion.account, date: assertion.date },
        },
      };
    }
    const balances =
      this.balances.get(assertion.account) ?? new Map<string, bigint>();
    const check = checkBalanceAssertion(assertion, balances);
    if (!check.ok) return check;
    this.assertions.push(assertion);
    this.assertionIds.add(assertion.id);
    return { ok: true, value: assertion };
  }

  async appendPad(pad: Pad): Promise<Result<Pad, LedgerError>> {
    if (this.padIds.has(pad.id)) {
      return {
        ok: false,
        error: {
          code: "duplicate_id",
          message: `pad id "${pad.id}" already exists`,
          source: { account: pad.account, date: pad.date },
        },
      };
    }
    this.pads.push(pad);
    this.padIds.add(pad.id);
    return { ok: true, value: pad };
  }

  async reverse(
    originalId: TxId,
    newId: TxId,
    options: { date?: string; narration?: string } = {}
  ): Promise<Result<Transaction, LedgerError>> {
    const original = this.transactions.find((t) => t.id === originalId);
    if (!original) {
      return {
        ok: false,
        error: {
          code: "internal",
          message: `cannot reverse: transaction "${originalId}" not found`,
          source: { txId: originalId },
        },
      };
    }
    const reversal = reverseTransaction(original, newId, options);
    return this.appendTransaction(reversal);
  }

  async getAccount(name: AccountName): Promise<Account | undefined> {
    return this.accounts.get(name);
  }

  async listAccounts(): Promise<readonly Account[]> {
    return Array.from(this.accounts.values());
  }

  async listTransactions(
    filter: { accountPrefix?: string; startDate?: string; endDate?: string } = {}
  ): Promise<readonly Transaction[]> {
    return this.transactions.filter((tx) => {
      if (filter.startDate && tx.date < filter.startDate) return false;
      if (filter.endDate && tx.date > filter.endDate) return false;
      if (filter.accountPrefix) {
        const match = tx.postings.some((p) =>
          p.account.startsWith(filter.accountPrefix!)
        );
        if (!match) return false;
      }
      return true;
    });
  }

  async balancesFor(account: AccountName): Promise<ReadonlyMap<string, Amount>> {
    const raw = this.balances.get(account) ?? new Map<string, bigint>();
    const out = new Map<string, Amount>();
    for (const [key, value] of raw) {
      const [currency, scaleStr] = key.split("@") as [string, string];
      out.set(
        key,
        makeAmount(
          value,
          currency as Amount["currency"],
          Number.parseInt(scaleStr, 10)
        )
      );
    }
    return out;
  }

  private applyToBalances(postings: readonly Posting[]): void {
    for (const p of postings) {
      const key = `${p.amount.currency}@${p.amount.scale}`;
      const acct = this.balances.get(p.account) ?? new Map<string, bigint>();
      const prev = acct.get(key);
      const next = prev !== undefined ? addAmount(
        makeAmount(prev, p.amount.currency, p.amount.scale),
        p.amount
      ).value : p.amount.value;
      acct.set(key, next);
      this.balances.set(p.account, acct);
    }
  }
}
