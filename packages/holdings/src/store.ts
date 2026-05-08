// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Append-only store for holdings data.
 *
 * Mirrors the shape of `@protocolwealthos/ledger`'s `LedgerStore`:
 * account lifecycle + immutable event append + read methods. Every
 * `append*` call should write one row to `@protocolwealthos/audit-log`
 * (caller wires the audit logger in their store implementation).
 *
 * Ships `InMemoryHoldingsStore` for tests and dev — not safe across
 * multiple workers.
 */

import type {
  Account,
  AccountId,
  AdvisorAccess,
  CashEvent,
  ConnectionId,
  CustodianConnection,
  EventId,
  ExternalAccountMirror,
  HoldingEvent,
  MirrorId,
  Security,
  SecurityId,
  SecurityPrice,
  TransferLink,
} from "./types.js";

export type StoreError =
  | { code: "duplicate_id"; message: string }
  | { code: "not_found"; message: string }
  | { code: "idempotency_conflict"; message: string }
  | { code: "constraint"; message: string };

export type StoreResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: StoreError };

export interface HoldingsStore {
  // Accounts
  upsertAccount(account: Account): Promise<StoreResult<Account>>;
  getAccount(id: AccountId): Promise<Account | undefined>;
  listAccountsForHousehold(householdId: Account["householdId"]): Promise<readonly Account[]>;

  // Securities
  upsertSecurity(security: Security): Promise<StoreResult<Security>>;
  getSecurity(id: SecurityId): Promise<Security | undefined>;
  upsertSecurityPrice(price: SecurityPrice): Promise<StoreResult<SecurityPrice>>;
  listSecurityPrices(id: SecurityId): Promise<readonly SecurityPrice[]>;

  // Events (append-only)
  appendHoldingEvent(event: HoldingEvent): Promise<StoreResult<HoldingEvent>>;
  appendCashEvent(event: CashEvent): Promise<StoreResult<CashEvent>>;
  listHoldingEvents(filter?: {
    accountId?: AccountId;
    startDate?: string;
    endDate?: string;
  }): Promise<readonly HoldingEvent[]>;
  listCashEvents(filter?: {
    accountId?: AccountId;
    startDate?: string;
    endDate?: string;
  }): Promise<readonly CashEvent[]>;

  // Transfer matching
  upsertTransferLink(link: TransferLink): Promise<StoreResult<TransferLink>>;
  listTransferLinks(): Promise<readonly TransferLink[]>;

  // Custodian connections
  upsertCustodianConnection(c: CustodianConnection): Promise<StoreResult<CustodianConnection>>;
  upsertExternalMirror(m: ExternalAccountMirror): Promise<StoreResult<ExternalAccountMirror>>;

  // Advisor access
  grantAccess(access: AdvisorAccess): Promise<StoreResult<AdvisorAccess>>;
  revokeAccess(id: string, by: AdvisorAccess["revokedBy"], at: string): Promise<StoreResult<AdvisorAccess>>;
  listAccessForPrincipal(principalId: AdvisorAccess["principalId"]): Promise<readonly AdvisorAccess[]>;
}

export class InMemoryHoldingsStore implements HoldingsStore {
  private readonly accounts = new Map<AccountId, Account>();
  private readonly securities = new Map<SecurityId, Security>();
  private readonly prices: SecurityPrice[] = [];
  private readonly holdingEvents: HoldingEvent[] = [];
  private readonly cashEvents: CashEvent[] = [];
  private readonly heventIds = new Set<EventId>();
  private readonly ceventIds = new Set<EventId>();
  /** External-id idempotency: `${accountId}|${sourceId}|${externalId}` → eventId. */
  private readonly idempotencyKeys = new Map<string, EventId>();
  private readonly transferLinks = new Map<string, TransferLink>();
  private readonly connections = new Map<ConnectionId, CustodianConnection>();
  private readonly mirrors = new Map<MirrorId, ExternalAccountMirror>();
  private readonly accesses = new Map<string, AdvisorAccess>();

  async upsertAccount(account: Account): Promise<StoreResult<Account>> {
    this.accounts.set(account.id, account);
    return { ok: true, value: account };
  }
  async getAccount(id: AccountId): Promise<Account | undefined> {
    return this.accounts.get(id);
  }
  async listAccountsForHousehold(householdId: Account["householdId"]): Promise<readonly Account[]> {
    return Array.from(this.accounts.values()).filter((a) => a.householdId === householdId);
  }

