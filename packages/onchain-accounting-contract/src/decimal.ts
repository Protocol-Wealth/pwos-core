// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { z } from "zod";

const DECIMAL_PATTERN = /^[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?$/;

/** Defensive lexical bound; canonical v0.2.0 values fit comfortably below it. */
export const MAX_ACCOUNTING_DECIMAL_STRING_LENGTH = 512;

interface DecimalEnvelope {
  maxScale: number;
  maxIntegerDigits: number;
}

interface DecimalParts {
  coefficient: bigint;
  decimalExponent: bigint;
  negative: boolean;
  zero: boolean;
}

function decimalParts(value: string): DecimalParts | null {
  if (value.length > MAX_ACCOUNTING_DECIMAL_STRING_LENGTH) return null;
  const match = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/.exec(value);
  if (!match) return null;

  const integer = match[2] ?? "";
  const fraction = match[3] ?? match[4] ?? "";
  const digits = `${integer}${fraction}`;
  const significant = digits.replace(/^0+/, "") || "0";

  try {
    return {
      coefficient: BigInt(significant),
      decimalExponent: BigInt(match[5] ?? "0") - BigInt(fraction.length),
      negative: match[1] === "-",
      zero: significant === "0",
    };
  } catch {
    return null;
  }
}

function validateEnvelope(value: string, envelope: DecimalEnvelope): string | null {
  const parts = decimalParts(value);
  if (!parts) return "must be a finite decimal string";

  const maxScale = BigInt(envelope.maxScale);
  const maxIntegerDigits = BigInt(envelope.maxIntegerDigits);
  if (parts.decimalExponent < -maxScale) {
    return `supports at most ${envelope.maxScale} fractional digits`;
  }
  if (parts.decimalExponent > maxIntegerDigits) {
    return "decimal exponent exceeds the supported magnitude";
  }

  const coefficientDigits = BigInt(parts.coefficient.toString().length);
  const integerDigits = parts.zero
    ? 0n
    : coefficientDigits + parts.decimalExponent > 0n
      ? coefficientDigits + parts.decimalExponent
      : 0n;
  if (integerDigits > maxIntegerDigits) {
    return `supports at most ${envelope.maxIntegerDigits} integer digits`;
  }
  if (coefficientDigits > maxIntegerDigits + maxScale) {
    return "decimal coefficient exceeds the supported precision";
  }
  return null;
}

function decimalSchema(
  envelope: DecimalEnvelope,
  sign: "signed" | "nonnegative" | "positive",
): z.ZodString {
  return z
    .string()
    .max(MAX_ACCOUNTING_DECIMAL_STRING_LENGTH, "decimal string is too long")
    .regex(DECIMAL_PATTERN, "must be a finite decimal string")
    .superRefine((value, context) => {
      const message = validateEnvelope(value, envelope);
      if (message) context.addIssue({ code: "custom", message });

      const parts = decimalParts(value);
      if (!parts) return;
      if (sign !== "signed" && parts.negative && !parts.zero) {
        context.addIssue({ code: "custom", message: "must be non-negative" });
      }
      if (sign === "positive" && parts.zero) {
        context.addIssue({ code: "custom", message: "must be greater than zero" });
      }
    });
}

const DIRECT_ENVELOPE = { maxScale: 36, maxIntegerDigits: 42 } as const;
const TOTAL_ENVELOPE = { maxScale: 72, maxIntegerDigits: 84 } as const;
const DERIVED_ENVELOPE = { maxScale: 256, maxIntegerDigits: 128 } as const;

/** Positive quantity in the direct v0.2.0 wire envelope. */
export const positiveAccountingDecimalSchema = decimalSchema(DIRECT_ENVELOPE, "positive");

/** Non-negative quantity or unit price in the direct v0.2.0 wire envelope. */
export const nonNegativeAccountingDecimalSchema = decimalSchema(
  DIRECT_ENVELOPE,
  "nonnegative",
);

/** Non-negative explicit monetary total in the v0.2.0 wire envelope. */
export const nonNegativeAccountingTotalSchema = decimalSchema(TOTAL_ENVELOPE, "nonnegative");

/** Signed authoritative/replayed result in the derived v0.2.0 envelope. */
export const signedDerivedAccountingDecimalSchema = decimalSchema(DERIVED_ENVELOPE, "signed");

/** Non-negative authoritative/replayed result in the derived v0.2.0 envelope. */
export const nonNegativeDerivedAccountingDecimalSchema = decimalSchema(
  DERIVED_ENVELOPE,
  "nonnegative",
);

/** Positive authoritative/replayed quantity in the derived v0.2.0 envelope. */
export const positiveDerivedAccountingDecimalSchema = decimalSchema(DERIVED_ENVELOPE, "positive");

function canonicalDecimal(value: string): DecimalParts | null {
  const parsed = decimalParts(value);
  if (!parsed) return null;
  if (parsed.zero) return { ...parsed, coefficient: 0n, decimalExponent: 0n, negative: false };

  let coefficient = parsed.coefficient;
  let decimalExponent = parsed.decimalExponent;
  while (coefficient % 10n === 0n) {
    coefficient /= 10n;
    decimalExponent += 1n;
  }
  return { ...parsed, coefficient, decimalExponent };
}

function canonicalProduct(values: readonly string[]): DecimalParts | null {
  let coefficient = 1n;
  let decimalExponent = 0n;
  let negative = false;
  for (const value of values) {
    const parsed = decimalParts(value);
    if (!parsed) return null;
    if (parsed.zero) {
      return { coefficient: 0n, decimalExponent: 0n, negative: false, zero: true };
    }
    coefficient *= parsed.coefficient;
    decimalExponent += parsed.decimalExponent;
    negative = negative !== parsed.negative;
  }
  while (coefficient % 10n === 0n) {
    coefficient /= 10n;
    decimalExponent += 1n;
  }
  return { coefficient, decimalExponent, negative, zero: coefficient === 0n };
}

function decimalPartsLessThanOrEqual(a: DecimalParts, b: DecimalParts): boolean {
  if (a.negative !== b.negative) return a.negative;
  const commonExponent = a.decimalExponent < b.decimalExponent ? a.decimalExponent : b.decimalExponent;
  const leftDelta = a.decimalExponent - commonExponent;
  const rightDelta = b.decimalExponent - commonExponent;
  if (leftDelta > 512n || rightDelta > 512n) return false;
  const leftScaled = a.coefficient * 10n ** leftDelta;
  const rightScaled = b.coefficient * 10n ** rightDelta;
  return a.negative ? leftScaled >= rightScaled : leftScaled <= rightScaled;
}

function signedCoefficient(parts: DecimalParts): bigint {
  return parts.negative ? -parts.coefficient : parts.coefficient;
}

function exactDecimalLinearCombinationEquals(
  positive: readonly string[],
  negative: readonly string[],
  expected: string,
): boolean {
  const positiveParts = positive.map(canonicalDecimal);
  const negativeParts = negative.map(canonicalDecimal);
  const target = canonicalDecimal(expected);
  if (
    target === null ||
    positiveParts.some((part) => part === null) ||
    negativeParts.some((part) => part === null)
  ) {
    return false;
  }

  const parts = [
    ...(positiveParts as DecimalParts[]),
    ...(negativeParts as DecimalParts[]),
    target,
  ];
  const commonExponent = parts.reduce(
    (minimum, part) =>
      part.decimalExponent < minimum ? part.decimalExponent : minimum,
    parts[0]?.decimalExponent ?? 0n,
  );
  if (parts.some((part) => part.decimalExponent - commonExponent > 512n)) return false;

  const scale = (part: DecimalParts): bigint =>
    signedCoefficient(part) * 10n ** (part.decimalExponent - commonExponent);
  const total = (positiveParts as DecimalParts[]).reduce(
    (sum, part) => sum + scale(part),
    0n,
  );
  const deductions = (negativeParts as DecimalParts[]).reduce(
    (sum, part) => sum + scale(part),
    0n,
  );
  return total - deductions === scale(target);
}

/** Exact represented-decimal equality without converting through a JS number. */
export function accountingDecimalStringsEqual(left: string, right: string): boolean {
  const a = canonicalDecimal(left);
  const b = canonicalDecimal(right);
  return (
    a !== null &&
    b !== null &&
    a.coefficient === b.coefficient &&
    a.decimalExponent === b.decimalExponent &&
    a.negative === b.negative
  );
}

/** Exact `left * right === expected` check without floating-point arithmetic. */
export function accountingDecimalProductEquals(
  left: string,
  right: string,
  expected: string,
): boolean {
  const product = canonicalProduct([left, right]);
  const target = canonicalDecimal(expected);
  return (
    product !== null &&
    target !== null &&
    product.coefficient === target.coefficient &&
    product.decimalExponent === target.decimalExponent &&
    product.negative === target.negative
  );
}

/** Exact decimal ordering for values already accepted by an exported schema. */
export function accountingDecimalLessThanOrEqual(left: string, right: string): boolean {
  const a = canonicalDecimal(left);
  const b = canonicalDecimal(right);
  if (!a || !b) return false;
  return decimalPartsLessThanOrEqual(a, b);
}

/** Exact product ordering for derived basis/fee comparisons. */
export function accountingDecimalProductsLessThanOrEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  const a = canonicalProduct(left);
  const b = canonicalProduct(right);
  return a !== null && b !== null && decimalPartsLessThanOrEqual(a, b);
}

