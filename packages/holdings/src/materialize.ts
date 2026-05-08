// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Snapshot materialization.
 *
 * `materializeSnapshots(events, prices, asOfDate)` replays the event
 * stream up to `asOfDate` and produces one `HoldingSnapshot` per
 * (accountId, securityId, currency). Determinism is the contract —
 * same inputs always produce byte-identical outputs, which is what
 * makes audit-log hash chaining meaningful.
 *
 * Design choices:
 *   - Quantity is summed from `qtyDelta` over all events (buys add,
 *     sells subtract, splits adjust, transfers move).
 *   - Cost basis is summed from `costBasisDelta` (buys add basis,
 *     sells subtract pro-rata basis, splits preserve total basis).
 *   - Market price is looked up from the `prices` map at `asOfDate`
 *     (or the latest <=). Offline securities use the latest `mark`
 *     event's `pricePerUnit` instead.
 *   - Market value = qty × price. Computed in the security's currency;
 *     no FX conversion happens here (that's a downstream concern).
 *
 * The materializer does NOT validate that quantity remains non-negative;
 * a sell beyond holdings produces a snapshot with negative qty (which
 * you'd then alert on as a data-integrity issue). The job here is to
 * surface state, not enforce policy.
 */

import { addAmount, makeAmount, zeroAmount } from "./decimal.js";
import type {
  AccountId,
  Currency,
  HoldingEvent,
  HoldingSnapshot,
  MoneyAmount,
  SecurityId,
  SecurityPrice,
} from "./types.js";

export interface MaterializeOptions {
  /** Inclusive cutoff date — events on or before are applied. */
  asOfDate: string;
  /**
   * Cost-basis source assigned to the produced snapshots. `'computed'`
   * is the default for replays; pass `'custodian'` if your driver
   * received a broker statement that overrides everything.
   */
  costBasisSource?: HoldingSnapshot["costBasisSource"];
  /** When materializing in a custodian-import flow, lock the basis. */
  costBasisLocked?: boolean;
}

interface AccumulatorKey {
  accountId: AccountId;
  securityId: SecurityId;
  currency: Currency;
}

interface Accumulator {
  qtyValue: bigint;
  qtyScale: number;
  costBasis: MoneyAmount | null;
  lastMarkPrice?: MoneyAmount;
}

function keyOf(k: AccumulatorKey): string {
  return `${k.accountId}|${k.securityId}|${k.currency}`;
}

/**
 * Find the market price for `securityId` in `currency` at or before
 * `asOfDate`. Returns the latest price <= asOfDate, or null if none.
 */
export function priceAt(
  prices: readonly SecurityPrice[],
  securityId: SecurityId,
  currency: Currency,
  asOfDate: string
): SecurityPrice | null {
  let best: SecurityPrice | null = null;
  for (const p of prices) {
    if (p.securityId !== securityId) continue;
    if (p.price.currency !== currency) continue;
    if (p.asOfDate > asOfDate) continue;
    if (!best || p.asOfDate > best.asOfDate) best = p;
  }
  return best;
}

export function materializeSnapshots(
  events: readonly HoldingEvent[],
  prices: readonly SecurityPrice[],
  options: MaterializeOptions
): HoldingSnapshot[] {
  const accumulators = new Map<string, Accumulator & AccumulatorKey>();

  for (const e of events) {
    if (e.occurredOn > options.asOfDate) continue;
    if (e.securityId === undefined) continue;

    // The currency of a HoldingEvent's basis lives on costBasisDelta /
    // pricePerUnit. We accumulate per (accountId, securityId, currency)
    // — choose the basis currency where present, else cashDelta currency.
    const currency =
      e.costBasisDelta?.currency ??
      e.pricePerUnit?.currency ??
      e.cashDelta.currency;

    const key: AccumulatorKey = {
      accountId: e.accountId,
      securityId: e.securityId,
      currency,
    };
    const k = keyOf(key);
    const acc = accumulators.get(k) ?? {
      ...key,
      qtyValue: 0n,
      qtyScale: e.qtyScale,
      costBasis: null,
    };

    acc.qtyValue += e.qtyDelta;
    if (e.costBasisDelta) {
      acc.costBasis = acc.costBasis
        ? addAmount(acc.costBasis, e.costBasisDelta)
        : e.costBasisDelta;
    }
    if (e.kind === "mark" && e.pricePerUnit) {
      acc.lastMarkPrice = e.pricePerUnit;
    }
    accumulators.set(k, acc);
  }

  const snapshots: HoldingSnapshot[] = [];
  for (const acc of accumulators.values()) {
    const livePrice = priceAt(prices, acc.securityId, acc.currency, options.asOfDate);
    const marketPrice =
      livePrice?.price ??
      acc.lastMarkPrice ??
      zeroAmount(acc.currency, 2);
    const marketValue = computeMarketValue(acc.qtyValue, acc.qtyScale, marketPrice);
    snapshots.push({
      accountId: acc.accountId,
      securityId: acc.securityId,
      asOfDate: options.asOfDate,
      currency: acc.currency,
      qty: acc.qtyValue,
      qtyScale: acc.qtyScale,
      marketPrice,
      marketValue,
      costBasis: acc.costBasis ?? zeroAmount(acc.currency, marketPrice.scale),
      costBasisSource: options.costBasisSource ?? "computed",
      costBasisLocked: options.costBasisLocked ?? false,
      lockedFields: new Set(),
    });
  }
  return snapshots;
}

/**
 * marketValue = qty × price, where qty is fixed-point at qtyScale and
 * price is fixed-point at price.scale. The result lands at price.scale
 * (the canonical money scale), with rounding-half-to-even.
 */
function computeMarketValue(
  qtyValue: bigint,
  qtyScale: number,
  price: MoneyAmount
): MoneyAmount {
  // qty × price has scale = qtyScale + price.scale
  // We want output at price.scale, so divide by 10^qtyScale (banker's
  // rounding to keep the scaler symmetric).
  const product = qtyValue * price.value;
  const scaler = 10n ** BigInt(qtyScale);
  const half = scaler / 2n;
  let rounded: bigint;
  if (product >= 0n) {
    rounded = (product + half) / scaler;
    // banker's rounding tie-breaker
    if ((product + half) % scaler === 0n && (rounded & 1n) === 1n) {
      rounded -= 1n;
    }
  } else {
    const absProduct = -product;
    rounded = -((absProduct + half) / scaler);
    if ((absProduct + half) % scaler === 0n && (-rounded & 1n) === 1n) {
      rounded += 1n;
    }
  }
  return makeAmount(rounded, price.currency, price.scale);
}
