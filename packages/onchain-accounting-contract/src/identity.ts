// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

const IDENTITY_KEYS = new Set([
  "name",
  "firstname",
  "lastname",
  "fullname",
  "dob",
  "dateofbirth",
  "birthdate",
  "ssn",
  "taxid",
  "email",
  "phone",
  "address",
  "clientid",
  "clientref",
  "client",
  "householdid",
  "householdref",
  "customerid",
  "personid",
  "personref",
  "walletaddress",
  "wallet",
]);

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Find identity-shaped keys using the same recursive rule as Nexus v0.2.0. */
export function findAccountingIdentityKeys(payload: unknown): string[] {
  const found: string[] = [];
  const seen = new WeakSet<object>();

  const scan = (node: unknown): void => {
    if (typeof node !== "object" || node === null) return;
    if (seen.has(node)) return;
    seen.add(node);

    if (Array.isArray(node)) {
      for (const item of node) scan(item);
      return;
    }

    for (const [key, value] of Object.entries(node)) {
      if (IDENTITY_KEYS.has(normalizeKey(key))) found.push(key);
      scan(value);
    }
  };

  scan(payload);
  return found;
}

/** Error raised before parsing when an accounting request carries identity keys. */
export class AccountingIdentityKeyError extends Error {
  readonly keys: readonly string[];

  constructor(keys: readonly string[]) {
    super(`identity fields are not accepted by the PII-free accounting contract: ${keys.join(", ")}`);
    this.name = "AccountingIdentityKeyError";
    this.keys = [...keys];
  }
}

/** Enforce the public-safe, de-identified request boundary before dispatch. */
export function assertAccountingPayloadPiiFree(payload: unknown): void {
  const keys = [...new Set(findAccountingIdentityKeys(payload))].sort();
  if (keys.length > 0) throw new AccountingIdentityKeyError(keys);
}
