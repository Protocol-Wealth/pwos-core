// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Core types for advisor portfolio data.
 *
 * Architectural lineage: independently re-derived from prior art in the
 * personal-finance space (Maybe Finance / its AGPL fork, Sure). No
 * GPL/AGPL code was copied; clean-room Apache 2.0 implementation that
 * reuses the (a) polymorphic event-stream + (b) daily-materialized-snapshot
 * pattern as facts of the domain. Improvements over prior art for
 * advisor use:
 *   - Explicit `firmId` for RIA tenancy ABOVE household
 *   - ISIN / CUSIP / SEDOL first-class on `Security` (not ticker overload)
 *   - Stock split + corporate actions as first-class event kinds
 *   - Audit-log integration on every mutation (SEC 204-2 retention)
 */

/** Branded ids prevent cross-pollination of unrelated identifiers. */
export type FirmId = string & { readonly __brand: "FirmId" };
export type HouseholdId = string & { readonly __brand: "HouseholdId" };
export type AccountId = string & { readonly __brand: "AccountId" };
export type SecurityId = string & { readonly __brand: "SecurityId" };
export type EventId = string & { readonly __brand: "EventId" };
export type PrincipalId = string & { readonly __brand: "PrincipalId" };
export type ConnectionId = string & { readonly __brand: "ConnectionId" };
export type MirrorId = string & { readonly __brand: "MirrorId" };
export type CustodianId = string & { readonly __brand: "CustodianId" };

/** ISO 4217 currency code or asset ticker — opaque string. */
export type Currency = string & { readonly __brand: "Currency" };

/**
 * MoneyAmount = signed value + scale + currency. Mirrors
 * `@protocolwealthos/ledger`'s `Amount` shape; chosen identically so
 * the two packages compose without conversion. See ledger's
 * `decimal.ts` for parse/format/add helpers.
 */
export interface MoneyAmount {
  value: bigint;
  scale: number;
  currency: Currency;
}

/** Account category. Drives kind-detail dispatch and reporting. */
export type AccountKind =
  | "cash"
  | "savings"
  | "brokerage"
  | "retirement"
  | "credit_card"
  | "loan"
  | "real_estate"
  | "private_holding"
  | "crypto"
  | "vehicle"
  | "other_asset"
  | "other_liability";

export type AccountStatus = "active" | "closed" | "pending" | "errored";

/**
 * Account represents one holding container — a bank checking account,
 * a brokerage account, a credit card, a piece of real estate. Universal
 * fields here; kind-specific extension fields live in
 * `AccountKindDetail` records keyed by accountId.
 *
 * `firmId` is the RIA tenancy boundary; `householdId` is the client
 * household. Per-account audit + access control hangs off `firmId`.
 */
export interface Account {
  id: AccountId;
  firmId: FirmId;
  householdId: HouseholdId;
  kind: AccountKind;
  displayName: string;
  currency: Currency;
  custodianId?: CustodianId;
  custodianAccountNumber?: string; // last 4 only, ideally — pair with @protocolwealthos/pii-guard masker
  status: AccountStatus;
  openedOn: string; // ISO-8601
  closedOn?: string;
  ownerPrincipalId: PrincipalId;
  meta: Readonly<Record<string, string>>;
}

/** Security category for downstream analytics + tax handling. */
export type SecurityKind =
  | "equity"
  | "fixed_income"
  | "mutual_fund"
  | "etf"
  | "option"
  | "crypto"
  | "cash_equivalent"
  | "private"
  | "other";

/**
 * Security = the global instrument record. Not tenant-scoped — a
 * security is the same security across firms. ISIN/CUSIP/SEDOL are
 * first-class so identification is unambiguous (ticker alone is not
 * a stable identifier — same ticker means different things on
 * different exchanges).
 */
export interface Security {
  id: SecurityId;
  primaryTicker: string;
  isin?: string;
  cusip?: string;
  sedol?: string;
  kind: SecurityKind;
  exchangeMic?: string; // ISO 10383
  countryCode?: string; // ISO 3166-1 alpha-2
  displayName: string;
  /** Pricing data flag — `true` if no live feed available (private holdings). */
  offline: boolean;
  meta: Readonly<Record<string, string>>;
}

