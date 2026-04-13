// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
import { describe, expect, it } from "vitest";

import {
  groupByLifecycle,
  isOverdueTask,
  isStaleContact,
  isStalledOpportunity,
  overdueTasks,
  pipelineValueByStage,
  staleContacts,
  stalledOpportunities,
  type Contact,
  type CrmTask,
  type Opportunity,
} from "../src/index.js";

const now = new Date("2026-04-13T00:00:00Z");

function contact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: "c1",
    firstName: "Alex",
    lastName: "Advisor",
    kind: "client",
    createdAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

function task(overrides: Partial<CrmTask> = {}): CrmTask {
  return {
    id: "t1",
    title: "Follow up",
    status: "open",
    ...overrides,
  };
}

function opp(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: "o1",
    title: "New prospect",
    stage: "proposal",
    ...overrides,
  };
}

describe("Contact staleness", () => {
  it("stale when lastActivity is older than threshold", () => {
    expect(isStaleContact(contact({ lastActivityAt: "2024-01-01T00:00:00Z" }), 90, now)).toBe(true);
  });

  it("not stale when lastActivity is recent", () => {
    expect(isStaleContact(contact({ lastActivityAt: "2026-04-01T00:00:00Z" }), 90, now)).toBe(false);
  });

  it("falls back to createdAt when no lastActivity", () => {
    expect(isStaleContact(contact({ createdAt: "2024-01-01T00:00:00Z" }), 90, now)).toBe(true);
  });

  it("staleContacts filters down", () => {
    const contacts = [
      contact({ id: "a", lastActivityAt: "2026-04-01T00:00:00Z" }),
      contact({ id: "b", lastActivityAt: "2024-01-01T00:00:00Z" }),
    ];
    expect(staleContacts(contacts, 90, now).map((c) => c.id)).toEqual(["b"]);
  });
});

describe("Task overdue", () => {
  it("overdue when dueAt is past", () => {
    expect(isOverdueTask(task({ dueAt: "2026-01-01T00:00:00Z" }), now)).toBe(true);
  });

  it("not overdue when done", () => {
    expect(isOverdueTask(task({ dueAt: "2026-01-01T00:00:00Z", status: "done" }), now)).toBe(false);
  });

  it("not overdue when canceled", () => {
    expect(isOverdueTask(task({ dueAt: "2026-01-01T00:00:00Z", status: "canceled" }), now)).toBe(false);
  });

  it("not overdue when no dueAt", () => {
    expect(isOverdueTask(task({}), now)).toBe(false);
  });

  it("overdueTasks filters", () => {
    const tasks = [
      task({ id: "a", dueAt: "2026-01-01T00:00:00Z" }),
      task({ id: "b", dueAt: "2027-01-01T00:00:00Z" }),
    ];
    expect(overdueTasks(tasks, now).map((t) => t.id)).toEqual(["a"]);
  });
});

describe("Opportunity stalled", () => {
  it("stalled when expectedClose is past and still open", () => {
    expect(
      isStalledOpportunity(opp({ expectedCloseAt: "2026-01-01T00:00:00Z" }), now),
    ).toBe(true);
  });

  it("not stalled when won", () => {
    expect(
      isStalledOpportunity(opp({ expectedCloseAt: "2026-01-01T00:00:00Z", stage: "won" }), now),
    ).toBe(false);
  });

  it("not stalled when no expectedCloseAt", () => {
    expect(isStalledOpportunity(opp({}), now)).toBe(false);
  });

  it("stalledOpportunities filters", () => {
    const opps = [
      opp({ id: "a", expectedCloseAt: "2026-01-01T00:00:00Z" }),
      opp({ id: "b", expectedCloseAt: "2027-01-01T00:00:00Z" }),
      opp({ id: "c", stage: "won", expectedCloseAt: "2026-01-01T00:00:00Z" }),
    ];
    expect(stalledOpportunities(opps, now).map((o) => o.id)).toEqual(["a"]);
  });
});

describe("Aggregations", () => {
  it("groupByLifecycle counts correctly", () => {
    const contacts = [
      contact({ id: "a", lifecycleStage: "active" }),
      contact({ id: "b", lifecycleStage: "active" }),
      contact({ id: "c", lifecycleStage: "discovery" }),
      contact({ id: "d" }),
    ];
    expect(groupByLifecycle(contacts)).toEqual({
      active: 2,
      discovery: 1,
      unspecified: 1,
    });
  });

  it("pipelineValueByStage sums values", () => {
    const opps = [
      opp({ id: "a", stage: "proposal", value: 100 }),
      opp({ id: "b", stage: "proposal", value: 50 }),
      opp({ id: "c", stage: "won", value: 200 }),
      opp({ id: "d", stage: "lead" }), // no value
    ];
    expect(pipelineValueByStage(opps)).toEqual({ proposal: 150, won: 200 });
  });
});
