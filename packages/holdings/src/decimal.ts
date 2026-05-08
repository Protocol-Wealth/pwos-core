// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Decimal helpers — same shape as `@protocolwealthos/ledger`'s
 * `decimal.ts`. Duplicated here (rather than depending on ledger) so
 * holdings is independently usable. Scale + currency must match for
 * arithmetic to succeed; mixing is a programmer error.
 */

import type { Currency, MoneyAmount } from "./types.js";

export class AmountMismatchError extends Error {
  constructor(detail: string) {
    super(`amount operation refused: ${detail}`);
    this.name = "AmountMismatchError";
  }
}

export function makeAmount(
  value: bigint,
  currency: Currency,
  scale: number
): MoneyAmount {
  if (!Number.isInteger(scale) || scale < 0 || scale > 18) {
    throw new AmountMismatchError(`scale must be an integer in [0, 18]; got ${scale}`);
  }
  return { value, scale, currency };
}

export function zeroAmount(currency: Currency, scale: number): MoneyAmount {
  return makeAmount(0n, currency, scale);
}

export function addAmount(a: MoneyAmount, b: MoneyAmount): MoneyAmount {
  if (a.currency !== b.currency) {
    throw new AmountMismatchError(
      `currency mismatch: ${a.currency} vs ${b.currency}`
    );
  }
  if (a.scale !== b.scale) {
    throw new AmountMismatchError(`scale mismatch: ${a.scale} vs ${b.scale}`);
  }
  return makeAmount(a.value + b.value, a.currency, a.scale);
}

export function negateAmount(a: MoneyAmount): MoneyAmount {
  return makeAmount(-a.value, a.currency, a.scale);
}

export function parseAmount(
  input: string,
  currency: Currency,
  scale: number
): MoneyAmount {
  const trimmed = input.trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    throw new AmountMismatchError(`not a decimal string: "${input}"`);
  }
  const negative = trimmed.startsWith("-");
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const [intPart, fracPart = ""] = unsigned.split(".");
  if (fracPart.length > scale) {
    throw new AmountMismatchError(
      `input "${input}" has ${fracPart.length} decimal places; target scale is ${scale}`
    );
  }
  const padded = fracPart.padEnd(scale, "0");
  const digits = (intPart === "" ? "0" : intPart) + padded;
  let value = BigInt(digits);
  if (negative) value = -value;
  return makeAmount(value, currency, scale);
}
