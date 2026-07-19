# @protocolwealthos/holdings

## 0.2.1

### Patch Changes

- [#87](https://github.com/Protocol-Wealth/pwos-core/pull/87) [`dce504c`](https://github.com/Protocol-Wealth/pwos-core/commit/dce504c6801da7efb720fc5429170050b7acadde) Thanks [@rivendale](https://github.com/rivendale)! - Ship LICENSE and NOTICE in every published tarball, and guard the compiled publish shape.

  - Each package's `prepack` now copies the repository-root `LICENSE` and `NOTICE` into the package before packing, so every tarball carries the full Apache-2.0 license text and the NOTICE (Apache-2.0 §4(d) NOTICE propagation + the USPTO defensive-patent notice and third-party attributions). Previously `NOTICE` never reached npm and `LICENSE` shipped only via pnpm auto-hoisting.
  - Added `"LICENSE"` and `"NOTICE"` to the `files` array of the four packages that omitted them (`disclosure-card`, `onchain-accounting-contract`, `planning-contract`, `shared`) and resolved the dangling `files` references in the rest.
  - Added `pnpm lint:publish` (`scripts/check-publish-shape.mjs`), run in CI and as a publish preflight, which fails if any published `main`/`types`/`exports` entry would resolve to raw `./src/*.ts` instead of a compiled `./dist` artifact.

  No library source or runtime behavior changes.

## 0.2.0

### Minor Changes

- [#15](https://github.com/Protocol-Wealth/pwos-core/pull/15) [`1a0b471`](https://github.com/Protocol-Wealth/pwos-core/commit/1a0b47173329d808dd486f05e93cfcea4484633c) Thanks [@rivendale](https://github.com/rivendale)! - Initial release: account / security / event-stream / daily-snapshot primitives for advisor portfolio data.

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
