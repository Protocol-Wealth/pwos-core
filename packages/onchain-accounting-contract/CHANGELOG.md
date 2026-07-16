# @protocolwealthos/onchain-accounting-contract

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
