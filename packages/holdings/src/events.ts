// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Event-stream helpers.
 *
 * Builders for the common event shapes (buy / sell / dividend / split /
 * transfer / mark) so consumers don't have to remember the sign
 * conventions. Every builder returns a fully-formed `HoldingEvent`
 * ready for `HoldingsStore.appendHoldingEvent`.
 */

import type {
  AccountId,
  CashEvent,
  CashEventKind,
  EventId,
  HoldingEvent,
  HoldingEventKind,
  MoneyAmount,
  SecurityId,
} from "./types.js";

export interface BuildHoldingEventInput {
  id: EventId;
  accountId: AccountId;
  occurredOn: string;
  kind: HoldingEventKind;
  securityId?: SecurityId;
  qtyDelta: bigint;
  qtyScale: number;
  cashDelta: MoneyAmount;
  costBasisDelta?: MoneyAmount;
  pricePerUnit?: MoneyAmount;
  fee?: MoneyAmount;
  sourceId?: string;
  externalId?: string;
  importId?: string;
  notes?: string;
  recordedAt?: string;
}

function buildHoldingEvent(input: BuildHoldingEventInput): HoldingEvent {
  return {
    id: input.id,
    accountId: input.accountId,
    occurredOn: input.occurredOn,
    kind: input.kind,
    ...(input.securityId !== undefined && { securityId: input.securityId }),
    qtyDelta: input.qtyDelta,
    qtyScale: input.qtyScale,
    cashDelta: input.cashDelta,
    ...(input.costBasisDelta !== undefined && { costBasisDelta: input.costBasisDelta }),
    ...(input.pricePerUnit !== undefined && { pricePerUnit: input.pricePerUnit }),
    ...(input.fee !== undefined && { fee: input.fee }),
    ...(input.sourceId !== undefined && { sourceId: input.sourceId }),
    ...(input.externalId !== undefined && { externalId: input.externalId }),
    ...(input.importId !== undefined && { importId: input.importId }),
    ...(input.notes !== undefined && { notes: input.notes }),
    recordedAt: input.recordedAt ?? new Date().toISOString(),
  };
}

/** Construct a `buy` event. cashDelta should be negative; qtyDelta positive. */
export function buyEvent(input: Omit<BuildHoldingEventInput, "kind">): HoldingEvent {
  return buildHoldingEvent({ ...input, kind: "buy" });
}

/** Construct a `sell` event. cashDelta positive; qtyDelta negative. */
export function sellEvent(input: Omit<BuildHoldingEventInput, "kind">): HoldingEvent {
  return buildHoldingEvent({ ...input, kind: "sell" });
}

/** Construct a cash dividend (qtyDelta=0, cashDelta positive). Reinvested? Pair with `buyEvent`. */
export function dividendEvent(
  input: Omit<BuildHoldingEventInput, "kind" | "qtyDelta" | "qtyScale"> & { qtyScale: number }
): HoldingEvent {
  return buildHoldingEvent({ ...input, kind: "dividend", qtyDelta: 0n });
}

/** Construct an interest event (qtyDelta=0, cashDelta positive). */
export function interestEvent(
  input: Omit<BuildHoldingEventInput, "kind" | "qtyDelta" | "qtyScale"> & { qtyScale: number }
): HoldingEvent {
  return buildHoldingEvent({ ...input, kind: "interest", qtyDelta: 0n });
}

/** Construct a fee event (qtyDelta=0, cashDelta negative). */
export function feeEvent(
  input: Omit<BuildHoldingEventInput, "kind" | "qtyDelta" | "qtyScale"> & { qtyScale: number }
): HoldingEvent {
  return buildHoldingEvent({ ...input, kind: "fee", qtyDelta: 0n });
}

/**
 * Construct a stock split event. `qtyDelta` is the change in share
 * count (e.g. 2:1 split on 100 shares = +100). cashDelta = 0,
 * costBasisDelta = 0 — total cost basis is preserved across splits.
 */
export function splitEvent(
  input: Omit<BuildHoldingEventInput, "kind" | "cashDelta" | "costBasisDelta">
    & { cashDelta: MoneyAmount }
): HoldingEvent {
  return buildHoldingEvent({ ...input, kind: "split" });
}

/** Construct a transfer-in event. cashDelta = 0; costBasisDelta carries basis from origin. */
export function transferInEvent(input: Omit<BuildHoldingEventInput, "kind">): HoldingEvent {
  return buildHoldingEvent({ ...input, kind: "transfer_in" });
}

/** Construct a transfer-out event. cashDelta = 0; costBasisDelta carries basis to destination. */
export function transferOutEvent(input: Omit<BuildHoldingEventInput, "kind">): HoldingEvent {
  return buildHoldingEvent({ ...input, kind: "transfer_out" });
}

/**
 * Construct a `mark` event for revaluing an offline (private) holding.
 * Zero-impact on quantity and cash; purely a valuation declaration.
 */
export function markEvent(input: Omit<BuildHoldingEventInput, "kind">): HoldingEvent {
  return buildHoldingEvent({ ...input, kind: "mark" });
}

/** Convenience: cash-event builder. */
export interface BuildCashEventInput {
  id: EventId;
  accountId: AccountId;
  occurredOn: string;
  kind: CashEventKind;
  amount: MoneyAmount;
  payee?: string;
  category?: string;
  sourceId?: string;
  externalId?: string;
  notes?: string;
  recordedAt?: string;
}

export function buildCashEvent(input: BuildCashEventInput): CashEvent {
  return {
    id: input.id,
    accountId: input.accountId,
    occurredOn: input.occurredOn,
    kind: input.kind,
    amount: input.amount,
    ...(input.payee !== undefined && { payee: input.payee }),
    ...(input.category !== undefined && { category: input.category }),
    ...(input.sourceId !== undefined && { sourceId: input.sourceId }),
    ...(input.externalId !== undefined && { externalId: input.externalId }),
    ...(input.notes !== undefined && { notes: input.notes }),
    recordedAt: input.recordedAt ?? new Date().toISOString(),
  };
}
