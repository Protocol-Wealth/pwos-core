# @protocolwealthos/ledger

> Append-only double-entry ledger primitives. Account hierarchy, posting/transaction with sum-to-zero invariant, balance assertions, reverse-only edits, optional bailment-mode invariants for advisor shadow-ledgers.

Apache 2.0 · Patent Pending: USPTO #64/034,215 · part of [pwos-core](https://github.com/Protocol-Wealth/pwos-core).

## Why this exists

Most "ledger" libraries either (a) assume a database and bake in the persistence layer, or (b) pull in a heavy decimal library and a kitchen sink of accounting features. This package does neither. It ships:

- **Storage-agnostic primitives.** Account, Posting, Transaction, BalanceAssertion, Pad. Implement `LedgerStore` against your Postgres / SQLite / EventStore / whatever.
- **Exact decimal arithmetic.** `Amount = { value: bigint, scale: number, currency }` — no IEEE-754 surprises, no `decimal.js` runtime dep.
- **Append-only by contract.** No `update`, no `delete`. To correct a transaction, append a sign-flipped reversing transaction. Discipline is the API.
- **Bailment-mode invariants.** For advisor shadow-ledgers — pooled-equals-claims, custodian drift detection, claims-by-client rollup.

Architectural lineage: independently re-implemented inspired by Beancount's data model. No GPL code copied; clean-room Apache 2.0 implementation.

## Install

```sh
pnpm add @protocolwealthos/ledger
```

## Quick start

```ts
import {
  asAccountName, asCurrency,
  buildTransaction, posting, parseAmount,
  InMemoryLedgerStore,
} from "@protocolwealthos/ledger";

const USD = asCurrency("USD");
const cash = asAccountName("Assets:US:Checking");
const groceries = asAccountName("Expenses:Food:Groceries");

const store = new InMemoryLedgerStore();
await store.openAccount({ name: cash, root: "Assets", openedOn: "2026-01-01", booking: "NONE", meta: {} });
await store.openAccount({ name: groceries, root: "Expenses", openedOn: "2026-01-01", booking: "NONE", meta: {} });

const tx = buildTransaction({
  id: "tx_1" as TxId,
  date: "2026-05-08",
  narration: "Whole Foods",
  payee: "Whole Foods Market",
  postings: [
    posting(groceries, parseAmount("87.42", USD, 2)),
    posting(cash,      parseAmount("-87.42", USD, 2)),
  ],
});

const result = await store.appendTransaction(tx);
if (!result.ok) console.error(result.error);
```

## Five canonical roots

Every account lives under exactly one of `Assets`, `Liabilities`, `Equity`, `Income`, `Expenses`. Subpaths are colon-delimited and validated to `[A-Za-z0-9_-]+`. Helper:

```ts
parseAccountName("Assets:US:BofA:Checking");
// → { root: "Assets", segments: ["Assets", "US", "BofA", "Checking"] }
```

## The sum-to-zero invariant

Every transaction must net to zero **per (currency, scale)**. The validator returns a structured `{ code: "transaction_unbalanced", ... }` error if a residual exists. There's no auto-balancing leg in v0.5.0 — explicit is better than implicit.

```ts
import { validateTransaction } from "@protocolwealthos/ledger";

const out = validateTransaction(tx, { accounts: store.accounts });
if (!out.ok) {
  console.error(out.error.code); // "transaction_unbalanced" | "account_not_found" | ...
}
```

## Reverse-only edits

```ts
const reversal = await store.reverse("tx_1" as TxId, "tx_2" as TxId, {
  date: "2026-05-09",
  narration: "Reverses tx_1: amount was wrong",
});
```

The original row stays. The reversing row carries `reverses: "tx_1"` so an audit-log replay can pair them. **Never** edit the original — the contract is immutable.

## Balance assertions

Use balance assertions as data-integrity checkpoints. After reconciling against your bank statement on 2026-05-09:

```ts
await store.appendBalance({
  id: "ba_1" as AssertionId,
  date: "2026-05-09",
  account: cash,
  expected: parseAmount("1234.56", USD, 2),
  recordedAt: new Date().toISOString(),
});
```

If the replayed balance doesn't match, you get a `balance_mismatch` error. This is the canonical "you forgot to record a transaction" detector.

## Bailment-mode invariants

For advisor scenarios where the firm holds client assets in transit through pooled custody, the bailment-mode invariants enforce trust-accounting properties:

```ts
import {
  verifyPooledEqualsClaims,
  detectCustodianDrift,
  claimsByClient,
} from "@protocolwealthos/ledger";

// Invariant 1: every unit in `Assets:Pooled:*` is claimed by exactly
// one `Liabilities:Bailment:*` row.
const inv = verifyPooledEqualsClaims(transactions);

// Invariant 3: shadow ledger reconciles against custodian statements.
const drift = detectCustodianDrift(transactions, [
  { custodian: "Apex", asset: AAPL, scale: 0, asOfDate: "2026-05-08", reportedBalance: ... },
]);
if (drift.length > 0) alertOpsDeskNow(drift);

// Per-client rollup for statements
const claims = claimsByClient(transactions, AAPL, 0, "2026-05-31");
```

## Audit-log integration

Pair with [`@protocolwealthos/audit-log`](../audit-log) — every `append*` call should write one row. The reference Postgres template at `packages/audit-log/src/sql/appendOnlyTrigger.sql` provides the BEFORE DELETE / BEFORE UPDATE triggers that mirror this package's semantics at the database layer.

## What's NOT in v0.5.0

Deferred to v0.5.1+:

- **Cost basis + lot tracking.** `Cost`, `Inventory`, `Lot`, booking-method-driven lot selection (FIFO/LIFO/HIFO/AVERAGE).
- **Multi-currency operations within a single posting** (e.g. `10 AAPL @ 150 USD` cost-bearing legs).
- **Price database** for mark-to-market valuation.
- **BQL-style query language.**

The shapes and types are designed to extend cleanly — `Posting` already reserves space for `cost?: Cost`, and `BookingMethod` is wired through `Account`.

## License

Apache 2.0 with USPTO Application #64/034,215 defensive patent grant.
