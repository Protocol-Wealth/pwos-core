// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { describe, expect, it } from "vitest";
import { parseAmount } from "../src/decimal.js";
import {
  buildCashEvent,
  buyEvent,
  dividendEvent,
  feeEvent,
  markEvent,
  sellEvent,
  splitEvent,
  transferInEvent,
} from "../src/events.js";
import type {
  AccountId,
  Currency,
  EventId,
  SecurityId,
} from "../src/types.js";

const USD = "USD" as Currency;
const account = "acc_1" as AccountId;
const aapl = "sec_aapl" as SecurityId;

describe("event builders", () => {
  it("buyEvent shapes correctly", () => {
    const e = buyEvent({
      id: "ev_1" as EventId,
      accountId: account,
      occurredOn: "2026-05-08",
      securityId: aapl,
      qtyDelta: 100n,
      qtyScale: 0,
      cashDelta: parseAmount("-15000.00", USD, 2),
      costBasisDelta: parseAmount("15000.00", USD, 2),
    });
    expect(e.kind).toBe("buy");
    expect(e.qtyDelta).toBe(100n);
    expect(e.recordedAt).toBeDefined();
  });

  it("sellEvent shapes correctly", () => {
    const e = sellEvent({
      id: "ev_2" as EventId,
      accountId: account,
      occurredOn: "2026-06-01",
      securityId: aapl,
      qtyDelta: -50n,
      qtyScale: 0,
      cashDelta: parseAmount("8000.00", USD, 2),
      costBasisDelta: parseAmount("-7500.00", USD, 2),
    });
    expect(e.kind).toBe("sell");
    expect(e.qtyDelta).toBe(-50n);
  });

  it("dividendEvent has zero qtyDelta + positive cashDelta", () => {
    const e = dividendEvent({
      id: "ev_3" as EventId,
      accountId: account,
      occurredOn: "2026-06-15",
      securityId: aapl,
      qtyScale: 0,
      cashDelta: parseAmount("23.50", USD, 2),
    });
    expect(e.kind).toBe("dividend");
    expect(e.qtyDelta).toBe(0n);
    expect(e.cashDelta.value).toBe(2350n);
  });

  it("splitEvent carries non-zero qtyDelta with zero cash", () => {
    const e = splitEvent({
      id: "ev_4" as EventId,
      accountId: account,
      occurredOn: "2026-07-01",
      securityId: aapl,
      qtyDelta: 100n, // 2:1 split on 100 → +100
      qtyScale: 0,
      cashDelta: parseAmount("0.00", USD, 2),
    });
    expect(e.kind).toBe("split");
    expect(e.qtyDelta).toBe(100n);
    expect(e.cashDelta.value).toBe(0n);
  });

  it("transferInEvent + markEvent + interestEvent + feeEvent build", () => {
    const ti = transferInEvent({
      id: "ev_5" as EventId,
      accountId: account,
      occurredOn: "2026-05-08",
      securityId: aapl,
      qtyDelta: 25n,
      qtyScale: 0,
      cashDelta: parseAmount("0.00", USD, 2),
      costBasisDelta: parseAmount("3000.00", USD, 2),
    });
    expect(ti.kind).toBe("transfer_in");

    const m = markEvent({
      id: "ev_6" as EventId,
      accountId: account,
      occurredOn: "2026-12-31",
      securityId: aapl,
      qtyDelta: 0n,
      qtyScale: 0,
      cashDelta: parseAmount("0.00", USD, 2),
      pricePerUnit: parseAmount("180.00", USD, 2),
    });
    expect(m.kind).toBe("mark");
    expect(m.pricePerUnit?.value).toBe(18000n);

    const f = feeEvent({
      id: "ev_7" as EventId,
      accountId: account,
      occurredOn: "2026-05-08",
      qtyScale: 0,
      cashDelta: parseAmount("-9.99", USD, 2),
    });
    expect(f.kind).toBe("fee");
    expect(f.qtyDelta).toBe(0n);
  });
});

describe("buildCashEvent", () => {
  it("constructs a cash event", () => {
    const e = buildCashEvent({
      id: "ev_8" as EventId,
      accountId: account,
      occurredOn: "2026-05-08",
      kind: "deposit",
      amount: parseAmount("500.00", USD, 2),
      payee: "Payroll",
    });
    expect(e.kind).toBe("deposit");
    expect(e.amount.value).toBe(50000n);
    expect(e.payee).toBe("Payroll");
  });
});
