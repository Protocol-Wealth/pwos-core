// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * @protocolwealthos/holdings — advisor portfolio data primitives.
 *
 * Pattern: an **immutable event stream** (`HoldingEvent`) gets
 * materialized into **daily snapshots** (`HoldingSnapshot`) for query
 * speed. Materialization is deterministic — same events + prices
 * always produce byte-identical snapshots — which is what makes
 * audit-log hash chaining meaningful for SEC 204-2.
 *
 * Architectural lineage: clean-room re-derivation inspired by Maybe
 * Finance / Sure (its AGPL fork). No GPL/AGPL code copied. Improvements
 * over prior art: explicit `firmId` for RIA tenancy, ISIN/CUSIP
 * first-class on Security, splits/reorgs as first-class event kinds,
 * audit-log integration on every mutation.
 *
 * Core surface:
 *   - Entities: `Account`, `Security`, `SecurityPrice`,
 *     `HoldingEvent`, `HoldingSnapshot`, `AccountBalance`,
 *     `CashEvent`, `TransferLink`, `CustodianConnection`,
 *     `ExternalAccountMirror`, `AdvisorAccess`.
 *   - Builders: `buyEvent`, `sellEvent`, `dividendEvent`,
 *     `interestEvent`, `feeEvent`, `splitEvent`, `transferInEvent`,
 *     `transferOutEvent`, `markEvent`, `buildCashEvent`.
 *   - Materialization: `materializeSnapshots(events, prices, options)`.
 *   - Storage: `HoldingsStore` interface + `InMemoryHoldingsStore`.
 */

export {
  AmountMismatchError,
  addAmount,
  makeAmount,
  negateAmount,
  parseAmount,
  zeroAmount,
} from "./decimal.js";

export {
  buildCashEvent,
  buyEvent,
  dividendEvent,
  feeEvent,
  interestEvent,
  markEvent,
  sellEvent,
  splitEvent,
  transferInEvent,
  transferOutEvent,
} from "./events.js";
export type {
  BuildCashEventInput,
  BuildHoldingEventInput,
} from "./events.js";

export {
  materializeSnapshots,
  priceAt,
} from "./materialize.js";
export type { MaterializeOptions } from "./materialize.js";

export { InMemoryHoldingsStore } from "./store.js";
export type {
  HoldingsStore,
  StoreError,
  StoreResult,
} from "./store.js";

export type {
  AccessPermission,
  AccessScope,
  Account,
  AccountBalance,
  AccountId,
  AccountKind,
  AccountStatus,
  AdvisorAccess,
  CashEvent,
  CashEventKind,
  ConnectionId,
  ConnectionStatus,
  CostBasisSource,
  Currency,
  CustodianConnection,
  CustodianId,
  EventId,
  ExternalAccountMirror,
  FirmId,
  HoldingEvent,
  HoldingEventKind,
  HoldingSnapshot,
  HouseholdId,
  MirrorId,
  MoneyAmount,
  PrincipalId,
  Security,
  SecurityId,
  SecurityKind,
  SecurityPrice,
  TransferLink,
} from "./types.js";