  async upsertSecurity(security: Security): Promise<StoreResult<Security>> {
    this.securities.set(security.id, security);
    return { ok: true, value: security };
  }
  async getSecurity(id: SecurityId): Promise<Security | undefined> {
    return this.securities.get(id);
  }
  async upsertSecurityPrice(price: SecurityPrice): Promise<StoreResult<SecurityPrice>> {
    // Replace an existing price for the same (security, asOfDate, currency).
    const idx = this.prices.findIndex(
      (p) =>
        p.securityId === price.securityId &&
        p.asOfDate === price.asOfDate &&
        p.price.currency === price.price.currency
    );
    if (idx >= 0) this.prices[idx] = price;
    else this.prices.push(price);
    return { ok: true, value: price };
  }
  async listSecurityPrices(id: SecurityId): Promise<readonly SecurityPrice[]> {
    return this.prices.filter((p) => p.securityId === id);
  }

  async appendHoldingEvent(event: HoldingEvent): Promise<StoreResult<HoldingEvent>> {
    if (this.heventIds.has(event.id)) {
      return { ok: false, error: { code: "duplicate_id", message: `event id "${event.id}" exists` } };
    }
    if (event.sourceId !== undefined && event.externalId !== undefined) {
      const key = `${event.accountId}|${event.sourceId}|${event.externalId}`;
      const existing = this.idempotencyKeys.get(key);
      if (existing !== undefined && existing !== event.id) {
        return {
          ok: false,
          error: {
            code: "idempotency_conflict",
            message: `external id collision for ${key}; first seen as ${existing}`,
          },
        };
      }
      this.idempotencyKeys.set(key, event.id);
    }
    this.holdingEvents.push(event);
    this.heventIds.add(event.id);
    return { ok: true, value: event };
  }

  async appendCashEvent(event: CashEvent): Promise<StoreResult<CashEvent>> {
    if (this.ceventIds.has(event.id)) {
      return { ok: false, error: { code: "duplicate_id", message: `cash event id "${event.id}" exists` } };
    }
    if (event.sourceId !== undefined && event.externalId !== undefined) {
      const key = `${event.accountId}|${event.sourceId}|${event.externalId}|cash`;
      const existing = this.idempotencyKeys.get(key);
      if (existing !== undefined && existing !== event.id) {
        return {
          ok: false,
          error: { code: "idempotency_conflict", message: `external id collision for ${key}` },
        };
      }
      this.idempotencyKeys.set(key, event.id);
    }
    this.cashEvents.push(event);
    this.ceventIds.add(event.id);
    return { ok: true, value: event };
  }

  async listHoldingEvents(
    filter: { accountId?: AccountId; startDate?: string; endDate?: string } = {}
  ): Promise<readonly HoldingEvent[]> {
    return this.holdingEvents.filter((e) => {
      if (filter.accountId && e.accountId !== filter.accountId) return false;
      if (filter.startDate && e.occurredOn < filter.startDate) return false;
      if (filter.endDate && e.occurredOn > filter.endDate) return false;
      return true;
    });
  }
  async listCashEvents(
    filter: { accountId?: AccountId; startDate?: string; endDate?: string } = {}
  ): Promise<readonly CashEvent[]> {
    return this.cashEvents.filter((e) => {
      if (filter.accountId && e.accountId !== filter.accountId) return false;
      if (filter.startDate && e.occurredOn < filter.startDate) return false;
      if (filter.endDate && e.occurredOn > filter.endDate) return false;
      return true;
    });
  }

  async upsertTransferLink(link: TransferLink): Promise<StoreResult<TransferLink>> {
    this.transferLinks.set(link.id, link);
    return { ok: true, value: link };
  }
  async listTransferLinks(): Promise<readonly TransferLink[]> {
    return Array.from(this.transferLinks.values());
  }

  async upsertCustodianConnection(c: CustodianConnection): Promise<StoreResult<CustodianConnection>> {
    this.connections.set(c.id, c);
    return { ok: true, value: c };
  }
  async upsertExternalMirror(m: ExternalAccountMirror): Promise<StoreResult<ExternalAccountMirror>> {
    this.mirrors.set(m.id, m);
    return { ok: true, value: m };
  }

  async grantAccess(access: AdvisorAccess): Promise<StoreResult<AdvisorAccess>> {
    this.accesses.set(access.id, access);
    return { ok: true, value: access };
  }
  async revokeAccess(
    id: string,
    by: AdvisorAccess["revokedBy"],
    at: string
  ): Promise<StoreResult<AdvisorAccess>> {
    const existing = this.accesses.get(id);
    if (!existing) {
      return { ok: false, error: { code: "not_found", message: `access "${id}" not found` } };
    }
    const revoked: AdvisorAccess = {
      ...existing,
      revokedAt: at,
      ...(by !== undefined && { revokedBy: by }),
    };
    this.accesses.set(id, revoked);
    return { ok: true, value: revoked };
  }
  async listAccessForPrincipal(
    principalId: AdvisorAccess["principalId"]
  ): Promise<readonly AdvisorAccess[]> {
    return Array.from(this.accesses.values()).filter((a) => a.principalId === principalId);
  }
}
