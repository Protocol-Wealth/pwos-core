---
"@protocolwealthos/ledger": minor
---

Initial release: append-only double-entry ledger primitives.

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
