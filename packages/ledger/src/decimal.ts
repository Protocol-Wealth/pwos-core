// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Fixed-point decimal arithmetic for ledger amounts.
 *
 * Why not `number`: IEEE-754 binary floating point can't represent
 * `0.1 + 0.2` exactly, which makes "every transaction balances"
 * unverifiable. An audit-grade ledger needs exact decimal arithmetic.
 *
 * Why not a third-party `Decimal` library: zero-dep is load-bearing
 * for an OSS package consumers will audit. We use `bigint` underneath
 * with an explicit `scale` (decimal places) — the standard fixed-point
 * representation. Same shape Stripe's Money type and most accounting
 * systems use.
 *
 * `Amount = { value: bigint, scale: number, currency: Currency }`
 *
 * Operations require matching `scale` and `currency`. Mixing scales is
 * a programmer error, not a silent rescale.
 */

import type { Amount, Currency } from "./types.js";

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
): Amount {
  if (!Number.isInteger(scale) || scale < 0 || scale > 18) {
    throw new AmountMismatchError(`scale must be an integer in [0, 18]; got ${scale}`);
  }
  return { value, scale, currency };
}

/** Zero amount of given currency at given scale. */
export function zeroAmount(currency: Currency, scale: number): Amount {
  return makeAmount(0n, currency, scale);
}

/** Add two amounts. Throws if currency or scale differ. */
export function addAmount(a: Amount, b: Amount): Amount {
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

/** Negate an amount. */
export function negateAmount(a: Amount): Amount {
  return makeAmount(-a.value, a.currency, a.scale);
}

/** Compare two amounts. Throws on mismatched currency/scale. */
export function compareAmount(a: Amount, b: Amount): number {
  if (a.currency !== b.currency || a.scale !== b.scale) {
    throw new AmountMismatchError(
      `cannot compare ${a.currency}@${a.scale} with ${b.currency}@${b.scale}`
    );
  }
  if (a.value < b.value) return -1;
  if (a.value > b.value) return 1;
  return 0;
}

/** True if both amounts are exactly equal (currency + scale + value). */
export function equalAmount(a: Amount, b: Amount): boolean {
  return a.currency === b.currency && a.scale === b.scale && a.value === b.value;
}

/** Sign of an amount: -1, 0, or 1. */
export function signAmount(a: Amount): number {
  if (a.value < 0n) return -1;
  if (a.value > 0n) return 1;
  return 0;
}

/** Absolute value. */
export function absAmount(a: Amount): Amount {
  return makeAmount(a.value < 0n ? -a.value : a.value, a.currency, a.scale);
}

/**
 * Parse a decimal string into an Amount. Examples:
 *   parseAmount("1.50", "USD" as Currency, 2) → { value: 150n, scale: 2, currency: "USD" }
 *   parseAmount("0.001", "AAPL" as Currency, 4) → { value: 10n, scale: 4, currency: "AAPL" }
 *
 * Refuses inputs whose scale exceeds the target scale (would lose precision).
 */
export function parseAmount(
  input: string,
  currency: Currency,
  scale: number
): Amount {
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

/** Format an Amount as a decimal string (without currency). */
export function formatAmountValue(a: Amount): string {
  const negative = a.value < 0n;
  const unsigned = negative ? -a.value : a.value;
  const digits = unsigned.toString().padStart(a.scale + 1, "0");
  if (a.scale === 0) return (negative ? "-" : "") + digits;
  const cut = digits.length - a.scale;
  const intPart = digits.slice(0, cut);
  const fracPart = digits.slice(cut);
  return (negative ? "-" : "") + intPart + "." + fracPart;
}

/** Format an Amount with currency suffix: "1.50 USD". */
export function formatAmount(a: Amount): string {
  return `${formatAmountValue(a)} ${a.currency}`;
}

/**
 * Sum amounts, grouped by (currency, scale). Returns a map keyed by
 * `${currency}@${scale}`. Used by the transaction validator to compute
 * the per-currency residual.
 */
export function sumAmounts(
  amounts: readonly Amount[]
): Map<string, Amount> {
  const out = new Map<string, Amount>();
  for (const a of amounts) {
    const key = `${a.currency}@${a.scale}`;
    const prev = out.get(key);
    out.set(key, prev ? addAmount(prev, a) : a);
  }
  return out;
}
