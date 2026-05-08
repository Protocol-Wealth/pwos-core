// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { describe, expect, it } from "vitest";
import { asAccountName } from "../src/account.js";
import { parseAmount } from "../src/decimal.js";
import { buildTransaction, posting } from "../src/transaction.js";
import { asCurrency } from "../src/types.js";
import { checkBalanceAssertion, validateTransaction } from "../src/validator.js";
import type { Account, AccountName, AssertionId, TxId } from "../src/types.js";

const USD = asCurrency("USD");
const EUR = asCurrency("EUR");

const accounts = (): Map<AccountName, Account> => {
  const cash = asAccountName("Assets:Cash");
  const expenses = asAccountName("Expenses:Food");
  return new Map<AccountName, Account>([
    [
      cash,
      {
        name: cash,
        root: "Assets",
        openedOn: "2026-01-01",
        booking: "NONE",
        meta: {},
      },
    ],
    [
      expenses,
      {
        name: expenses,
        root: "Expenses",
        openedOn: "2026-01-01",
        booking: "NONE",
        meta: {},
      },
    ],
  ]);
};

describe("validateTransaction", () => {
  it("accepts a balanced transaction", () => {
    const out = validateTransaction(
      buildTransaction({
        id: "tx_1" as TxId,
        date: "2026-05-08",
        narration: "x",
        postings: [
          posting(asAccountName("Expenses:Food"), parseAmount("4.50", USD, 2)),
          posting(asAccountName("Assets:Cash"), parseAmount("-4.50", USD, 2)),
        ],
      }),
      { accounts: accounts() }
    );
    expect(out.ok).toBe(true);
  });

  it("rejects an unbalanced transaction", () => {
    const out = validateTransaction(
      buildTransaction({
        id: "tx_1" as TxId,
        date: "2026-05-08",
        narration: "x",
        postings: [
          posting(asAccountName("Expenses:Food"), parseAmount("4.50", USD, 2)),
          posting(asAccountName("Assets:Cash"), parseAmount("-4.00", USD, 2)),
        ],
      }),
      { accounts: accounts() }
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error.code).toBe("transaction_unbalanced");
  });

  it("rejects a posting on an unknown account", () => {
    const out = validateTransaction(
      buildTransaction({
        id: "tx_1" as TxId,
        date: "2026-05-08",
        narration: "x",
        postings: [
          posting(asAccountName("Expenses:Food"), parseAmount("1.00", USD, 2)),
          posting(asAccountName("Assets:Unknown"), parseAmount("-1.00", USD, 2)),
        ],
      }),
      { accounts: accounts() }
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error.code).toBe("account_not_found");
  });

  it("rejects a posting on an account opened after the transaction date", () => {
    const out = validateTransaction(
      buildTransaction({
        id: "tx_1" as TxId,
        date: "2025-12-01",
        narration: "x",
        postings: [
          posting(asAccountName("Expenses:Food"), parseAmount("1.00", USD, 2)),
          posting(asAccountName("Assets:Cash"), parseAmount("-1.00", USD, 2)),
        ],
      }),
      { accounts: accounts() }
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error.code).toBe("account_not_yet_open");
  });

  it("rejects a posting in a disallowed currency", () => {
    const map = accounts();
    const cash = asAccountName("Assets:Cash");
    map.set(cash, { ...map.get(cash)!, allowedCurrencies: [USD] });
    const out = validateTransaction(
      buildTransaction({
        id: "tx_1" as TxId,
        date: "2026-05-08",
        narration: "x",
        postings: [
          posting(asAccountName("Expenses:Food"), parseAmount("1.00", EUR, 2)),
          posting(asAccountName("Assets:Cash"), parseAmount("-1.00", EUR, 2)),
        ],
      }),
      { accounts: map }
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error.code).toBe("currency_not_allowed");
  });

  it("multi-currency transactions must balance per currency", () => {
    const map = accounts();
    // a transaction with only USD postings on one side and EUR on the other
    // doesn't balance (each currency must net to zero independently)
    const out = validateTransaction(
      buildTransaction({
        id: "tx_1" as TxId,
        date: "2026-05-08",
        narration: "x",
        postings: [
          posting(asAccountName("Expenses:Food"), parseAmount("1.00", USD, 2)),
          posting(asAccountName("Assets:Cash"), parseAmount("-1.00", EUR, 2)),
        ],
      }),
      { accounts: map }
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error.code).toBe("transaction_unbalanced");
  });
});

describe("checkBalanceAssertion", () => {
  it("ok when expected matches observed", () => {
    const out = checkBalanceAssertion(
      {
        id: "ba_1" as AssertionId,
        date: "2026-05-08",
        account: asAccountName("Assets:Cash"),
        expected: parseAmount("100.00", USD, 2),
        recordedAt: "2026-05-08T00:00:00Z",
      },
      new Map([["USD@2", 10000n]])
    );
    expect(out.ok).toBe(true);
  });

  it("balance_mismatch when divergent beyond tolerance", () => {
    const out = checkBalanceAssertion(
      {
        id: "ba_1" as AssertionId,
        date: "2026-05-08",
        account: asAccountName("Assets:Cash"),
        expected: parseAmount("100.00", USD, 2),
        recordedAt: "2026-05-08T00:00:00Z",
      },
      new Map([["USD@2", 9500n]])
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error.code).toBe("balance_mismatch");
  });

  it("respects tolerance", () => {
    const out = checkBalanceAssertion(
      {
        id: "ba_1" as AssertionId,
        date: "2026-05-08",
        account: asAccountName("Assets:Cash"),
        expected: parseAmount("100.00", USD, 2),
        tolerance: 5n,
        recordedAt: "2026-05-08T00:00:00Z",
      },
      new Map([["USD@2", 10003n]])
    );
    expect(out.ok).toBe(true);
  });
});
