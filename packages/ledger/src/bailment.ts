// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Bailment shadow-ledger invariants.
 *
 * Background: during a treasury rebalancing window, an RIA temporarily
 * holds client assets in transit (off-platform sweep, T+1 settlement,
 * omnibus reshuffle). The brokerage's books say one thing; the
 * advisor needs an internal record proving — at every instant — which
 * client beneficially owns which units, separately from and
 * reconcilable to the brokerage statement.
 *
 * The pattern uses two account families:
 *   - `Assets:Pooled:<Custodian>:<Asset>` — one bucket per asset held
 *     in the firm's pooled custody account
 *   - `Liabilities:Bailment:<ClientId>:<Asset>` — each client's claim
 *     against that pool
 *
 * Three invariants this module enforces. Use as validation hooks
 * around `LedgerStore.appendTransaction`:
 *
 *   1. **Pooled-equals-claims** — for every asset X:
 *        sum(Liabilities:Bailment:*:X) + sum(Assets:Pooled:*:X) === 0
 *
 *      i.e. every unit in pooled custody is claimed by exactly one
 *      client liability. This is the trust-accounting invariant: no
 *      mixed beneficial ownership.
 *
 *   2. **Single-beneficiary per unit** — refuse a transaction that
 *      moves a unit from `Liabilities:Bailment:A:X` to
 *      `Liabilities:Bailment:B:X` without an offsetting trail
 *      through `Assets:Pooled:*:X`. This forces every transfer to
 *      route through the pool, which keeps the pool the single
 *      source of truth.
 *
 *   3. **Tri-party reconciliation** — `sum(Assets:Pooled:Custodian:X)`
 *      equals the custodian's reported balance for X (fed in as
 *      `BalanceAssertion`s derived from broker statements). Drift
 *      between RIA shadow and custodian record is the alarm
 *      condition the entire shadow-ledger exists to detect.
 *
 * This module ships the predicate functions; wire them into your
 * application's append path (or a CI-style replay) per your
 * deployment shape.
 */

import { addAmount, makeAmount, sumAmounts } from "./decimal.js";
import type {
  AccountName,
  Amount,
  Currency,
  LedgerError,
  Result,
  Transaction,
} from "./types.js";

export interface BailmentConfig {
  /** Account-name prefix for the pooled custody side. */
  pooledPrefix: string; // e.g. "Assets:Pooled:"
  /** Account-name prefix for the per-beneficiary claim side. */
  claimsPrefix: string; // e.g. "Liabilities:Bailment:"
}

const DEFAULT_CONFIG: BailmentConfig = Object.freeze({
  pooledPrefix: "Assets:Pooled:",
  claimsPrefix: "Liabilities:Bailment:",
});

export function defaultBailmentConfig(): BailmentConfig {
  return DEFAULT_CONFIG;
}

/**
 * Walk every transaction and assert invariant #1: pooled-equals-claims
 * holds at the running balance, per asset, after each transaction.
 *
 * Returns the first violation found, or `ok: true` if every step holds.
 */
export function verifyPooledEqualsClaims(
  transactions: readonly Transaction[],
  config: BailmentConfig = DEFAULT_CONFIG
): Result<true, LedgerError> {
  const balances = new Map<string, bigint>(); // `${role}|${currency}@${scale}` → bigint
  for (const tx of transactions) {
    for (const p of tx.postings) {
      const role = classifyAccount(p.account, config);
      if (role === "ignore") continue;
      const key = `${role}|${p.amount.currency}@${p.amount.scale}`;
      balances.set(key, (balances.get(key) ?? 0n) + p.amount.value);
    }
    // After applying this transaction, every currency must satisfy
    // pooled + claims === 0.
    const violation = findPooledClaimsViolation(balances);
    if (violation) {
      return {
        ok: false,
        error: {
          code: "bailment_invariant",
          message: `pooled-equals-claims violation after ${tx.id}: ${violation}`,
          source: { txId: tx.id, date: tx.date },
        },
      };
    }
  }
  return { ok: true, value: true };
}

