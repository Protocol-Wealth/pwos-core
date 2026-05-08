# @protocolwealthos/holdings

> Account / security / event-stream / daily-snapshot primitives for advisor portfolio data. Immutable HoldingEvent log, materialized HoldingSnapshot, AccountBalance with inflow/outflow decomposition, custodian connection mirrors, scoped advisor access.

Apache 2.0 · Patent Pending: USPTO #64/034,215 · part of [pwos-core](https://github.com/Protocol-Wealth/pwos-core).

## Why this exists

Tracking client portfolio state is most often hacked together: `current_qty` columns that drift from reality, cost-basis fields stomped by every Plaid sync, no clean way to ask "what did this position look like on 2025-12-31?". This package ships the right shape:

- **Immutable event stream** — `HoldingEvent` records `buy`/`sell`/`dividend`/`split`/`transfer_in`/`transfer_out`/`mark`. Append-only; corrections are new reversing events.
- **Daily materialized snapshots** — `materializeSnapshots(events, prices, { asOfDate })` replays the stream to produce one `HoldingSnapshot` per `(account, security, currency)`. Deterministic; same inputs always produce byte-identical outputs (which makes audit-log hash chaining meaningful).
- **Cost-basis provenance** — every snapshot carries `costBasisSource: 'manual' | 'computed' | 'custodian'` and a `costBasisLocked` flag, so user-edited basis isn't stomped by the next provider sync.
- **Inflow/outflow decomposition** — `AccountBalance` stores `cashInflows`, `cashOutflows`, `nonCashInflows`, `nonCashOutflows`, `marketDrift`, `adjustments` separately, feeding TWR / MWR / IRR calculations directly.

Architectural lineage: clean-room re-derivation inspired by Maybe Finance / its AGPL fork (Sure). No GPL/AGPL code copied. Improvements over prior art:

- Explicit `firmId` for **RIA tenancy above household**
- ISIN / CUSIP / SEDOL **first-class** on `Security` (not ticker overload)
- Splits / corporate actions as **first-class event kinds** (not smuggled into Trade rows)
- Audit-log integration on **every mutation** (SEC 204-2 retention)

## Install

```sh
pnpm add @protocolwealthos/holdings
```

## Quick start

```ts
import {
  buyEvent, dividendEvent, splitEvent,
  materializeSnapshots,
  parseAmount,
  InMemoryHoldingsStore,
} from "@protocolwealthos/holdings";

const USD = "USD" as Currency;
const store = new InMemoryHoldingsStore();

// Open a brokerage account
await store.upsertAccount({
  id: "acc_1" as AccountId,
  firmId: "firm_1" as FirmId,
  householdId: "hh_1" as HouseholdId,
  kind: "brokerage",
  displayName: "Schwab Brokerage",
  currency: USD,
  status: "active",
  openedOn: "2026-01-01",
  ownerPrincipalId: "p_advisor" as PrincipalId,
  meta: {},
});

// Append events
await store.appendHoldingEvent(buyEvent({
  id: "ev_1" as EventId,
  accountId: "acc_1" as AccountId,
  occurredOn: "2026-05-01",
  securityId: "sec_aapl" as SecurityId,
  qtyDelta: 100n, qtyScale: 0,
  cashDelta:       parseAmount("-15000.00", USD, 2),
  costBasisDelta:  parseAmount("15000.00",  USD, 2),
  sourceId: "plaid",
  externalId: "plaid_tx_999",
}));

await store.appendHoldingEvent(dividendEvent({
  id: "ev_2" as EventId,
  accountId: "acc_1" as AccountId,
  occurredOn: "2026-06-15",
  securityId: "sec_aapl" as SecurityId,
  qtyScale: 0,
  cashDelta: parseAmount("23.50", USD, 2),
}));

// Materialize a snapshot for any date
const events = await store.listHoldingEvents({ accountId: "acc_1" as AccountId });
const prices = await store.listSecurityPrices("sec_aapl" as SecurityId);
const snapshots = materializeSnapshots(events, prices, { asOfDate: "2026-06-30" });
```

## Event shape conventions

| Kind | qtyDelta | cashDelta | costBasisDelta |
|---|---|---|---|
| `buy` | + | − | + |
| `sell` | − | + | − |
| `dividend` (cash) | 0 | + | — |
| `dividend` (reinvested) | — | — | — (use cash dividend + buy) |
| `interest` | 0 | + | — |
| `fee` | 0 | − | — |
| `split` | + or − | 0 | 0 (basis preserved) |
| `transfer_in` | + | 0 | + (basis from origin) |
| `transfer_out` | − | 0 | − (basis to destination) |
| `mark` | 0 | 0 | — (declares an `asOf` price) |
| `reorg` | application-defined |

## Idempotency

When a provider pushes events, set `sourceId` + `externalId`:

```ts
buyEvent({ ..., sourceId: "plaid", externalId: "plaid_tx_999" });
```

`(accountId, sourceId, externalId)` is the dedup contract. Re-appending the same external event is a no-op (returns `idempotency_conflict` with the existing event id).

## Audit-log integration

Pair with [`@protocolwealthos/audit-log`](../audit-log) — every `appendHoldingEvent`, `upsertAccount`, `grantAccess` call should produce one audit row with the canonical JSON + content hash. The `materializeSnapshots()` function is deterministic, so a replay from the audit log alone reproduces snapshot state byte-for-byte.

## What's NOT in v0.5.0

Deferred to v0.5.1+:

- **AccountBalance materialization** — the type ships; the materializer that produces it from events lands next.
- **TransferLink auto-matching** — the type ships; the heuristic that pairs debits and credits across accounts comes later.
- **Lot-level basis tracking** — current snapshots roll up basis per security; per-lot tracking (FIFO/LIFO/HIFO/AVERAGE selection) lands when the ledger package gains lots.

## License

Apache 2.0 with USPTO Application #64/034,215 defensive patent grant.
