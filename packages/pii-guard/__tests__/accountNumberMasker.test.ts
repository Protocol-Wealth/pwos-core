// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { describe, expect, it } from "vitest";
import {
  maskAccountNumber,
  maskAccountNumbersInText,
} from "../src/accountNumberMasker.js";

describe("maskAccountNumber", () => {
  it("masks a 16-digit account, revealing last 4", () => {
    expect(maskAccountNumber("1234567890123456")).toBe("•••• 3456");
  });

  it("strips internal hyphens and spaces before measuring", () => {
    expect(maskAccountNumber("1234-5678-9012-3456")).toBe("•••• 3456");
    expect(maskAccountNumber("1234 5678 9012 3456")).toBe("•••• 3456");
  });

  it("returns null for non-digit strings", () => {
    expect(maskAccountNumber("nope")).toBeNull();
    expect(maskAccountNumber("XYZ123")).toBeNull();
  });

  it("returns null when too short to reveal the requested tail", () => {
    expect(maskAccountNumber("123", { reveal: 4 })).toBeNull();
  });

  it("respects custom reveal / maskLength / separator", () => {
    expect(
      maskAccountNumber("1234567890", { reveal: 2, maskLength: 6, separator: "-" })
    ).toBe("••••••-90");
  });

  it("works for short shorts (5+ digits with reveal 4)", () => {
    expect(maskAccountNumber("12345")).toBe("•••• 2345");
  });
});

describe("maskAccountNumbersInText", () => {
  it("masks account-number-shaped runs inside text", () => {
    const out = maskAccountNumbersInText(
      "Pls confirm transfer to 1234-5678-9012-3456 by EOD"
    );
    expect(out).toContain("•••• 3456");
    expect(out).toContain("Pls confirm transfer to");
  });

  it("leaves shorter digit runs alone", () => {
    expect(maskAccountNumbersInText("Order #1234 confirmed")).toBe(
      "Order #1234 confirmed"
    );
  });

  it("masks multiple account numbers in the same message", () => {
    const out = maskAccountNumbersInText(
      "Source 1111-2222-3333-4444; Destination 9999-8888-7777-6666"
    );
    expect(out).toContain("•••• 4444");
    expect(out).toContain("•••• 6666");
  });
});