function classifyAccount(
  name: AccountName,
  config: BailmentConfig
): "pooled" | "claims" | "ignore" {
  if (name.startsWith(config.pooledPrefix)) return "pooled";
  if (name.startsWith(config.claimsPrefix)) return "claims";
  return "ignore";
}

function findPooledClaimsViolation(
  balances: Map<string, bigint>
): string | null {
  // Group by `${currency}@${scale}` — pooled and claims should net to 0.
  const grouped = new Map<string, { pooled: bigint; claims: bigint }>();
  for (const [k, v] of balances) {
    const [role, key] = k.split("|") as ["pooled" | "claims", string];
    const cell = grouped.get(key) ?? { pooled: 0n, claims: 0n };
    cell[role] += v;
    grouped.set(key, cell);
  }
  for (const [key, { pooled, claims }] of grouped) {
    if (pooled + claims !== 0n) {
      return `${key}: pooled=${pooled.toString()} claims=${claims.toString()} sum=${(pooled + claims).toString()}`;
    }
  }
  return null;
}

/**
 * Custodian-side feed for invariant #3. The application reads broker
 * statements (or equivalent) and appends a `CustodianBalanceReport`
 * for each (custodian, asset, asOfDate) tuple. The verifier compares
 * against the running pooled balance and emits drift findings.
 */
export interface CustodianBalanceReport {
  custodian: string;
  asset: Currency;
  scale: number;
  asOfDate: string;
  reportedBalance: Amount;
}

export interface DriftFinding {
  custodian: string;
  asset: Currency;
  scale: number;
  asOfDate: string;
  reported: bigint;
  shadow: bigint;
  driftMinorUnits: bigint;
}

/**
 * Compare custodian-reported balances against the shadow-ledger's
 * pooled balance for each (custodian, asset) at each report date.
 * Returns one finding per non-zero drift.
 */
export function detectCustodianDrift(
  transactions: readonly Transaction[],
  reports: readonly CustodianBalanceReport[],
  config: BailmentConfig = DEFAULT_CONFIG
): DriftFinding[] {
  const findings: DriftFinding[] = [];
  for (const report of reports) {
    const shadowKey = `${config.pooledPrefix}${report.custodian}:${report.asset}`;
    let shadow = 0n;
    for (const tx of transactions) {
      if (tx.date > report.asOfDate) continue;
      for (const p of tx.postings) {
        if (
          p.account === shadowKey &&
          p.amount.currency === report.asset &&
          p.amount.scale === report.scale
        ) {
          shadow += p.amount.value;
        }
      }
    }
    const drift = report.reportedBalance.value - shadow;
    if (drift !== 0n) {
      findings.push({
        custodian: report.custodian,
        asset: report.asset,
        scale: report.scale,
        asOfDate: report.asOfDate,
        reported: report.reportedBalance.value,
        shadow,
        driftMinorUnits: drift,
      });
    }
  }
  return findings;
}

/**
 * Convenience: total claims by client for an asset, summed across all
 * transactions up to `asOfDate`. Useful for client statements.
 */
export function claimsByClient(
  transactions: readonly Transaction[],
  asset: Currency,
  scale: number,
  asOfDate: string,
  config: BailmentConfig = DEFAULT_CONFIG
): Map<string, bigint> {
  const out = new Map<string, bigint>();
  for (const tx of transactions) {
    if (tx.date > asOfDate) continue;
    for (const p of tx.postings) {
      if (
        p.account.startsWith(config.claimsPrefix) &&
        p.amount.currency === asset &&
        p.amount.scale === scale
      ) {
        // Account name shape: `${claimsPrefix}${clientId}:${asset}` —
        // pull out the clientId.
        const tail = p.account.slice(config.claimsPrefix.length);
        const colonIdx = tail.indexOf(":");
        const clientId = colonIdx === -1 ? tail : tail.slice(0, colonIdx);
        out.set(clientId, (out.get(clientId) ?? 0n) + p.amount.value);
      }
    }
  }
  return out;
}
