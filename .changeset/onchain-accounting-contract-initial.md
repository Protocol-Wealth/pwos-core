---
"@protocolwealthos/onchain-accounting-contract": minor
---

Add the PII-free TypeScript/runtime ABI for deployed nexus-core onchain
accounting contract `0.2.0`. The new package includes strict request and
serialized-response schemas for historical pricing, event decoding,
account-scoped FIFO cost basis/replay, and realized-PnL reports; bounded exact
decimal-string validation; generated Draft 2020-12 JSON Schemas; version/tool
constants; tri-state response-correlation assessment; engine-scoped composition
eligibility; exact discovery; and advisor-tier read-only tool declarations.
Response schemas reject inconsistent arithmetic, partitions, counts, raw wallet
references, forged holding periods or known totals, and incomplete dispositions
whose semantic shortfall set is incomplete or overstated. Price overrides are
unique in-query coordinates; duplicate query slots remain deterministic, and
un-echoed decoder counterparties produce partial correlation. Generated JSON
Schema is explicitly a structural hint; strict Zod parsing is authoritative.
The math, transport binding, private client linkage, statement composition,
delivery approvals, and records retention remain outside this package.

This minor Changeset intentionally makes `0.2.0` the package's first published
version from `0.1.0` source. npm package semver and Nexus wire-contract versions
are independent even though both are `0.2.0` at first publication.
