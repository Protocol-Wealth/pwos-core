---
"@protocolwealthos/onchain-accounting-contract": minor
---

Add the PII-free TypeScript/runtime ABI for deployed nexus-core onchain
accounting contract `0.2.0`. The new package includes strict request and
serialized-response schemas for historical pricing, event decoding,
account-scoped FIFO cost basis/replay, and realized-PnL reports; bounded exact
decimal-string validation; generated Draft 2020-12 JSON Schemas; version/tool
constants; response-correlation and governance-readiness helpers; and
advisor-tier read-only tool declarations. The math, methodology, private client
linkage, statement composition, approvals, and records retention remain outside
this package.
