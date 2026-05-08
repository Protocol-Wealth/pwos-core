// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { describe, expect, it } from "vitest";
import { asAccountName } from "../src/account.js";
import {
  claimsByClient,
  defaultBailmentConfig,
  detectCustodianDrift,
  verifyPooledEqualsClaims,
} from "../src/bailment.js";
import { parseAmount } from "../src/decimal.js";
import { buildTransaction, posting } from "../src/transaction.js";
import { asCurrency } from "../src/types.js";
import type { Currency, TxId } from "../src/types.js";

const AAPL = asCurrency("AAPL") as Currency;

const config = defaultBailmentConfig();

describe("verifyPooledEqualsClaims", () => {
  it("holds when every transfer routes through the pool", () => {
    // alice deposits 10 AAPL into the pool; pooled +10, alice claim +10 (liability is negative)
    const txs = [
      buildTransaction({
        id: "t_1" as TxId,
        date: "2026-05-08",
        narration: "alice deposit",
        postings: [
          posting(asAccountName("Assets:Pooled:Apex:AAPL"), parseAmount("10", AAPL, 0)),
          posting(asAccountName("Liabilities:Bailment:alice:AAPL"), parseAmount("-10", AAPL, 0)),
        ],
      }),
      buildTransaction({
        id: "t_2" as TxId,
        date: "2026-05-09",
        narration: "bob deposit",
        postings: [
          posting(asAccountName("Assets:Pooled:Apex:AAPL"), parseAmount("5", AAPL, 0)),
          posting(asAccountName("Liabilities:Bailment:bob:AAPL"), parseAmount("-5", AAPL, 0)),
        ],
      }),
    ];
    const result = verifyPooledEqualsClaims(txs, config);
    expect(result.ok).toBe(true);
  });

  it("fails when pooled and claims diverge", () => {
    // bug: alice deposit only credits her claim, doesn't add to the pool
    const txs = [
      buildTransaction({
        id: "t_1" as TxId,
        date: "2026-05-08",
        narration: "buggy deposit",
        postings: [
          posting(asAccountName("Liabilities:Bailment:alice:AAPL"), parseAmount("-10", AAPL, 0)),
          posting(asAccountName("Income:Phantom:AAPL"), parseAmount("10", AAPL, 0)),
        ],
      }),
    ];
    const result = verifyPooledEqualsClaims(txs, config);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("bailment_invariant");
  });

  it("ignores non-bailment account legs", () => {
    const txs = [
      buildTransaction({
        id: "t_1" as TxId,
        date: "2026-05-08",
        narration: "an unrelated cash entry",
        postings: [
          posting(asAccountName("Assets:Cash"), parseAmount("100", asCurrency("USD"), 0)),
          posting(asAccountName("Income:Fees"), parseAmount("-100", asCurrency("USD"), 0)),
        ],
      }),
    ];
    const result = verifyPooledEqualsClaims(txs, config);
    expect(result.ok).toBe(true);
  });
});

describe("detectCustodianDrift", () => {
  it("returns no findings when shadow matches reported", () => {
    const txs = [
      buildTransaction({
        id: "t_1" as TxId,
        date: "2026-05-08",
        narration: "deposit",
        postings: [
          posting(asAccountName("Assets:Pooled:Apex:AAPL"), parseAmount("10", AAPL, 0)),
          posting(asAccountName("Liabilities:Bailment:alice:AAPL"), parseAmount("-10", AAPL, 0)),
        ],
      }),
    ];
    const findings = detectCustodianDrift(
      txs,
      [
        {
          custodian: "Apex",
          asset: AAPL,
          scale: 0,
          asOfDate: "2026-05-08",
          reportedBalance: parseAmount("10", AAPL, 0),
        },
      ],
      config
    );
    expect(findings).toEqual([]);
  });

  it("emits a finding when reported balance diverges from shadow", () => {
    const txs = [
      buildTransaction({
        id: "t_1" as TxId,
        date: "2026-05-08",
        narration: "deposit",
        postings: [
          posting(asAccountName("Assets:Pooled:Apex:AAPL"), parseAmount("10", AAPL, 0)),
          posting(asAccountName("Liabilities:Bailment:alice:AAPL"), parseAmount("-10", AAPL, 0)),
        ],
      }),
    ];
    const findings = detectCustodianDrift(
      txs,
      [
        {
          custodian: "Apex",
          asset: AAPL,
          scale: 0,
          asOfDate: "2026-05-08",
          reportedBalance: parseAmount("9", AAPL, 0),
        },
      ],
      config
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]!.driftMinorUnits).toBe(-1n);
  });
});

describe("claimsByClient", () => {
  it("aggregates claims per client", () => {
    const txs = [
      buildTransaction({
        id: "t_1" as TxId,
        date: "2026-05-08",
        narration: "alice deposit",
        postings: [
          posting(asAccountName("Assets:Pooled:Apex:AAPL"), parseAmount("10", AAPL, 0)),
          posting(asAccountName("Liabilities:Bailment:alice:AAPL"), parseAmount("-10", AAPL, 0)),
        ],
      }),
      buildTransaction({
        id: "t_2" as TxId,
        date: "2026-05-08",
        narration: "alice top up",
        postings: [
          posting(asAccountName("Assets:Pooled:Apex:AAPL"), parseAmount("3", AAPL, 0)),
          posting(asAccountName("Liabilities:Bailment:alice:AAPL"), parseAmount("-3", AAPL, 0)),
        ],
      }),
      buildTransaction({
        id: "t_3" as TxId,
        date: "2026-05-09",
        narration: "bob deposit",
        postings: [
          posting(asAccountName("Assets:Pooled:Apex:AAPL"), parseAmount("5", AAPL, 0)),
          posting(asAccountName("Liabilities:Bailment:bob:AAPL"), parseAmount("-5", AAPL, 0)),
        ],
      }),
    ];
    const out = claimsByClient(txs, AAPL, 0, "2026-05-09");
    expect(out.get("alice")).toBe(-13n);
    expect(out.get("bob")).toBe(-5n);
  });
});
