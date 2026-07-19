# @protocolwealthos/ledger

## 0.2.1

### Patch Changes

- [#87](https://github.com/Protocol-Wealth/pwos-core/pull/87) [`dce504c`](https://github.com/Protocol-Wealth/pwos-core/commit/dce504c6801da7efb720fc5429170050b7acadde) Thanks [@rivendale](https://github.com/rivendale)! - Ship LICENSE and NOTICE in every published tarball, and guard the compiled publish shape.

  - Each package's `prepack` now copies the repository-root `LICENSE` and `NOTICE` into the package before packing, so every tarball carries the full Apache-2.0 license text and the NOTICE (Apache-2.0 §4(d) NOTICE propagation + the USPTO defensive-patent notice and third-party attributions). Previously `NOTICE` never reached npm and `LICENSE` shipped only via pnpm auto-hoisting.
  - Added `"LICENSE"` and `"NOTICE"` to the `files` array of the four packages that omitted them (`disclosure-card`, `onchain-accounting-contract`, `planning-contract`, `shared`) and resolved the dangling `files` references in the rest.
  - Added `pnpm lint:publish` (`scripts/check-publish-shape.mjs`), run in CI and as a publish preflight, which fails if any published `main`/`types`/`exports` entry would resolve to raw `./src/*.ts` instead of a compiled `./dist` artifact.

  No library source or runtime behavior changes.

## 0.2.0

### Minor Changes

- [#15](https://github.com/Protocol-Wealth/pwos-core/pull/15) [`1a0b471`](https://github.com/Protocol-Wealth/pwos-core/commit/1a0b47173329d808dd486f05e93cfcea4484633c) Thanks [@rivendale](https://github.com/rivendale)! - Initial release: append-only double-entry ledger primitives.

  Architectural lineage: clean-room re-derivation inspired by Beancount's data model (GPL-2; not source-derived). License-clean Apache 2.0 implementation.

  **Core surface:**

  - `Account` / `Posting` / `Transaction` / `BalanceAssertion` / `Pad` — value types with five canonical roots (Assets / Liabilities / Equity / Income / Expenses), colon-delimited account names, and immutability by contract.
  - `validateTransaction` — sum-to-zero per (currency, scale), account existence + open-window checks, currency restrictions. Returns structured `Result<Transaction, LedgerError>`.
  - `LedgerStore` interface + `InMemoryLedgerStore` for tests. Append-only API: `appendTransaction`, `appendBalance`, `appendPad`, plus account lifecycle.
  - `reverseTransaction` / `store.reverse(id)` — the **only** way to correct a posted entry (no `update`, no `delete`).
  - `parseAmount` / `formatAmount` / `addAmount` / `negateAmount` — exact decimal arithmetic via `bigint` with explicit scale. No IEEE-754 surprises; survives the `0.1 + 0.2` trap.

  **Bailment-mode invariants** for advisor shadow ledgers:

  - `verifyPooledEqualsClaims` — every unit in `Assets:Pooled:*` is claimed by exactly one `Liabilities:Bailment:*` row, per asset.
  - `detectCustodianDrift` — compares the shadow ledger's pooled balance against custodian-reported balances; emits one finding per non-zero drift.
  - `claimsByClient` — per-beneficiary rollup for client statements.

  **v0.5.0 ships single-currency MVP.** Cost basis + lot tracking (FIFO/LIFO/HIFO/AVERAGE selection) lands in v0.5.1; the type system already reserves space (`Cost`, `BookingMethod`, `Lot`) so the upgrade is additive.

  Pair with `@protocolwealthos/audit-log` — every `append*` call should emit one audit row. The reference Postgres template at `packages/audit-log/src/sql/appendOnlyTrigger.sql` enforces this package's append-only contract at the database layer.
