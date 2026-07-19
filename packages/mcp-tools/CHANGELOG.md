# @protocolwealthos/mcp-tools

## 0.3.2

### Patch Changes

- [#87](https://github.com/Protocol-Wealth/pwos-core/pull/87) [`dce504c`](https://github.com/Protocol-Wealth/pwos-core/commit/dce504c6801da7efb720fc5429170050b7acadde) Thanks [@rivendale](https://github.com/rivendale)! - Ship LICENSE and NOTICE in every published tarball, and guard the compiled publish shape.

  - Each package's `prepack` now copies the repository-root `LICENSE` and `NOTICE` into the package before packing, so every tarball carries the full Apache-2.0 license text and the NOTICE (Apache-2.0 §4(d) NOTICE propagation + the USPTO defensive-patent notice and third-party attributions). Previously `NOTICE` never reached npm and `LICENSE` shipped only via pnpm auto-hoisting.
  - Added `"LICENSE"` and `"NOTICE"` to the `files` array of the four packages that omitted them (`disclosure-card`, `onchain-accounting-contract`, `planning-contract`, `shared`) and resolved the dangling `files` references in the rest.
  - Added `pnpm lint:publish` (`scripts/check-publish-shape.mjs`), run in CI and as a publish preflight, which fails if any published `main`/`types`/`exports` entry would resolve to raw `./src/*.ts` instead of a compiled `./dist` artifact.

  No library source or runtime behavior changes.

## 0.3.1

### Patch Changes

- [`420c388`](https://github.com/Protocol-Wealth/pwos-core/commit/420c388811893ddd202650c2d481a5aaa608559a) - Synchronize exported VERSION constants with package manifests and keep PlanningContract public descriptions aligned with contract v1.1.0.

## 0.3.0

### Minor Changes

- [#11](https://github.com/Protocol-Wealth/pwos-core/pull/11) [`155abb0`](https://github.com/Protocol-Wealth/pwos-core/commit/155abb0b5f50a5b5d0a871b55c4dac53051b9c82) Thanks [@rivendale](https://github.com/rivendale)! - Add the **confirmation gate** framework for write-class LLM tools.

  Two-turn pattern: first call returns a deterministic preview + a `confirm_token` bound to the exact payload (sha256 over key-sorted JSON, truncated to 16 hex chars). Second call requires the matching token; any payload mutation invalidates the binding and the gate refuses to execute. Stateless — the token IS the contract.

  ```ts
  import {
    confirmGate,
    computeConfirmToken,
  } from "@protocolwealthos/mcp-tools";

  const outcome = await confirmGate({
    payload,
    confirmToken: input.confirm_token,
    operationLabel: "create record",
    renderPreview: (p) => `Will create "${p.name}" with amount ${p.amount}.`,
    execute: (p) => upstream.createRecord(p),
  });

  switch (outcome.phase) {
    case "preview":
      return { ok: true, content: outcome.previewMessage };
    case "executed":
      return { ok: true, content: JSON.stringify(outcome.result) };
    case "rejected":
      return { ok: false, error: outcome.error, code: outcome.code };
  }
  ```

  New exports: `confirmGate`, `computeConfirmToken`, `stableJsonString`, `formatPreviewMessage`, `CONFIRM_TOKEN_LENGTH`, types `ConfirmGateOptions`, `ConfirmGateOutcome`, `PreviewMessageArgs`.

  The result type is fully generic — callers adapt the discriminated `phase` outcome to whatever envelope their tool surface uses (Anthropic content blocks, MCP results, etc.).

- [#11](https://github.com/Protocol-Wealth/pwos-core/pull/11) [`155abb0`](https://github.com/Protocol-Wealth/pwos-core/commit/155abb0b5f50a5b5d0a871b55c4dac53051b9c82) Thanks [@rivendale](https://github.com/rivendale)! - Add the **tool-call audit row builder** — `buildToolAuditEntry()` — for compliance-grade per-tool-call audit trails in multi-turn LLM loops.

  Pure function: takes the raw tool input, the SCRUBBED tool output (i.e. AFTER a PII scanner has run), and the call metadata, and produces a `NewAuditEntry`-shaped record. SHA-256 hashes are computed over a stable JSON serialization of the input and over the scrubbed output text — the audit log itself can never become a correlation oracle for raw PII.

  Drops directly into `@protocolwealthos/audit-log`'s `AuditLogger.log()`, but stays dependency-free so it works with any audit backend.

  ```ts
  import { AuditLogger } from "@protocolwealthos/audit-log";
  import { buildToolAuditEntry } from "@protocolwealthos/mcp-tools";

  const t0 = Date.now();
  const result = await executeTool(name, input, ctx);
  const scrubbed = scrubPII(result.text);

  await logger.log(
    buildToolAuditEntry({
      actorId: session.sub,
      toolName: name,
      toolUseId: block.id,
      conversationId: convo.id,
      requestId: req.id,
      rawInput: input,
      scrubbedOutputText: scrubbed,
      ok: result.ok,
      latencyMs: Date.now() - t0,
      outputSanitized: scrubbed !== result.text,
    })
  );
  ```

  New exports: `buildToolAuditEntry`, `sha256Hex`, constants `DEFAULT_TOOL_CALLED_ACTION`, `SYSTEM_ACTOR_ID`, `TOOL_AUDIT_RESOURCE_TYPE`, types `ToolAuditEntry`, `ToolAuditEntryInput`, `ToolAuditDetails`.

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
