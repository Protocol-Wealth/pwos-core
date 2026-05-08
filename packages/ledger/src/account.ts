// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import type { AccountName, AccountRoot } from "./types.js";

/**
 * Validate and parse a colon-delimited account name. Returns the root
 * type plus the path segments, or null if invalid.
 *
 * Valid names:
 *   - first segment ∈ {Assets, Liabilities, Equity, Income, Expenses}
 *   - each subsequent segment matches /^[A-Za-z0-9-_]+$/
 *   - no empty segments
 *   - no leading or trailing colons
 */
export function parseAccountName(
  name: string
): { root: AccountRoot; segments: string[] } | null {
  if (!name || name.includes("::") || name.startsWith(":") || name.endsWith(":")) {
    return null;
  }
  const segments = name.split(":");
  if (segments.length < 1) return null;
  const first = segments[0]!;
  if (
    first !== "Assets" &&
    first !== "Liabilities" &&
    first !== "Equity" &&
    first !== "Income" &&
    first !== "Expenses"
  ) {
    return null;
  }
  for (const seg of segments) {
    if (!seg || !/^[A-Za-z0-9_-]+$/.test(seg)) return null;
  }
  return { root: first as AccountRoot, segments };
}

export function isValidAccountName(name: string): name is AccountName {
  return parseAccountName(name) !== null;
}

/** Brand a validated string as an AccountName. Throws if invalid. */
export function asAccountName(name: string): AccountName {
  if (!isValidAccountName(name)) {
    throw new Error(`Invalid account name: "${name}"`);
  }
  return name as AccountName;
}

/** Extract the root from an account name. Assumes the name is valid. */
export function rootOf(name: AccountName): AccountRoot {
  const idx = name.indexOf(":");
  return (idx === -1 ? name : name.slice(0, idx)) as AccountRoot;
}

/** Sign convention by root: assets/expenses positive, liabilities/equity/income negative. */
export function naturalSign(root: AccountRoot): 1 | -1 {
  switch (root) {
    case "Assets":
    case "Expenses":
      return 1;
    case "Liabilities":
    case "Equity":
    case "Income":
      return -1;
  }
}
