// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { describe, expect, it } from "vitest";
import { asAccountName } from "../src/account.js";
import { parseAmount } from "../src/decimal.js";
import { buildTransaction, posting, reverseTransaction } from "../src/transaction.js";
import { asCurrency } from "../src/types.js";
import type { TxId } from "../src/types.js";

const USD = asCurrency("USD");

const cash = asAccountName("Assets:Cash");
const expenses = asAccountName("Expenses:Coffee");

describe("buildTransaction", () => {
  it("constructs a basic transaction with sensible defaults", () => {
    const tx = buildTransaction({
      id: "tx_1" as TxId,
      date: "2026-05-08",
      narration: "morning coffee",
      postings: [
        posting(expenses, parseAmount("4.50", USD, 2)),
        posting(cash, parseAmount("-4.50", USD, 2)),
      ],
    });
    expect(tx.flag).toBe("*");
    expect(tx.tags.size).toBe(0);
    expect(tx.links.size).toBe(0);
    expect(tx.postings).toHaveLength(2);
    expect(tx.recordedAt).toBeDefined();
  });

  it("wires payee, tags, links, meta", () => {
    const tx = buildTransaction({
      id: "tx_2" as TxId,
      date: "2026-05-08",
      narration: "lunch",
      payee: "Joe's Diner",
      tags: ["business", "client_visit"],
      links: ["receipt-001"],
      meta: { project: "alpha" },
      postings: [
        posting(expenses, parseAmount("12.00", USD, 2)),
        posting(cash, parseAmount("-12.00", USD, 2)),
      ],
    });
    expect(tx.payee).toBe("Joe's Diner");
    expect(tx.tags.has("business")).toBe(true);
    expect(tx.links.has("receipt-001")).toBe(true);
    expect(tx.meta.project).toBe("alpha");
  });
});

describe("reverseTransaction", () => {
  it("flips signs on every posting and links via reverses field", () => {
    const original = buildTransaction({
      id: "tx_orig" as TxId,
      date: "2026-05-08",
      narration: "wrong amount",
      postings: [
        posting(expenses, parseAmount("4.50", USD, 2)),
        posting(cash, parseAmount("-4.50", USD, 2)),
      ],
    });
    const reversal = reverseTransaction(original, "tx_rev" as TxId, {
      date: "2026-05-09",
    });
    expect(reversal.reverses).toBe("tx_orig");
    expect(reversal.postings[0]!.amount.value).toBe(-450n);
    expect(reversal.postings[1]!.amount.value).toBe(450n);
    expect(reversal.meta.reversed_from).toBe("tx_orig");
    expect(reversal.narration).toContain("Reverses tx_orig");
  });

  it("preserves tags + links + payee when reversing", () => {
    const original = buildTransaction({
      id: "tx_orig" as TxId,
      date: "2026-05-08",
      narration: "x",
      payee: "Joe's",
      tags: ["a"],
      links: ["l1"],
      postings: [
        posting(expenses, parseAmount("1.00", USD, 2)),
        posting(cash, parseAmount("-1.00", USD, 2)),
      ],
    });
    const reversal = reverseTransaction(original, "tx_rev" as TxId);
    expect(reversal.payee).toBe("Joe's");
    expect(reversal.tags.has("a")).toBe(true);
    expect(reversal.links.has("l1")).toBe(true);
  });
});
