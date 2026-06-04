# @protocolwealthos/planning-contract

## 0.2.0

### Minor Changes

- [#49](https://github.com/Protocol-Wealth/pwos-core/pull/49) [`89ab3e8`](https://github.com/Protocol-Wealth/pwos-core/commit/89ab3e8b5ce243846fe5285f157bda208c488036) Thanks [@rivendale](https://github.com/rivendale)! - Add `@protocolwealthos/planning-contract` — the PII-free TypeScript ABI for the
  Roth-conversion + IRMAA planning capability. Ships the `PlanningContract` input
  shape, the `RothConversionAnalysis` output shape, the canonical Draft-2020-12
  JSON-Schema (`PLANNING_CONTRACT_JSON_SCHEMA`, a mirror of the nexus-core source of
  truth), and the MCP tool definitions (`analyze_roth_conversion`,
  `sequence_conversions`, `irmaa_headroom`) + `registerPlanningTools`. Declarations
  only: the math lives in the nexus-core engine, reached over the planning gateway.
  PlanningContract v1.0.0; PII-free by construction (opaque case_id, birth years not
  DOBs, aggregated balances).
