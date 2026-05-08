// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { describe, expect, it } from "vitest";
import {
  ApproverSeparationError,
  assertApprovedByDifferentParty,
  isApprovedByDifferentParty,
} from "../src/approverSeparation.js";

describe("isApprovedByDifferentParty", () => {
  it("true when author and reviewer differ", () => {
    expect(
      isApprovedByDifferentParty({ authorId: "a@e.com", reviewerId: "b@e.com" })
    ).toBe(true);
  });

  it("false when they match (case-insensitive default)", () => {
    expect(
      isApprovedByDifferentParty({
        authorId: "Author@E.com",
        reviewerId: "author@e.com",
      })
    ).toBe(false);
  });

  it("respects normalize:false for opaque ids", () => {
    expect(
      isApprovedByDifferentParty({
        authorId: "u_1",
        reviewerId: "U_1",
        normalize: false,
      })
    ).toBe(true);
  });
});

describe("assertApprovedByDifferentParty", () => {
  it("throws ApproverSeparationError on match", () => {
    expect(() =>
      assertApprovedByDifferentParty({ authorId: "x", reviewerId: "x" })
    ).toThrow(ApproverSeparationError);
  });

  it("does not throw when they differ", () => {
    expect(() =>
      assertApprovedByDifferentParty({ authorId: "x", reviewerId: "y" })
    ).not.toThrow();
  });
});
