// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { describe, expect, it } from "vitest";
import { parseAmount } from "../src/decimal.js";
import {
  buyEvent,
  markEvent,
  sellEvent,
  splitEvent,
} from "../src/events.js";
import { materializeSnapshots, priceAt } from "../src/materialize.js";
import type {
  AccountId,
  Currency,
  EventId,
  SecurityId,
  SecurityPrice,
} from "../src/types.js";

const USD = "USD" as Currency;
const account = "acc_1" as AccountId;
const aapl = "sec_aapl" as SecurityId;

describe("priceAt", () => {
  const prices: SecurityPrice[] = [
    {
      securityId: aapl,
      asOfDate: "2026-05-01",
      price: parseAmount("180.00", USD, 2),
      provisional: false,
      source: "mock",
    },
    {
      securityId: aapl,
      asOfDate: "2026-05-08",
      price: parseAmount("185.00", USD, 2),
      provisional: false,
      source: "mock",
    },
    {
      securityId: aapl,
      asOfDate: "2026-05-15",
      price: parseAmount("190.00", USD, 2),
      provisional: false,
      source: "mock",
    },
  ];

  it("returns the latest price <= asOfDate", () => {
    expect(priceAt(prices, aapl, USD, "2026-05-10")?.asOfDate).toBe("2026-05-08");
    expect(priceAt(prices, aapl, USD, "2026-05-15")?.asOfDate).toBe("2026-05-15");
  });

  it("returns null when nothing on or before", () => {
    expect(priceAt(prices, aapl, USD, "2026-04-01")).toBeNull();
  });
});

