# @protocolwealthos/onchain-accounting-contract

Strict, PII-free TypeScript ABI for nexus-core onchain accounting contract
`0.2.0`.

The math and methodology live in the sibling Python engine. This package ships
the reusable cross-language boundary: TypeScript types inferred from strict Zod
schemas, runtime request/response validation, generated Draft 2020-12 JSON
Schema hints, version/tool constants, fail-closed response-correlation
assessments, and read-only MCP tool declarations.

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
| `VERSION` | `0.1.0` | npm package source version on this branch; Changesets owns releases |
| `ACCOUNTING_CONTRACT_VERSION` | `0.2.0` | Nexus request/response wire ABI |
| `ACCOUNTING_METHOD_VERSION` | `2.0.0` | FIFO calculation methodology |
| `ACCOUNTING_REPLAY_VERSION` | `1.0.0` | Report-window replay protocol |

A consumer must validate the response body against the tool-specific schema;
that validation includes the exact `contractVersion` handshake. A contract
change is a cross-repo event: update Nexus, this package, fixtures, and every
consumer together.

The queued minor Changeset deliberately makes `0.2.0` the first published npm
version from the current `0.1.0` source. That package version is independent of
the Nexus wire version; both happen to be `0.2.0` at first publication and may
diverge afterward. `VERSION` is checked against the package manifest in CI and
is updated by the Changesets version workflow.

The runtime Zod schemas are authoritative. `ACCOUNTING_MODEL_INPUT_SCHEMA_HINTS`
and `ACCOUNTING_RESPONSE_STRUCTURE_SCHEMA_HINTS` are generated with explicit
input/output modes for model discovery and structural documentation. They do
not represent custom Zod refinements such as exact accounting arithmetic,
partition counts, or opaque-reference checks; always call the runtime parsers.

Runtime response validation mirrors Nexus calendar and aggregate semantics.
`holding_days` is the difference between UTC calendar dates, and a disposition
is long term only after its one-year calendar anniversary (February 29 rolls to
February 28 in a non-leap anniversary year). Known serialized totals are
required and exact, and a disposal's acquisition-fee component cannot exceed
its matched cost basis. Open-lot totals are null only when a serialized
component is unknown or an `unmatched_transfer_out` gap means inventory is
hidden. Incomplete dispositions must enumerate the exact semantic
`missing_fields` implied by their values and provenance. A complete result
cannot report unknown-basis open lots, and an opening-state replay cannot also
claim pre-period events.

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
  assessAccountingResponseCorrelation,
  isAccountingResponseCorrelationVerified,
  isNexusAccountingResultEligibleForComposition,
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
const correlation = assessAccountingResponseCorrelation(
  "compute_cost_basis",
  request,
  response,
);
console.log(correlation.status); // "unverifiable" in wire contract 0.2.0
console.log(
  isAccountingResponseCorrelationVerified("compute_cost_basis", request, response),
); // false
console.log(isNexusAccountingResultEligibleForComposition(response));
```

Correlation is intentionally tri-state: `verified`, `partial`, or
`unverifiable`. Every price override must uniquely identify a requested
coin/timestamp coordinate and verifies only when its exact value and override
provenance are echoed. Duplicate query coordinates are allowed; one unique
override applies deterministically to each matching ordered response slot.
Hintless decoder classifications can verify; decoder requests carrying
`protocol_hint`, `method`, movement `counterparty`, or transfer metadata dropped
by a non-transfer classification are only partial because contract `0.2.0` does
not echo those inputs. Cost-basis and PnL responses are always unverifiable
because they do not carry a canonical request digest. The boolean helper returns
`true` only for `verified`.

Private consumers must bind each response to its originating in-flight request,
request identifier, authenticated transport context, and immutable audit record
before accepting it. A future canonical request digest requires a coordinated
wire-contract version bump across Nexus, this package, fixtures, and consumers.

`isNexusAccountingResultEligibleForComposition` is deliberately engine-scoped
and fail-closed. It requires a strictly valid result, approved methodology,
bounded replay, complete partitions, no gaps or unresolved coverage, and
complete dispositions. It does not authorize client delivery, approve a
statement, satisfy books-and-records retention, or replace advisor/CCO review.
Contract `0.2.0` currently reports `pending_governance_review`, so composition
eligibility remains false. Passing CI or code review is not methodology
approval.

## Tool Declarations

`ACCOUNTING_TOOL_DEFINITIONS` and `registerAccountingTools(registry)` declare the
four calculation tools as advisor-tier, read-only, idempotent tools. They do not
implement math or transport. The `describe` handler is REST introspection and is
therefore represented in gateway constants/schemas, not registered as a global
model-visible tool with a collision-prone generic name.

`isAccountingGatewayCompatible` accepts discovery only when the contract is
exactly `0.2.0` and the duplicate-free handler set contains all five handlers
(`describe` plus the four calculations), regardless of order.

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
