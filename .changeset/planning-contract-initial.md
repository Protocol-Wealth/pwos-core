---
"@protocolwealthos/planning-contract": minor
---

Add `@protocolwealthos/planning-contract` — the PII-free TypeScript ABI for the
Roth-conversion + IRMAA planning capability. Ships the `PlanningContract` input
shape, the `RothConversionAnalysis` output shape, the canonical Draft-2020-12
JSON-Schema (`PLANNING_CONTRACT_JSON_SCHEMA`, a mirror of the nexus-core source of
truth), and the MCP tool definitions (`analyze_roth_conversion`,
`sequence_conversions`, `irmaa_headroom`) + `registerPlanningTools`. Declarations
only: the math lives in the nexus-core engine, reached over the planning gateway.
PlanningContract v1.0.0; PII-free by construction (opaque case_id, birth years not
DOBs, aggregated balances).
