# @protocolwealthos/planning-contract

PII-free TypeScript ABI for the Roth-conversion + IRMAA planning capability.

This package is the **shared shape** between the planning engine (nexus-core,
Python), the planning UI (pwplan-core, React), and the application layer (pw-api).
The math lives in nexus-core; this package ships only the contract types, the
canonical JSON-Schema, and the MCP tool definitions.

```bash
npm install @protocolwealthos/planning-contract
```

## What's in it

- **`PlanningContract`** — the PII-free input case (`contract.ts`). Opaque
  `case_id`, birth **years** not dates of birth, aggregated balances. No identity
  field exists anywhere, by construction — this is the Reg S-P §248.30(b) design.
- **`RothConversionAnalysis`** — the serializable, identity-free output
  (`analysis.ts`): per-year recommended amount under each ceiling, the binding
  ceiling, incremental federal + state tax, the IRMAA cliff cost, the breakeven
  rate, the do-nothing RMD drag, and the snapshot metadata.
- **`PLANNING_CONTRACT_JSON_SCHEMA`** — a faithful copy of the canonical
  nexus-core JSON-Schema (Draft 2020-12), for validating the wire shape without
  the engine.
- **MCP tool definitions** — `analyze_roth_conversion`, `sequence_conversions`,
  `irmaa_headroom` (`tools.ts`) + `registerPlanningTools(registry)`. Declarations
  only: invoking a tool routes to the nexus-core engine over the planning gateway;
  no engine logic is duplicated here.

## Versioning

`PLANNING_CONTRACT_VERSION` is the semver of the contract shape (currently
`1.1.0` — additive since 1.0.0: `accounts.employer_plan_aggregate`, plus structured
`YearAnalysis.aca` + survivor-compression output). A breaking change is a cross-repo
event — bump the major in nexus-core,
this package, and pwplan-core together. The nexus-core JSON-Schema is the
cross-language source of truth.

## Contract Boundary

`@protocolwealthos/planning-contract` is a generic, adopter-facing public
contract for planning request/response shapes and tool definitions. Private
estate wiring feedback may reveal reusable contract gaps; only generic,
non-private improvements belong in this repository (tracked in
[#76](https://github.com/Protocol-Wealth/pwos-core/issues/76)).

Never commit private client/advisor data, credentials, API keys, production
endpoint URLs, firm-specific settings, or private-estate identifiers.

## Example

```ts
import {
  PLANNING_CONTRACT_VERSION,
  registerPlanningTools,
  type PlanningContract,
  type RothConversionAnalysis,
} from "@protocolwealthos/planning-contract";
import { ToolRegistry } from "@protocolwealthos/mcp-tools";

const contract: PlanningContract = {
  case_id: "case-opaque-001",
  tax_year: 2026,
  filing_status: "mfj",
  state_code: "PA",
  birth_years: [1962, 1963],
  income_ex_conversion: { pension: 30_000, social_security_gross: 48_000 },
  accounts: { trad_ira_aggregate: 1_400_000, taxable_liquidity: 250_000 },
  intent: { target_rule: "fill_to_irmaa_tier", years: [2026, 2027] },
};

const registry = new ToolRegistry();
registerPlanningTools(registry); // analyze_roth_conversion, sequence_conversions, irmaa_headroom
```

Educational scenario analysis only — not investment, tax, or legal advice.
Apache-2.0 · defensive patent USPTO #64/034,215.
