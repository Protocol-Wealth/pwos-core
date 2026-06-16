---
"@protocolwealthos/compliance": minor
---

Add `wrapWithCompliance<T>(data, options)` — a generic, one-shot primitive that
wraps ANY tool output with the firm's compliance posture before it is surfaced.

The motivating case is a sibling analytical engine (nexus-core) whose public
planning tools return outputs ending in a `disclaimer` string — e.g.
`optimize_allocation` (target weights + `regime` + `disclaimer`) and
`build_planning_report` (`{ report, disclaimer }`). A firm consumer (pw-api,
pw-os-v2) must attach its own envelope around such an output before it reaches
an advisor or client. `wrapWithCompliance` returns a `ComplianceEnvelope<T>`:

- `data` — the original payload, carried through **unchanged** (generic over `T`).
- `disclosureCard` — the firm's machine-readable card, validated at the boundary
  via `@protocolwealthos/disclosure-card`'s parser (a malformed posture throws
  before any side effect runs).
- `disclaimer` — the firm-approved copy (caller-supplied; this OSS package
  carries the *shape*, never PW's approved text).
- `meta` — `{ generatedAt, auditId?, provenanceHash? }`.

Audit + provenance are **optional injected async callbacks**
(`recordAudit?`, `hashProvenance?`), so the wrapper composes
`@protocolwealthos/audit-log` and `@protocolwealthos/shared/provenance` without
a hard dependency on either. When a hook is absent, its `meta` field is omitted
entirely (not set to `undefined`). Aligns with — rather than duplicates — the
existing `disclaimerFilter` in `@protocolwealthos/mcp-tools`: this is the
one-shot, schema-validated, audit-aware sibling for non-MCP call sites.

Adds a `workspace:^` dependency on `@protocolwealthos/disclosure-card`.
