// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { describe, expect, it } from "vitest";
import {
  AmountMismatchError,
  addAmount,
  compareAmount,
  equalAmount,
  formatAmount,
  formatAmountValue,
  makeAmount,
  negateAmount,
  parseAmount,
  signAmount,
  sumAmounts,
} from "../src/decimal.js";
import { asCurrency } from "../src/types.js";

const USD = asCurrency("USD");
const EUR = asCurrency("EUR");

describe("makeAmount", () => {
  it("constructs a valid amount", () => {
    const a = makeAmount(150n, USD, 2);
    expect(a.value).toBe(150n);
    expect(a.scale).toBe(2);
    expect(a.currency).toBe(USD);
  });

  it("rejects out-of-range scale", () => {
    expect(() => makeAmount(0n, USD, -1)).toThrow(AmountMismatchError);
    expect(() => makeAmount(0n, USD, 19)).toThrow(AmountMismatchError);
    expect(() => makeAmount(0n, USD, 1.5)).toThrow(AmountMismatchError);
  });
});

describe("parseAmount", () => {
  it("parses positive decimals", () => {
    expect(parseAmount("1.50", USD, 2).value).toBe(150n);
    expect(parseAmount("0.01", USD, 2).value).toBe(1n);
    expect(parseAmount("1000000.00", USD, 2).value).toBe(100000000n);
  });

  it("parses negatives", () => {
    expect(parseAmount("-0.05", USD, 2).value).toBe(-5n);
  });

  it("pads when scale exceeds input fractional length", () => {
    expect(parseAmount("1", USD, 2).value).toBe(100n);
    expect(parseAmount("1.5", USD, 4).value).toBe(15000n);
  });

  it("refuses inputs that would lose precision", () => {
    expect(() => parseAmount("1.234", USD, 2)).toThrow(AmountMismatchError);
  });

  it("refuses non-numeric strings", () => {
    expect(() => parseAmount("hello", USD, 2)).toThrow(AmountMismatchError);
    expect(() => parseAmount("1.2.3", USD, 2)).toThrow(AmountMismatchError);
  });
});

describe("formatAmount", () => {
  it("round-trips parse + format at the same scale", () => {
    const a = parseAmount("1234.56", USD, 2);
    expect(formatAmountValue(a)).toBe("1234.56");
    expect(formatAmount(a)).toBe("1234.56 USD");
  });

  it("handles zero scale", () => {
    expect(formatAmountValue(makeAmount(42n, USD, 0))).toBe("42");
  });

  it("preserves trailing zeros", () => {
    expect(formatAmountValue(parseAmount("1.50", USD, 2))).toBe("1.50");
  });

  it("formats negatives", () => {
    expect(formatAmountValue(parseAmount("-1.50", USD, 2))).toBe("-1.50");
  });
});

describe("addAmount", () => {
  it("adds amounts of matching currency + scale", () => {
    const a = parseAmount("0.10", USD, 2);
    const b = parseAmount("0.20", USD, 2);
    expect(formatAmountValue(addAmount(a, b))).toBe("0.30");
  });

  it("survives the IEEE-754 0.1 + 0.2 trap", () => {
    const sum = addAmount(parseAmount("0.1", USD, 18), parseAmount("0.2", USD, 18));
    expect(formatAmountValue(sum)).toBe("0.300000000000000000");
  });

  it("refuses currency mismatch", () => {
    expect(() => addAmount(parseAmount("1", USD, 2), parseAmount("1", EUR, 2))).toThrow(
      AmountMismatchError
    );
  });

  it("refuses scale mismatch", () => {
    expect(() => addAmount(makeAmount(1n, USD, 2), makeAmount(1n, USD, 4))).toThrow(
      AmountMismatchError
    );
  });
});

describe("negateAmount + compareAmount + equalAmount + signAmount", () => {
  it("negates", () => {
    const a = parseAmount("1.50", USD, 2);
    expect(formatAmountValue(negateAmount(a))).toBe("-1.50");
  });

  it("compares", () => {
    expect(compareAmount(parseAmount("1.00", USD, 2), parseAmount("2.00", USD, 2))).toBe(-1);
    expect(compareAmount(parseAmount("2.00", USD, 2), parseAmount("1.00", USD, 2))).toBe(1);
    expect(compareAmount(parseAmount("1.00", USD, 2), parseAmount("1.00", USD, 2))).toBe(0);
  });

  it("equals", () => {
    expect(equalAmount(parseAmount("1.00", USD, 2), parseAmount("1.00", USD, 2))).toBe(true);
    expect(equalAmount(parseAmount("1.00", USD, 2), makeAmount(100n, USD, 4))).toBe(false);
  });

  it("signs", () => {
    expect(signAmount(parseAmount("1.00", USD, 2))).toBe(1);
    expect(signAmount(parseAmount("-1.00", USD, 2))).toBe(-1);
    expect(signAmount(parseAmount("0.00", USD, 2))).toBe(0);
  });
});

describe("sumAmounts", () => {
  it("groups by (currency, scale)", () => {
    const sums = sumAmounts([
      parseAmount("1.00", USD, 2),
      parseAmount("2.00", USD, 2),
      parseAmount("3.00", EUR, 2),
    ]);
    expect(formatAmountValue(sums.get("USD@2")!)).toBe("3.00");
    expect(formatAmountValue(sums.get("EUR@2")!)).toBe("3.00");
  });

  it("returns zero entries when all amounts cancel", () => {
    const sums = sumAmounts([
      parseAmount("1.00", USD, 2),
      parseAmount("-1.00", USD, 2),
    ]);
    expect(sums.get("USD@2")!.value).toBe(0n);
  });
});
