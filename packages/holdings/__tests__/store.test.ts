// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { describe, expect, it } from "vitest";
import { parseAmount } from "../src/decimal.js";
import { buildCashEvent, buyEvent } from "../src/events.js";
import { InMemoryHoldingsStore } from "../src/store.js";
import type {
  AccountId,
  AdvisorAccess,
  Currency,
  EventId,
  FirmId,
  HouseholdId,
  PrincipalId,
  SecurityId,
} from "../src/types.js";

const USD = "USD" as Currency;
const firm = "firm_1" as FirmId;
const household = "hh_1" as HouseholdId;
const account = "acc_1" as AccountId;
const advisor = "p_advisor" as PrincipalId;
const aapl = "sec_aapl" as SecurityId;

async function fresh(): Promise<InMemoryHoldingsStore> {
  const s = new InMemoryHoldingsStore();
  await s.upsertAccount({
    id: account,
    firmId: firm,
    householdId: household,
    kind: "brokerage",
    displayName: "Schwab Brokerage",
    currency: USD,
    status: "active",
    openedOn: "2026-01-01",
    ownerPrincipalId: advisor,
    meta: {},
  });
  return s;
}

describe("InMemoryHoldingsStore — accounts", () => {
  it("upserts and retrieves an account", async () => {
    const s = await fresh();
    const got = await s.getAccount(account);
    expect(got?.kind).toBe("brokerage");
  });

  it("lists accounts by household", async () => {
    const s = await fresh();
    const list = await s.listAccountsForHousehold(household);
    expect(list).toHaveLength(1);
  });
});

describe("InMemoryHoldingsStore — events", () => {
  it("appends a holding event", async () => {
    const s = await fresh();
    const r = await s.appendHoldingEvent(
      buyEvent({
        id: "ev_1" as EventId,
        accountId: account,
        occurredOn: "2026-05-01",
        securityId: aapl,
        qtyDelta: 100n,
        qtyScale: 0,
        cashDelta: parseAmount("-15000.00", USD, 2),
        costBasisDelta: parseAmount("15000.00", USD, 2),
      })
    );
    expect(r.ok).toBe(true);
  });

  it("refuses duplicate event ids", async () => {
    const s = await fresh();
    const ev = buyEvent({
      id: "ev_1" as EventId,
      accountId: account,
      occurredOn: "2026-05-01",
      securityId: aapl,
      qtyDelta: 100n,
      qtyScale: 0,
      cashDelta: parseAmount("-15000.00", USD, 2),
      costBasisDelta: parseAmount("15000.00", USD, 2),
    });
    await s.appendHoldingEvent(ev);
    const dup = await s.appendHoldingEvent(ev);
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.error.code).toBe("duplicate_id");
  });

  it("enforces idempotency on (accountId, sourceId, externalId)", async () => {
    const s = await fresh();
    const ev1 = buyEvent({
      id: "ev_1" as EventId,
      accountId: account,
      occurredOn: "2026-05-01",
      securityId: aapl,
      qtyDelta: 100n,
      qtyScale: 0,
      cashDelta: parseAmount("-15000.00", USD, 2),
      sourceId: "plaid",
      externalId: "plaid_tx_999",
    });
    await s.appendHoldingEvent(ev1);

    const ev2 = buyEvent({
      id: "ev_2" as EventId,
      accountId: account,
      occurredOn: "2026-05-01",
      securityId: aapl,
      qtyDelta: 100n,
      qtyScale: 0,
      cashDelta: parseAmount("-15000.00", USD, 2),
      sourceId: "plaid",
      externalId: "plaid_tx_999", // same external
    });
    const r = await s.appendHoldingEvent(ev2);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("idempotency_conflict");
  });

  it("filters event lists by accountId + date", async () => {
    const s = await fresh();
    for (const [i, date] of [
      [1, "2026-04-01"],
      [2, "2026-05-08"],
      [3, "2026-06-15"],
    ] as const) {
      await s.appendHoldingEvent(
        buyEvent({
          id: `ev_${i}` as EventId,
          accountId: account,
          occurredOn: date,
          securityId: aapl,
          qtyDelta: 1n,
          qtyScale: 0,
          cashDelta: parseAmount("-100.00", USD, 2),
        })
      );
    }
    const may = await s.listHoldingEvents({ startDate: "2026-05-01", endDate: "2026-05-31" });
    expect(may).toHaveLength(1);
    expect(may[0]!.id).toBe("ev_2");
  });

  it("appends cash events", async () => {
    const s = await fresh();
    const r = await s.appendCashEvent(
      buildCashEvent({
        id: "ev_1" as EventId,
        accountId: account,
        occurredOn: "2026-05-08",
        kind: "deposit",
        amount: parseAmount("500.00", USD, 2),
      })
    );
    expect(r.ok).toBe(true);
    const list = await s.listCashEvents({ accountId: account });
    expect(list).toHaveLength(1);
  });
});

describe("InMemoryHoldingsStore — access", () => {
  it("grants and revokes advisor access", async () => {
    const s = await fresh();
    const access: AdvisorAccess = {
      id: "acc_grant_1",
      principalId: advisor,
      scope: "household",
      scopeRef: household,
      permission: "manage",
      grantedBy: "p_owner" as PrincipalId,
      grantedAt: "2026-05-08T00:00:00Z",
      meta: {},
    };
    expect((await s.grantAccess(access)).ok).toBe(true);
    expect((await s.listAccessForPrincipal(advisor)).length).toBe(1);

    const revoked = await s.revokeAccess(
      "acc_grant_1",
      "p_owner" as PrincipalId,
      "2026-06-01T00:00:00Z"
    );
    expect(revoked.ok).toBe(true);
    if (revoked.ok) {
      expect(revoked.value.revokedAt).toBe("2026-06-01T00:00:00Z");
      expect(revoked.value.revokedBy).toBe("p_owner");
    }
  });
});