/**
 * SecurityPrice = daily mark for a (security, currency) on a date.
 * `provisional: true` flags a non-final estimate (intra-day mid, model
 * mark) so consumers know to re-fetch.
 */
export interface SecurityPrice {
  securityId: SecurityId;
  asOfDate: string; // ISO-8601
  price: MoneyAmount;
  provisional: boolean;
  source: string;
}

/**
 * HoldingEvent = the immutable event stream over an account.
 *
 * `kind` captures the economic event type. The signed deltas
 * (`qtyDelta`, `cashDelta`, `costBasisDelta`) are the load-bearing
 * fields; everything else is metadata.
 *
 * Conventions:
 *   - `buy`: qtyDelta > 0, cashDelta < 0 (cash leaves the account),
 *     costBasisDelta > 0 (basis added)
 *   - `sell`: qtyDelta < 0, cashDelta > 0, costBasisDelta < 0
 *   - `dividend` (cash): qtyDelta = 0, cashDelta > 0
 *   - `dividend` (reinvested): two events — a cash dividend then a buy
 *   - `interest`: like cash dividend
 *   - `fee`: cashDelta < 0
 *   - `split`: qtyDelta = (post − pre); cashDelta = 0; costBasisDelta = 0
 *     (cost basis is preserved across splits, only allocated across more
 *     shares — the snapshot recomputes per-share basis)
 *   - `transfer_in` / `transfer_out`: qtyDelta non-zero, cashDelta = 0,
 *     costBasisDelta carries the basis from / to
 *   - `reorg`: corporate action other than a clean split (merger,
 *     spinoff). Application-layer logic constructs the event(s).
 *   - `mark`: zero-impact event used to declare an `asOf` valuation
 *     for an offline security (private holding).
 *
 * `(accountId, sourceId, externalId)` should be unique when both
 * sourceId and externalId are non-null — that's the idempotency
 * contract for provider-pushed events.
 */
export type HoldingEventKind =
  | "buy"
  | "sell"
  | "dividend"
  | "interest"
  | "fee"
  | "split"
  | "transfer_in"
  | "transfer_out"
  | "reorg"
  | "mark";

export interface HoldingEvent {
  id: EventId;
  accountId: AccountId;
  occurredOn: string; // ISO-8601 date
  kind: HoldingEventKind;
  /** Security this event is about. Null for pure-cash events on cash-only accounts. */
  securityId?: SecurityId;
  qtyDelta: bigint;        // signed; scale on Security/Account-level config
  qtyScale: number;        // decimals for qty (e.g. 4 for fractional shares)
  cashDelta: MoneyAmount;  // signed
  costBasisDelta?: MoneyAmount;
  /** Settled/net price per unit for this event (informational, not load-bearing). */
  pricePerUnit?: MoneyAmount;
  fee?: MoneyAmount;
  /** Originating source — `"manual" | "plaid" | "snaptrade" | …`. */
  sourceId?: string;
  /** External id from the provider, used for idempotency. */
  externalId?: string;
  /** Optional link to a CSV/PDF import batch. */
  importId?: string;
  notes?: string;
  recordedAt: string; // ISO-8601 wall-clock
}

/**
 * Provenance enum on cost basis. Crucial for audit:
 *   - `manual` — entered by an advisor / user
 *   - `computed` — derived from event stream
 *   - `custodian` — pulled from broker statement
 */
export type CostBasisSource = "manual" | "computed" | "custodian";

/**
 * HoldingSnapshot = daily materialized view of one (account, security)
 * at a point in time. Derived by replaying HoldingEvents up to
 * `asOfDate` plus applying SecurityPrice for the mark.
 *
 * `(accountId, securityId, asOfDate, currency)` is unique. Replays
 * are deterministic; rebuilds are hash-chainable for SEC 204-2.
 */
export interface HoldingSnapshot {
  accountId: AccountId;
  securityId: SecurityId;
  asOfDate: string;
  currency: Currency;
  qty: bigint;
  qtyScale: number;
  marketPrice: MoneyAmount;
  marketValue: MoneyAmount;
  costBasis: MoneyAmount;
  costBasisSource: CostBasisSource;
  costBasisLocked: boolean;
  /** Set of fields the application has locked from provider stomping. */
  lockedFields: ReadonlySet<string>;
}

