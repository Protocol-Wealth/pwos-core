# @protocolwealthos/planning-contract

## 0.3.1

### Patch Changes

- [#78](https://github.com/Protocol-Wealth/pwos-core/pull/78) [`0e3b777`](https://github.com/Protocol-Wealth/pwos-core/commit/0e3b777b918ed69b6d7ca7e36c4932b06428cb7c) Thanks [@lifrmn](https://github.com/lifrmn)! - Document the contract boundary for the primitives consumed by the private
  estate. Each README gains a "Contract Boundary" section clarifying that the
  package exposes a generic, adopter-facing public contract that must not depend
  on private-estate data, credentials, production endpoint URLs, firm-specific
  settings, or private-estate identifiers. Only reusable, non-private contract
  improvements land here; feedback is tracked in [#76](https://github.com/Protocol-Wealth/pwos-core/issues/76).

- [`420c388`](https://github.com/Protocol-Wealth/pwos-core/commit/420c388811893ddd202650c2d481a5aaa608559a) - Synchronize exported VERSION constants with package manifests and keep PlanningContract public descriptions aligned with contract v1.1.0.

- Updated dependencies [[`420c388`](https://github.com/Protocol-Wealth/pwos-core/commit/420c388811893ddd202650c2d481a5aaa608559a)]:
  - @protocolwealthos/mcp-tools@0.3.1

## 0.3.0

### Minor Changes

- [#54](https://github.com/Protocol-Wealth/pwos-core/pull/54) [`ea50cc0`](https://github.com/Protocol-Wealth/pwos-core/commit/ea50cc00ef812eaf782cf89f6ade3f14357471ca) Thanks [@rivendale](https://github.com/rivendale)! - PlanningContract v1.1.0 (additive, backward-compatible). Mirrors the nexus-core
  engine: input `accounts.employer_plan_aggregate` (401k/403b — not directly
  convertible, folds into the RMD-drag pool); structured `YearAnalysis.aca`
  (`AcaInteraction`) for the ACA premium-tax-credit cliff when an ACA situation is
  injected; and `DoNothingProjection.survivor_first_year_rmd_marginal_rate` +
  `employer_plan_aggregate`. `PLANNING_CONTRACT_VERSION` 1.0.0 → 1.1.0; schema `$id`
  bumped. A v1.0.0 consumer is unaffected (new fields are optional/defaulted).

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
