# @protocolwealthos/pii-guard

## 0.4.2

### Patch Changes

- [#87](https://github.com/Protocol-Wealth/pwos-core/pull/87) [`dce504c`](https://github.com/Protocol-Wealth/pwos-core/commit/dce504c6801da7efb720fc5429170050b7acadde) Thanks [@rivendale](https://github.com/rivendale)! - Ship LICENSE and NOTICE in every published tarball, and guard the compiled publish shape.

  - Each package's `prepack` now copies the repository-root `LICENSE` and `NOTICE` into the package before packing, so every tarball carries the full Apache-2.0 license text and the NOTICE (Apache-2.0 §4(d) NOTICE propagation + the USPTO defensive-patent notice and third-party attributions). Previously `NOTICE` never reached npm and `LICENSE` shipped only via pnpm auto-hoisting.
  - Added `"LICENSE"` and `"NOTICE"` to the `files` array of the four packages that omitted them (`disclosure-card`, `onchain-accounting-contract`, `planning-contract`, `shared`) and resolved the dangling `files` references in the rest.
  - Added `pnpm lint:publish` (`scripts/check-publish-shape.mjs`), run in CI and as a publish preflight, which fails if any published `main`/`types`/`exports` entry would resolve to raw `./src/*.ts` instead of a compiled `./dist` artifact.

  No library source or runtime behavior changes.

## 0.4.1

### Patch Changes

- [`420c388`](https://github.com/Protocol-Wealth/pwos-core/commit/420c388811893ddd202650c2d481a5aaa608559a) - Synchronize exported VERSION constants with package manifests and keep PlanningContract public descriptions aligned with contract v1.1.0.

## 0.4.0

### Minor Changes

- [#15](https://github.com/Protocol-Wealth/pwos-core/pull/15) [`1a0b471`](https://github.com/Protocol-Wealth/pwos-core/commit/1a0b47173329d808dd486f05e93cfcea4484633c) Thanks [@rivendale](https://github.com/rivendale)! - Add account-number masker — the "show last 4" pattern for tool outputs and structured-log redaction.

  `maskAccountNumber("1234567890123456")` → `"•••• 3456"`. Strips internal hyphens / spaces before measuring; rejects non-digit input. Configurable `reveal` count, `maskChar`, `maskLength`, and `separator`.

  `maskAccountNumbersInText(text)` walks free text, finds account-number-shaped runs (8–20 contiguous digits, optionally with internal hyphens or single spaces), and replaces them with the masked form. Preserves surrounding text verbatim.

  Use as a lightweight first-line defense for tool outputs; for richer detection (CUSIP / IBAN / SSN), the existing `scan()` pipeline + financial recognizers remain the canonical path.

  New exports: `maskAccountNumber`, `maskAccountNumbersInText`, type `MaskOptions`.

## 0.3.0

### Minor Changes

- [#11](https://github.com/Protocol-Wealth/pwos-core/pull/11) [`263d189`](https://github.com/Protocol-Wealth/pwos-core/commit/263d189908f4baa9482bb1d7a1462680512bd388) Thanks [@rivendale](https://github.com/rivendale)! - Add the **streaming rehydrator** — `createStreamRehydrator()` — for SSE / chunked LLM output.

  The existing `rehydrate()` works on a complete string. Streaming consumers face a harder problem: a placeholder like `<NAME_1>` may arrive split across two chunks (`<NA` then `ME_1>`). A naive per-chunk replace would emit garbled output. The streaming rehydrator buffers any tail starting with `<` until either the placeholder closes, the body exceeds the max placeholder length (so it can't be a placeholder), or the stream ends.

  ```ts
  import { createStreamRehydrator, scan } from "@protocolwealthos/pii-guard";

  const { manifest } = await scan(prompt);

  const rehydrator = createStreamRehydrator(manifest, (chunk) => {
    sseClient.send(chunk);
  });

  for await (const chunk of llmStream) rehydrator.push(chunk);
  rehydrator.flush();
  ```

  New exports: `createStreamRehydrator`, type `StreamRehydrator`. Defensive: a `null` or empty manifest is a zero-buffer passthrough; a malformed manifest entry that would throw in `rehydrate()` is caught so the stream never aborts mid-flight.

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
