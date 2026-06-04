---
"@protocolwealthos/planning-contract": minor
---

PlanningContract v1.1.0 (additive, backward-compatible). Mirrors the nexus-core
engine: input `accounts.employer_plan_aggregate` (401k/403b — not directly
convertible, folds into the RMD-drag pool); structured `YearAnalysis.aca`
(`AcaInteraction`) for the ACA premium-tax-credit cliff when an ACA situation is
injected; and `DoNothingProjection.survivor_first_year_rmd_marginal_rate` +
`employer_plan_aggregate`. `PLANNING_CONTRACT_VERSION` 1.0.0 → 1.1.0; schema `$id`
bumped. A v1.0.0 consumer is unaffected (new fields are optional/defaulted).
