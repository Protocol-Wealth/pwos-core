# @protocolwealthos/compliance

## 0.4.2

### Patch Changes

- [#87](https://github.com/Protocol-Wealth/pwos-core/pull/87) [`dce504c`](https://github.com/Protocol-Wealth/pwos-core/commit/dce504c6801da7efb720fc5429170050b7acadde) Thanks [@rivendale](https://github.com/rivendale)! - Ship LICENSE and NOTICE in every published tarball, and guard the compiled publish shape.

  - Each package's `prepack` now copies the repository-root `LICENSE` and `NOTICE` into the package before packing, so every tarball carries the full Apache-2.0 license text and the NOTICE (Apache-2.0 §4(d) NOTICE propagation + the USPTO defensive-patent notice and third-party attributions). Previously `NOTICE` never reached npm and `LICENSE` shipped only via pnpm auto-hoisting.
  - Added `"LICENSE"` and `"NOTICE"` to the `files` array of the four packages that omitted them (`disclosure-card`, `onchain-accounting-contract`, `planning-contract`, `shared`) and resolved the dangling `files` references in the rest.
  - Added `pnpm lint:publish` (`scripts/check-publish-shape.mjs`), run in CI and as a publish preflight, which fails if any published `main`/`types`/`exports` entry would resolve to raw `./src/*.ts` instead of a compiled `./dist` artifact.

  No library source or runtime behavior changes.

- Updated dependencies [[`dce504c`](https://github.com/Protocol-Wealth/pwos-core/commit/dce504c6801da7efb720fc5429170050b7acadde)]:
  - @protocolwealthos/disclosure-card@0.3.2

## 0.4.1

### Patch Changes

- [`420c388`](https://github.com/Protocol-Wealth/pwos-core/commit/420c388811893ddd202650c2d481a5aaa608559a) - Synchronize exported VERSION constants with package manifests and keep PlanningContract public descriptions aligned with contract v1.1.0.

- Updated dependencies [[`0e3b777`](https://github.com/Protocol-Wealth/pwos-core/commit/0e3b777b918ed69b6d7ca7e36c4932b06428cb7c)]:
  - @protocolwealthos/disclosure-card@0.3.1

## 0.4.0

### Minor Changes

- [#63](https://github.com/Protocol-Wealth/pwos-core/pull/63) [`622e671`](https://github.com/Protocol-Wealth/pwos-core/commit/622e6716ca72842e3db234b90f099783f0f9b58e) Thanks [@rivendale](https://github.com/rivendale)! - Add `wrapWithCompliance<T>(data, options)` — a generic, one-shot primitive that
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
    carries the _shape_, never PW's approved text).
  - `meta` — `{ generatedAt, auditId?, provenanceHash? }`.

  Audit + provenance are **optional injected async callbacks**
  (`recordAudit?`, `hashProvenance?`), so the wrapper composes
  `@protocolwealthos/audit-log` and `@protocolwealthos/shared/provenance` without
  a hard dependency on either. When a hook is absent, its `meta` field is omitted
  entirely (not set to `undefined`). Aligns with — rather than duplicates — the
  existing `disclaimerFilter` in `@protocolwealthos/mcp-tools`: this is the
  one-shot, schema-validated, audit-aware sibling for non-MCP call sites.

  Adds a `workspace:^` dependency on `@protocolwealthos/disclosure-card`.

## 0.3.0

### Minor Changes

- [#13](https://github.com/Protocol-Wealth/pwos-core/pull/13) [`4d0f9f6`](https://github.com/Protocol-Wealth/pwos-core/commit/4d0f9f62750c5cc0195d200b4f3c2523b967e8c3) Thanks [@rivendale](https://github.com/rivendale)! - Add a vendor-document advisory metadata schema for SOC 1 / SOC 2 / ISO / DPA / pen-test / insurance / privacy-policy records.

  The `VendorDocMetadata` type captures the structured facts compliance teams want to surface in dashboards and search:

  - **Identity** — `kind`, `title`, `sourceRef`, `sourceSha256` (chain-of-custody anchor), `issuedAt`, `expiresAt`
  - **Attestation** — `auditPeriodStart` / `End`, `opinion` (unqualified / qualified / adverse / disclaimer / unknown), `trustServicesCriteria[]` for SOC 2, `exceptionCount`, `findingSummaries[]`
  - **DPA / privacy** — `subprocessors[]` (with `region` and `hasDpa`), `retentionWindowDays`, `breachNotificationWindowDays`
  - **Pen-test** — `highestOpenSeverity`, `findingsByStatus`
  - **Provenance** — `human` vs `ai_advisory`. Documents are framed as **advisory metadata**: the source PDF remains the system of record; if AI extraction disagrees with the PDF, the PDF wins.

  Plus two helpers:

  - `isVendorDocCurrent(doc, nowIso)` — within validity window
  - `vendorDocsExpiringSoon(docs, nowIso, daysAhead)` — for nightly "re-up your SOC 2" reminders

## 0.2.0

### Minor Changes

- [#3](https://github.com/Protocol-Wealth/pwos-core/pull/3) [`97ecc22`](https://github.com/Protocol-Wealth/pwos-core/commit/97ecc22a54ee04933b3b17c31e9ef827a564481e) Thanks [@rivendale](https://github.com/rivendale)! - Initial public release of the `@protocolwealthos/*` package family — Apache 2.0 + USPTO [#64](https://github.com/Protocol-Wealth/pwos-core/issues/64)/034,215 defensive patent grant, OIN member.

  Nine compliance-first TypeScript primitives extracted from the [Protocol Wealth Operating System](https://pwos.app) and tested in production by an SEC-registered RIA:

  - **`@protocolwealthos/pii-guard`** — 4-layer PII scanning pipeline (regex + NER hook + financial recognizers + allow-list) with manifest-based round-trip rehydration
  - **`@protocolwealthos/audit-log`** — Append-only audit log with SHA-256 hash chaining for SEC Rule 204-2 Books-and-Records compliance
  - **`@protocolwealthos/onchain-sdk`** — Typed client + models for on-chain portfolio tracking services
  - **`@protocolwealthos/document-gen`** — Document model + RFC 4180 CSV generator + plain-text renderer with pluggable PDF/PPTX/DOCX backends
  - **`@protocolwealthos/mcp-tools`** — MCP tool registry, four-tier access classification (PUBLIC / ADVISOR / CLIENT_FILTERED / SENSITIVE), response-filter pipeline (disclaimer / PII redaction / public-tier sanitizer / observer), Anthropic Messages API adapter
  - **`@protocolwealthos/compliance`** — SEC Rule 204-2 retention calculator, Books-and-Records export bundler with chain-of-custody hashes, AI inventory types, PII incident classifier, compliance calendar, policy/vendor review status
  - **`@protocolwealthos/workflow-engine`** — Storage-agnostic durable-job runtime with retries, backoff strategies (fixed/linear/exponential + jitter), pluggable queue backends (in-memory shipped; BullMQ/Temporal/SQS via adapter)
  - **`@protocolwealthos/crm`** — Advisor CRM primitives (contact / household / interaction / opportunity / task) with status and aging helpers
  - **`@protocolwealthos/email-archive`** — SEC Rule 17a-4 email archive primitives with chain-of-custody hashing, retention enforcement, in-memory query evaluator

  All packages: TypeScript 5.6+, ESM, zero proprietary identifiers, ship `dist/index.js` + `dist/index.d.ts` + source. See [docs/publishing.md](https://github.com/Protocol-Wealth/pwos-core/blob/main/docs/publishing.md) for the release flow and [README](https://github.com/Protocol-Wealth/pwos-core) for the integration guide.
