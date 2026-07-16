# @protocolwealthos/onchain-accounting-contract

Strict, PII-free TypeScript ABI for nexus-core onchain accounting contract
`0.2.0`.

The math and methodology live in the sibling Python engine. This package ships
the reusable cross-language boundary: TypeScript types inferred from strict Zod
schemas, runtime request/response validation, generated Draft 2020-12 JSON
Schemas, version/tool constants, response-correlation helpers, and read-only MCP
tool declarations.

```bash
npm install @protocolwealthos/onchain-accounting-contract
```

## What It Covers

- `price_history`: historical USD prices with explicit unpriced gaps.
- `decode_onchain_events`: public-chain movements to a de-identified event
  ledger.
- `compute_cost_basis`: account-scoped FIFO lots, transfers, fees, replay,
  lineage, coverage, and completeness.
- `onchain_pnl_report`: realized-PnL and tax-year rollups with methodology
  provenance and a tax-awareness disclaimer.
- `describe`: REST gateway introspection schema and all gateway/tool constants.

Every request object is strict. Unknown fields fail validation. The generic
parser recursively rejects identity-shaped keys, and every `account_ref` must be
opaque: raw EVM, Bitcoin, or supported-chain base58 wallet shapes are rejected.
Consumers remain responsible for a stronger value-level PII/canary boundary
before network egress because only the private application knows whether an
otherwise opaque string is reversible or client-derived.

## Version Axes

These versions are intentionally distinct:

| Constant | Current | Meaning |
|---|---:|---|
| `VERSION` | `0.1.0` | npm package source version; Changesets owns releases |
| `ACCOUNTING_CONTRACT_VERSION` | `0.2.0` | Nexus request/response wire ABI |
| `ACCOUNTING_METHOD_VERSION` | `2.0.0` | FIFO calculation methodology |
| `ACCOUNTING_REPLAY_VERSION` | `1.0.0` | Report-window replay protocol |

A consumer must validate the response body against the tool-specific schema;
that validation includes the exact `contractVersion` handshake. A contract
change is a cross-repo event: update Nexus, this package, fixtures, and every
consumer together.

The runtime Zod schemas are authoritative. Generated JSON Schema describes the
wire shape, while cross-field accounting invariants remain enforced by the
runtime parsers and correlation helpers.

## Exact Decimals

Accounting amounts are strings, never JavaScript numbers. Runtime schemas
enforce the same bounded decimal envelopes as Nexus:

| Value | Fractional digits | Integer digits |
|---|---:|---:|
| Direct quantities and unit prices | 36 | 42 |
| Explicit monetary totals | 72 | 84 |
| Authoritative replay/result values | 256 | 128 |

Scientific notation is accepted only when its represented value fits the
applicable envelope. `NaN`, infinity, oversized coefficients, and extreme
exponents fail before arithmetic. Exact comparison and correlation helpers use
integer coefficients rather than binary floating point.

## Usage

```ts
import {
  ACCOUNTING_CONTRACT_VERSION,
  isAccountingResponseCorrelated,
  isAccountingStatementReady,
  parseAccountingRequest,
  parseAccountingResponse,
} from "@protocolwealthos/onchain-accounting-contract";

const request = parseAccountingRequest("compute_cost_basis", {
  events: [],
  report_window: {
    start_at: 1_704_067_200,
    end_at: 1_735_689_600,
    full_history: true,
  },
  method: "fifo",
});

// `wireBody` is unknown JSON returned by the versioned engine gateway.
declare const wireBody: unknown;
const response = parseAccountingResponse("compute_cost_basis", wireBody);

console.log(ACCOUNTING_CONTRACT_VERSION); // "0.2.0"
console.log(isAccountingResponseCorrelated("compute_cost_basis", request, response));
console.log(isAccountingStatementReady(response));
```

The correlation helper checks every deterministic request coordinate echoed by
the gateway. Cost-basis and PnL responses do not carry a request digest, so the
consumer must also bind each response to its originating in-flight request and
audit record at the transport layer.

`isAccountingStatementReady` is deliberately fail-closed. Contract `0.2.0`
currently reports methodology review status `pending_governance_review`, so
`completeness.statement_ready` remains `false` even when the calculation itself
is complete. Passing CI or code review is not methodology approval.

## Tool Declarations

`ACCOUNTING_TOOL_DEFINITIONS` and `registerAccountingTools(registry)` declare the
four calculation tools as advisor-tier, read-only, idempotent tools. They do not
implement math or transport. The `describe` handler is REST introspection and is
therefore represented in gateway constants/schemas, not registered as a global
model-visible tool with a collision-prone generic name.

## Contract Boundary

This package contains generic, public-safe shapes only. It does not ingest
client data, map wallets to clients, retain records, prepare or release
statements, render reports, provide tax advice, or implement a tax return. Those
responsibilities belong to the consumer application. Do not commit client or
advisor data, reversible private identifiers, credentials, API keys, production
endpoint URLs, or firm-specific policy values here.

The contract mirrors the Apache-2.0 Nexus implementation and public accounting
methodology. Golden fixtures are synthetic and de-identified. No AGPL source was
copied.

Apache-2.0. Educational accounting/tax-awareness substrate only, not tax,
investment, or legal advice.
