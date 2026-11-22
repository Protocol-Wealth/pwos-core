// SPDX-License-Identifier: MIT-0 OR Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { describe, expect, it } from "vitest";
import {
  AmountMismatchError,
  addAmount,
  makeAmount,
  negateAmount,
  parseAmount,
  zeroAmount,
} from "../src/decimal.js";
import type { Currency } from "../src/types.js";

const USD = "USD" as Currency;
const EUR = "EUR" as Currency;

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

describe("zeroAmount", () => {
  it("returns a zero value at the requested scale", () => {
    const z = zeroAmount(USD, 2);
    expect(z.value).toBe(0n);
    expect(z.scale).toBe(2);
    expect(z.currency).toBe(USD);
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

describe("addAmount", () => {
  it("adds amounts of matching currency + scale", () => {
    const a = parseAmount("0.10", USD, 2);
    const b = parseAmount("0.20", USD, 2);
    expect(addAmount(a, b).value).toBe(30n);
  });

  it("survives the IEEE-754 0.1 + 0.2 trap", () => {
    const sum = addAmount(parseAmount("0.1", USD, 18), parseAmount("0.2", USD, 18));
    expect(sum.value).toBe(300000000000000000n);
  });

  it("refuses currency mismatch", () => {
    expect(() => addAmount(parseAmount("1", USD, 2), parseAmount("1", EUR, 2))).toThrow(
      AmountMismatchError,
    );
  });

  it("refuses scale mismatch", () => {
    expect(() => addAmount(makeAmount(1n, USD, 2), makeAmount(1n, USD, 4))).toThrow(
      AmountMismatchError,
    );
  });
});

describe("negateAmount", () => {
  it("negates", () => {
    expect(negateAmount(parseAmount("1.50", USD, 2)).value).toBe(-150n);
    expect(negateAmount(parseAmount("-1.50", USD, 2)).value).toBe(150n);
  });
});