describe("materializeSnapshots", () => {
  it("accumulates qty + cost basis across buys", () => {
    const events = [
      buyEvent({
        id: "ev_1" as EventId,
        accountId: account,
        occurredOn: "2026-05-01",
        securityId: aapl,
        qtyDelta: 100n,
        qtyScale: 0,
        cashDelta: parseAmount("-15000.00", USD, 2),
        costBasisDelta: parseAmount("15000.00", USD, 2),
      }),
      buyEvent({
        id: "ev_2" as EventId,
        accountId: account,
        occurredOn: "2026-05-15",
        securityId: aapl,
        qtyDelta: 50n,
        qtyScale: 0,
        cashDelta: parseAmount("-9250.00", USD, 2),
        costBasisDelta: parseAmount("9250.00", USD, 2),
      }),
    ];
    const prices = [
      {
        securityId: aapl,
        asOfDate: "2026-05-31",
        price: parseAmount("200.00", USD, 2),
        provisional: false,
        source: "m",
      },
    ];
    const snaps = materializeSnapshots(events, prices, { asOfDate: "2026-05-31" });
    expect(snaps).toHaveLength(1);
    const s = snaps[0]!;
    expect(s.qty).toBe(150n);
    expect(s.costBasis.value).toBe(2425000n); // $24,250.00
    expect(s.marketValue.value).toBe(3000000n); // 150 × $200.00 = $30,000.00
    expect(s.costBasisSource).toBe("computed");
  });

  it("sells reduce qty and cost basis", () => {
    const events = [
      buyEvent({
        id: "ev_1" as EventId,
        accountId: account,
        occurredOn: "2026-05-01",
        securityId: aapl,
        qtyDelta: 100n,
        qtyScale: 0,
        cashDelta: parseAmount("-15000.00", USD, 2),
        costBasisDelta: parseAmount("15000.00", USD, 2),
      }),
      sellEvent({
        id: "ev_2" as EventId,
        accountId: account,
        occurredOn: "2026-06-01",
        securityId: aapl,
        qtyDelta: -25n,
        qtyScale: 0,
        cashDelta: parseAmount("4500.00", USD, 2),
        costBasisDelta: parseAmount("-3750.00", USD, 2),
      }),
    ];
    const snaps = materializeSnapshots(events, [], { asOfDate: "2026-06-30" });
    const s = snaps[0]!;
    expect(s.qty).toBe(75n);
    expect(s.costBasis.value).toBe(1125000n); // $11,250.00 remaining
  });

  it("respects asOfDate cutoff", () => {
    const events = [
      buyEvent({
        id: "ev_1" as EventId,
        accountId: account,
        occurredOn: "2026-05-01",
        securityId: aapl,
        qtyDelta: 100n,
        qtyScale: 0,
        cashDelta: parseAmount("-15000.00", USD, 2),
        costBasisDelta: parseAmount("15000.00", USD, 2),
      }),
      buyEvent({
        id: "ev_2" as EventId,
        accountId: account,
        occurredOn: "2026-06-01",
        securityId: aapl,
        qtyDelta: 50n,
        qtyScale: 0,
        cashDelta: parseAmount("-9250.00", USD, 2),
        costBasisDelta: parseAmount("9250.00", USD, 2),
      }),
    ];
    const snaps = materializeSnapshots(events, [], { asOfDate: "2026-05-15" });
    expect(snaps[0]!.qty).toBe(100n);
  });

  it("uses the latest mark for offline securities when no price feed exists", () => {
    const events = [
      buyEvent({
        id: "ev_1" as EventId,
        accountId: account,
        occurredOn: "2026-05-01",
        securityId: aapl,
        qtyDelta: 100n,
        qtyScale: 0,
        cashDelta: parseAmount("-15000.00", USD, 2),
        costBasisDelta: parseAmount("15000.00", USD, 2),
      }),
      markEvent({
        id: "ev_2" as EventId,
        accountId: account,
        occurredOn: "2026-12-31",
        securityId: aapl,
        qtyDelta: 0n,
        qtyScale: 0,
        cashDelta: parseAmount("0.00", USD, 2),
        pricePerUnit: parseAmount("250.00", USD, 2),
      }),
    ];
    const snaps = materializeSnapshots(events, [], { asOfDate: "2026-12-31" });
    expect(snaps[0]!.marketPrice.value).toBe(25000n);
    expect(snaps[0]!.marketValue.value).toBe(2500000n); // 100 × $250.00
  });

  it("split increases qty without changing cost basis", () => {
    const events = [
      buyEvent({
        id: "ev_1" as EventId,
        accountId: account,
        occurredOn: "2026-05-01",
        securityId: aapl,
        qtyDelta: 100n,
        qtyScale: 0,
        cashDelta: parseAmount("-15000.00", USD, 2),
        costBasisDelta: parseAmount("15000.00", USD, 2),
      }),
      splitEvent({
        id: "ev_2" as EventId,
        accountId: account,
        occurredOn: "2026-06-01",
        securityId: aapl,
        qtyDelta: 100n,
        qtyScale: 0,
        cashDelta: parseAmount("0.00", USD, 2),
      }),
    ];
    const snaps = materializeSnapshots(events, [], { asOfDate: "2026-06-30" });
    expect(snaps[0]!.qty).toBe(200n);
    expect(snaps[0]!.costBasis.value).toBe(1500000n); // unchanged
  });

  it("computes deterministic output (same inputs → same outputs)", () => {
    const events = [
      buyEvent({
        id: "ev_1" as EventId,
        accountId: account,
        occurredOn: "2026-05-01",
        securityId: aapl,
        qtyDelta: 100n,
        qtyScale: 0,
        cashDelta: parseAmount("-15000.00", USD, 2),
        costBasisDelta: parseAmount("15000.00", USD, 2),
      }),
    ];
    const prices = [
      {
        securityId: aapl,
        asOfDate: "2026-05-31",
        price: parseAmount("200.00", USD, 2),
        provisional: false,
        source: "m",
      },
    ];
    const a = materializeSnapshots(events, prices, { asOfDate: "2026-05-31" });
    const b = materializeSnapshots(events, prices, { asOfDate: "2026-05-31" });
    expect(JSON.stringify(a, replacer)).toBe(JSON.stringify(b, replacer));
  });
});

function replacer(_: string, v: unknown): unknown {
  if (typeof v === "bigint") return v.toString();
  if (v instanceof Set) return Array.from(v);
  return v;
}
