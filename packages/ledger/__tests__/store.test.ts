// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { describe, expect, it } from "vitest";
import { asAccountName } from "../src/account.js";
import { parseAmount } from "../src/decimal.js";
import { InMemoryLedgerStore } from "../src/store.js";
import { buildTransaction, posting } from "../src/transaction.js";
import { asCurrency } from "../src/types.js";
import type { AssertionId, TxId } from "../src/types.js";

const USD = asCurrency("USD");
const cash = asAccountName("Assets:Cash");
const food = asAccountName("Expenses:Food");

async function freshStore(): Promise<InMemoryLedgerStore> {
  const s = new InMemoryLedgerStore();
  await s.openAccount({
    name: cash,
    root: "Assets",
    openedOn: "2026-01-01",
    booking: "NONE",
    meta: {},
  });
  await s.openAccount({
    name: food,
    root: "Expenses",
    openedOn: "2026-01-01",
    booking: "NONE",
    meta: {},
  });
  return s;
}

describe("InMemoryLedgerStore", () => {
  it("opens accounts; refuses duplicate opens", async () => {
    const s = await freshStore();
    const dup = await s.openAccount({
      name: cash,
      root: "Assets",
      openedOn: "2026-01-01",
      booking: "NONE",
      meta: {},
    });
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.error.code).toBe("duplicate_id");
  });

  it("appends transactions and updates running balances", async () => {
    const s = await freshStore();
    const tx = buildTransaction({
      id: "tx_1" as TxId,
      date: "2026-05-08",
      narration: "coffee",
      postings: [
        posting(food, parseAmount("4.50", USD, 2)),
        posting(cash, parseAmount("-4.50", USD, 2)),
      ],
    });
    expect((await s.appendTransaction(tx)).ok).toBe(true);
    const balances = await s.balancesFor(cash);
    expect(balances.get("USD@2")!.value).toBe(-450n);
  });

  it("refuses duplicate transaction ids", async () => {
    const s = await freshStore();
    const tx = buildTransaction({
      id: "tx_1" as TxId,
      date: "2026-05-08",
      narration: "x",
      postings: [
        posting(food, parseAmount("1.00", USD, 2)),
        posting(cash, parseAmount("-1.00", USD, 2)),
      ],
    });
    await s.appendTransaction(tx);
    const dup = await s.appendTransaction(tx);
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.error.code).toBe("duplicate_id");
  });

  it("reverse() appends a sign-flipped reversing transaction", async () => {
    const s = await freshStore();
    await s.appendTransaction(
      buildTransaction({
        id: "tx_1" as TxId,
        date: "2026-05-08",
        narration: "x",
        postings: [
          posting(food, parseAmount("4.50", USD, 2)),
          posting(cash, parseAmount("-4.50", USD, 2)),
        ],
      })
    );
    const rev = await s.reverse("tx_1" as TxId, "tx_2" as TxId);
    expect(rev.ok).toBe(true);
    const balances = await s.balancesFor(cash);
    expect(balances.get("USD@2")!.value).toBe(0n);
  });

  it("appendBalance fails when current balance diverges", async () => {
    const s = await freshStore();
    await s.appendTransaction(
      buildTransaction({
        id: "tx_1" as TxId,
        date: "2026-05-08",
        narration: "x",
        postings: [
          posting(food, parseAmount("4.50", USD, 2)),
          posting(cash, parseAmount("-4.50", USD, 2)),
        ],
      })
    );
    const r = await s.appendBalance({
      id: "ba_1" as AssertionId,
      date: "2026-05-09",
      account: cash,
      expected: parseAmount("0.00", USD, 2),
      recordedAt: "2026-05-09T00:00:00Z",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("balance_mismatch");
  });

  it("appendBalance succeeds when balance matches", async () => {
    const s = await freshStore();
    await s.appendTransaction(
      buildTransaction({
        id: "tx_1" as TxId,
        date: "2026-05-08",
        narration: "x",
        postings: [
          posting(food, parseAmount("4.50", USD, 2)),
          posting(cash, parseAmount("-4.50", USD, 2)),
        ],
      })
    );
    const r = await s.appendBalance({
      id: "ba_1" as AssertionId,
      date: "2026-05-09",
      account: cash,
      expected: parseAmount("-4.50", USD, 2),
      recordedAt: "2026-05-09T00:00:00Z",
    });
    expect(r.ok).toBe(true);
  });

  it("listTransactions filters by accountPrefix and date range", async () => {
    const s = await freshStore();
    for (const [i, date] of [
      [1, "2026-04-01"],
      [2, "2026-05-08"],
      [3, "2026-06-15"],
    ] as const) {
      await s.appendTransaction(
        buildTransaction({
          id: `tx_${i}` as TxId,
          date,
          narration: "x",
          postings: [
            posting(food, parseAmount("1.00", USD, 2)),
            posting(cash, parseAmount("-1.00", USD, 2)),
          ],
        })
      );
    }
    const may = await s.listTransactions({ startDate: "2026-05-01", endDate: "2026-05-31" });
    expect(may).toHaveLength(1);
    expect(may[0]!.id).toBe("tx_2");

    const onlyFood = await s.listTransactions({ accountPrefix: "Expenses:" });
    expect(onlyFood).toHaveLength(3);
  });
});
