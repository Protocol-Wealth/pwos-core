// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { describe, expect, it } from "vitest";
import {
  asAccountName,
  isValidAccountName,
  naturalSign,
  parseAccountName,
  rootOf,
} from "../src/account.js";

describe("parseAccountName", () => {
  it("accepts the five canonical roots", () => {
    expect(parseAccountName("Assets:US:Checking")?.root).toBe("Assets");
    expect(parseAccountName("Liabilities:CreditCard")?.root).toBe("Liabilities");
    expect(parseAccountName("Equity:Opening")?.root).toBe("Equity");
    expect(parseAccountName("Income:Salary")?.root).toBe("Income");
    expect(parseAccountName("Expenses:Food")?.root).toBe("Expenses");
  });

  it("returns the segments", () => {
    const out = parseAccountName("Assets:US:BofA:Checking");
    expect(out?.segments).toEqual(["Assets", "US", "BofA", "Checking"]);
  });

  it("rejects invalid roots", () => {
    expect(parseAccountName("Foo:Bar")).toBeNull();
  });

  it("rejects empty segments", () => {
    expect(parseAccountName("Assets::Checking")).toBeNull();
    expect(parseAccountName(":Assets:Checking")).toBeNull();
    expect(parseAccountName("Assets:Checking:")).toBeNull();
  });

  it("rejects whitespace and punctuation in segments", () => {
    expect(parseAccountName("Assets:US :Checking")).toBeNull();
    expect(parseAccountName("Assets:US/Checking")).toBeNull();
  });
});

describe("isValidAccountName + asAccountName", () => {
  it("isValidAccountName narrows correctly", () => {
    expect(isValidAccountName("Assets:Checking")).toBe(true);
    expect(isValidAccountName("nope")).toBe(false);
  });

  it("asAccountName brands valid + throws on invalid", () => {
    expect(asAccountName("Assets:Cash")).toBe("Assets:Cash");
    expect(() => asAccountName("nope")).toThrow();
  });
});

describe("rootOf + naturalSign", () => {
  it("extracts the root", () => {
    expect(rootOf(asAccountName("Assets:Cash"))).toBe("Assets");
    expect(rootOf(asAccountName("Liabilities:CreditCard"))).toBe("Liabilities");
  });

  it("returns the natural sign", () => {
    expect(naturalSign("Assets")).toBe(1);
    expect(naturalSign("Expenses")).toBe(1);
    expect(naturalSign("Liabilities")).toBe(-1);
    expect(naturalSign("Equity")).toBe(-1);
    expect(naturalSign("Income")).toBe(-1);
  });
});
