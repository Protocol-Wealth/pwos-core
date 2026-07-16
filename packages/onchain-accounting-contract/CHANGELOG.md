# @protocolwealthos/onchain-accounting-contract

## 0.2.0

### Minor Changes

- [#82](https://github.com/Protocol-Wealth/pwos-core/pull/82) [`10d1035`](https://github.com/Protocol-Wealth/pwos-core/commit/10d10353b3217274325fdfdfc8da545cdf53908a) Thanks [@rivendale](https://github.com/rivendale)! - Add the PII-free TypeScript/runtime ABI for deployed nexus-core onchain
  accounting contract `0.2.0`. The new package includes strict request and
  serialized-response schemas for historical pricing, event decoding,
  account-scoped FIFO cost basis/replay, and realized-PnL reports; bounded exact
  decimal-string validation; generated Draft 2020-12 JSON Schemas; version/tool
  constants; tri-state response-correlation assessment; engine-scoped composition
  eligibility; exact discovery; and advisor-tier read-only tool declarations.
  Response schemas reject inconsistent arithmetic, partitions, counts, raw wallet
  references, forged holding periods, acquisition-fee bounds, or known totals,
  and incomplete dispositions whose semantic shortfall set is incomplete or
  overstated. Price overrides are unique in-query coordinates; duplicate query
  slots remain deterministic, and un-echoed decoder counterparties produce
  partial correlation. Engine-impossible opening replay/unknown-basis completeness
  states are rejected, and non-transfer classifications that drop transfer
  metadata are also partial. Generated JSON Schema is explicitly a structural
  hint; strict Zod parsing is authoritative.
  The math, transport binding, private client linkage, statement composition,
  delivery approvals, and records retention remain outside this package.

  This minor Changeset intentionally makes `0.2.0` the package's first published
  version from `0.1.0` source. npm package semver and Nexus wire-contract versions
  are independent even though both are `0.2.0` at first publication.

## 0.1.0 (source; first public release queued as 0.2.0)

### Added

- Initial local package source for Nexus accounting contract `0.2.0`.
- Strict runtime request/response schemas, exact decimal-string validation,
  Draft 2020-12 structural schema hints, version/tool constants, tri-state
  correlation assessment, engine-scoped composition eligibility, exact gateway
  discovery, and read-only tool declarations.
- Added exact response arithmetic and aggregate/partition validation, opaque
  response account references, bounded references/sources, and nonnegative
  constructed counters.
- Cost-basis and PnL response correlation fails closed as `unverifiable` until a
  future wire-contract bump adds a canonical request digest; private transport
  and audit binding remains mandatory.
- Synthetic Nexus-derived golden fixtures covering price history, event decode,
  FIFO cost basis/replay, realized PnL, and the de-identified boundary.

The queued minor Changeset owns the first public release version (`0.2.0`). npm
package semver remains independent of Nexus wire-contract versioning.
