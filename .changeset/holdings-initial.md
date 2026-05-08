---
"@protocolwealthos/holdings": minor
---

Initial release: account / security / event-stream / daily-snapshot primitives for advisor portfolio data.

Architectural lineage: clean-room re-derivation inspired by prior art in the personal-finance space (Maybe Finance / its AGPL fork, Sure). No GPL/AGPL code copied; license-clean Apache 2.0 implementation. Improvements over prior art for advisor use:
- Explicit `firmId` for **RIA tenancy above household**
- ISIN / CUSIP / SEDOL **first-class** on `Security` (not ticker overload)
- Splits / corporate actions as **first-class event kinds** (`split`, `reorg` rather than smuggled into trade rows)
- Audit-log integration on **every mutation** (SEC 204-2 retention)

**Pattern: immutable event stream → daily materialized snapshots.**

`HoldingEvent` records `buy` / `sell` / `dividend` / `interest` / `fee` / `split` / `transfer_in` / `transfer_out` / `reorg` / `mark`. Append-only with `(accountId, sourceId, externalId)` idempotency for provider-pushed events.

`materializeSnapshots(events, prices, { asOfDate })` replays the stream and produces one `HoldingSnapshot` per `(account, security, currency)`. **Deterministic** — same events + prices always produce byte-identical outputs, which is what makes audit-log hash chaining meaningful.

**Cost-basis provenance** — every snapshot carries `costBasisSource: 'manual' | 'computed' | 'custodian'` and a `costBasisLocked` flag, so user-edited basis isn't stomped by the next provider sync.

**`AccountBalance`** ships with **explicit inflow/outflow decomposition** (`cashInflows`, `cashOutflows`, `nonCashInflows`, `nonCashOutflows`, `marketDrift`, `adjustments`) — feeding TWR / MWR / IRR calculations directly.

Plus event builders (`buyEvent`, `sellEvent`, `dividendEvent`, `splitEvent`, `transferInEvent`, `markEvent`, …), `CashEvent` / `TransferLink` / `CustodianConnection` / `ExternalAccountMirror` / `AdvisorAccess` (scope hierarchy), and `InMemoryHoldingsStore` for tests.
