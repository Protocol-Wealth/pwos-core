// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { describe, expect, it } from "vitest";
import {
  activeGoals,
  currentHouseholdProfile,
  staleProfiles,
} from "../src/householdProfile.js";
import type { HouseholdGoal, HouseholdProfile } from "../src/householdProfile.js";

const baseProfile = (overrides: Partial<HouseholdProfile> = {}): HouseholdProfile => ({
  id: "p1",
  householdId: "hh1",
  effectiveAt: "2026-05-01T00:00:00Z",
  recordedAt: "2026-05-01T00:00:00Z",
  recordedBy: "advisor_a",
  ...overrides,
});

const baseGoal = (overrides: Partial<HouseholdGoal> = {}): HouseholdGoal => ({
  id: "g1",
  householdId: "hh1",
  kind: "retirement",
  title: "Retire at 60",
  currency: "USD",
  priority: "primary",
  status: "active",
  createdAt: "2026-05-01",
  updatedAt: "2026-05-01",
  ...overrides,
});

describe("currentHouseholdProfile", () => {
  it("returns undefined for empty input", () => {
    expect(currentHouseholdProfile([])).toBeUndefined();
  });

  it("picks the latest by effectiveAt", () => {
    const v1 = baseProfile({ id: "p1", effectiveAt: "2026-01-01T00:00:00Z" });
    const v2 = baseProfile({ id: "p2", effectiveAt: "2026-05-01T00:00:00Z" });
    const v3 = baseProfile({ id: "p3", effectiveAt: "2026-03-01T00:00:00Z" });
    expect(currentHouseholdProfile([v1, v2, v3])?.id).toBe("p2");
  });
});

describe("activeGoals", () => {
  it("returns only active goals for the household", () => {
    const goals = [
      baseGoal({ id: "g1", status: "active" }),
      baseGoal({ id: "g2", status: "achieved" }),
      baseGoal({ id: "g3", status: "active", householdId: "hh2" }),
    ];
    const out = activeGoals(goals, "hh1");
    expect(out).toHaveLength(1);
    expect(out[0]!.id).toBe("g1");
  });
});

describe("staleProfiles", () => {
  it("flags households whose latest profile is older than threshold", () => {
    const profiles = [
      baseProfile({ id: "p1", householdId: "hh_old", effectiveAt: "2025-01-01T00:00:00Z" }),
      baseProfile({ id: "p2", householdId: "hh_recent", effectiveAt: "2026-04-15T00:00:00Z" }),
    ];
    const stale = staleProfiles(profiles, "2026-05-08T00:00:00Z", 90);
    expect(stale).toEqual(["hh_old"]);
  });

  it("uses the latest version per household", () => {
    const profiles = [
      baseProfile({ id: "p1", householdId: "hh", effectiveAt: "2025-01-01T00:00:00Z" }),
      baseProfile({ id: "p2", householdId: "hh", effectiveAt: "2026-05-01T00:00:00Z" }),
    ];
    expect(staleProfiles(profiles, "2026-05-08T00:00:00Z", 90)).toEqual([]);
  });
});