/**
 * AccountBalance = daily ledger snapshot with explicit
 * inflow/outflow decomposition. The decomposition feeds advisor
 * TWR/MWR/IRR calculations directly; it's the difference between a
 * useful balance row and an opaque end-of-day number.
 */
export interface AccountBalance {
  accountId: AccountId;
  asOfDate: string;
  currency: Currency;
  startingCash: MoneyAmount;
  startingNonCash: MoneyAmount;
  cashInflows: MoneyAmount;
  cashOutflows: MoneyAmount;
  nonCashInflows: MoneyAmount;
  nonCashOutflows: MoneyAmount;
  marketDrift: MoneyAmount;
  adjustments: MoneyAmount;
  endingBalance: MoneyAmount;
}

/**
 * CashEvent = lighter sibling of HoldingEvent for non-investment
 * activity (deposits, withdrawals, fees, interest received on a
 * checking account). Same idempotency contract on
 * `(accountId, sourceId, externalId)`.
 */
export type CashEventKind =
  | "deposit"
  | "withdrawal"
  | "fee"
  | "interest"
  | "transfer_in"
  | "transfer_out"
  | "adjustment";

export interface CashEvent {
  id: EventId;
  accountId: AccountId;
  occurredOn: string;
  kind: CashEventKind;
  amount: MoneyAmount; // signed
  payee?: string;
  category?: string;
  sourceId?: string;
  externalId?: string;
  notes?: string;
  recordedAt: string;
}

/**
 * TransferLink pairs a debit event in one account with a credit event
 * in another. `matchedBy: 'auto' | 'advisor'` and `confidence` carry
 * the audit trail — was this match observed by the system or asserted
 * by a human, and how sure was the system?
 */
export interface TransferLink {
  id: string;
  fromEventId: EventId;
  toEventId: EventId;
  status: "matched" | "rejected";
  matchedBy: "auto" | "advisor";
  confidence: number; // 0-1
  matchedAt: string;
  matchedByPrincipalId?: PrincipalId;
}

export type ConnectionStatus =
  | "active"
  | "needs_reauth"
  | "errored"
  | "scheduled_for_deletion"
  | "deleted";

/**
 * CustodianConnection = the connection-level handle for an external
 * custodian / aggregator integration (Plaid, SnapTrade, MX, custom).
 * Credentials live in a vault — this row only references them.
 */
export interface CustodianConnection {
  id: ConnectionId;
  firmId: FirmId;
  householdId: HouseholdId;
  custodianId: CustodianId;
  status: ConnectionStatus;
  lastSyncedAt?: string;
  /** External ref to credentials in your vault (Secret Manager key, etc.). */
  credentialsRef?: string;
  meta: Readonly<Record<string, string>>;
}

/**
 * ExternalAccountMirror = one upstream account as the provider sees
 * it; optionally bound to an internal Account. The split lets us
 * track providers that report multiple sub-accounts under one
 * connection (joint vs individual, IRA + taxable, etc.).
 */
export interface ExternalAccountMirror {
  id: MirrorId;
  connectionId: ConnectionId;
  externalAccountId: string;
  accountId?: AccountId; // null = unmapped
  /** Raw provider payload, for audit replay. */
  rawPayload?: unknown;
  lastSeenAt: string;
}

/**
 * AdvisorAccess = scoped grant for an advisor / agent / external
 * party. Replaces consumer "share my account" semantics with RIA
 * shape: scope hierarchy (firm > team > household > account),
 * permission level, expiry, grant audit.
 */
export type AccessScope = "firm" | "team" | "household" | "account";
export type AccessPermission = "view" | "review" | "manage";

export interface AdvisorAccess {
  id: string;
  principalId: PrincipalId;
  scope: AccessScope;
  /** Id of the scoped entity — interpretation depends on scope. */
  scopeRef: string;
  permission: AccessPermission;
  grantedBy: PrincipalId;
  grantedAt: string;
  expiresAt?: string;
  revokedAt?: string;
  revokedBy?: PrincipalId;
  meta: Readonly<Record<string, string>>;
}
