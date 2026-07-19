# @protocolwealthos/onchain-accounting-contract

## 0.2.1

### Patch Changes

- [#87](https://github.com/Protocol-Wealth/pwos-core/pull/87) [`dce504c`](https://github.com/Protocol-Wealth/pwos-core/commit/dce504c6801da7efb720fc5429170050b7acadde) Thanks [@rivendale](https://github.com/rivendale)! - Ship LICENSE and NOTICE in every published tarball, and guard the compiled publish shape.

  - Each package's `prepack` now copies the repository-root `LICENSE` and `NOTICE` into the package before packing, so every tarball carries the full Apache-2.0 license text and the NOTICE (Apache-2.0 §4(d) NOTICE propagation + the USPTO defensive-patent notice and third-party attributions). Previously `NOTICE` never reached npm and `LICENSE` shipped only via pnpm auto-hoisting.
  - Added `"LICENSE"` and `"NOTICE"` to the `files` array of the four packages that omitted them (`disclosure-card`, `onchain-accounting-contract`, `planning-contract`, `shared`) and resolved the dangling `files` references in the rest.
  - Added `pnpm lint:publish` (`scripts/check-publish-shape.mjs`), run in CI and as a publish preflight, which fails if any published `main`/`types`/`exports` entry would resolve to raw `./src/*.ts` instead of a compiled `./dist` artifact.

  No library source or runtime behavior changes.

- Updated dependencies [[`dce504c`](https://github.com/Protocol-Wealth/pwos-core/commit/dce504c6801da7efb720fc5429170050b7acadde)]:
  - @protocolwealthos/mcp-tools@0.3.2

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

  This minor release intentionally prepares `0.2.0` as the package's first public
  version from the `0.1.0` source baseline. npm package semver and Nexus
  wire-contract versions are independent even though both currently read `0.2.0`.

## 0.1.0 (pre-release source baseline; first public release prepared as 0.2.0)

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

This source baseline was not published. `0.2.0` is versioned as the first public
release, with registry publication still pending; npm package semver remains
independent of Nexus wire-contract versioning.