/** Exact represented-decimal sum equality, including the empty sum as zero. */
export function accountingDecimalSumEquals(
  values: readonly string[],
  expected: string,
): boolean {
  return exactDecimalLinearCombinationEquals(values, [], expected);
}

/** Exact `minuend - subtrahend === expected` without floating-point arithmetic. */
export function accountingDecimalSubtractEquals(
  minuend: string,
  subtrahend: string,
  expected: string,
): boolean {
  return exactDecimalLinearCombinationEquals([minuend], [subtrahend], expected);
}

/** Whether an exact product fits the authoritative replay/result envelope. */
export function accountingDecimalProductFitsDerivedEnvelope(values: readonly string[]): boolean {
  let coefficient = 1n;
  let decimalExponent = 0n;
  let zero = false;
  for (const value of values) {
    const parsed = decimalParts(value);
    if (!parsed) return false;
    coefficient *= parsed.coefficient;
    decimalExponent += parsed.decimalExponent;
    zero ||= parsed.zero;
  }
  // Nexus exact_decimal_multiply canonicalizes a zero operand to Decimal(0)
  // before enforcing the result envelope, irrespective of operand scale.
  if (zero) return true;
  const coefficientDigits = BigInt(coefficient.toString().length);
  const integerDigits =
    coefficientDigits + decimalExponent > 0n ? coefficientDigits + decimalExponent : 0n;
  return (
    decimalExponent >= -256n &&
    decimalExponent <= 128n &&
    integerDigits <= 128n &&
    coefficientDigits <= 384n
  );
}

export type AccountingDecimalString = z.infer<typeof signedDerivedAccountingDecimalSchema>;
