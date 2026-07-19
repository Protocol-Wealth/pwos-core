# @protocolwealthos/ai-guardrails

## 0.2.1

### Patch Changes

- [#87](https://github.com/Protocol-Wealth/pwos-core/pull/87) [`dce504c`](https://github.com/Protocol-Wealth/pwos-core/commit/dce504c6801da7efb720fc5429170050b7acadde) Thanks [@rivendale](https://github.com/rivendale)! - Ship LICENSE and NOTICE in every published tarball, and guard the compiled publish shape.

  - Each package's `prepack` now copies the repository-root `LICENSE` and `NOTICE` into the package before packing, so every tarball carries the full Apache-2.0 license text and the NOTICE (Apache-2.0 §4(d) NOTICE propagation + the USPTO defensive-patent notice and third-party attributions). Previously `NOTICE` never reached npm and `LICENSE` shipped only via pnpm auto-hoisting.
  - Added `"LICENSE"` and `"NOTICE"` to the `files` array of the four packages that omitted them (`disclosure-card`, `onchain-accounting-contract`, `planning-contract`, `shared`) and resolved the dangling `files` references in the rest.
  - Added `pnpm lint:publish` (`scripts/check-publish-shape.mjs`), run in CI and as a publish preflight, which fails if any published `main`/`types`/`exports` entry would resolve to raw `./src/*.ts` instead of a compiled `./dist` artifact.

  No library source or runtime behavior changes.

## 0.2.0

### Minor Changes

- [#13](https://github.com/Protocol-Wealth/pwos-core/pull/13) [`4d0f9f6`](https://github.com/Protocol-Wealth/pwos-core/commit/4d0f9f62750c5cc0195d200b4f3c2523b967e8c3) Thanks [@rivendale](https://github.com/rivendale)! - Initial release: safety primitives for calling Anthropic-style LLM APIs from regulated environments.

  Composable building blocks; zero vendor SDK dependency.

  **Boot-time:**

  - `assertWorkspace` / `assertWorkspaceFromEnv` — fail-fast check that workspace id matches expected (e.g. your ZDR-enrolled workspace) at process start. Default posture `block`; `warn` available for shadow modes.
  - `createModelResolver` — refuse hardcoded model literals; resolve application aliases (`FRONTIER` / `WORKHORSE` / `EXTRACTION` / …) from env at boot, with optional vendor-prefix allowlisting (`["claude-"]`).

  **Per-request:**

  - `markCacheable` / `cacheControlMarker` — Anthropic prompt-cache marker helpers (`cache_control: { type: "ephemeral" }`) for system prompts and tool-definition prefixes.
  - `assertNoPiiInCachedPrefix` — wire a PII scanner into the cache boundary; the scanner is caller-supplied so the package stays free of pii-guard runtime coupling.

  **Per-response:**

  - `buildAuditRow` — content-free audit row (sha256 of prompt + response + each tool_use block, plus model id, token counts, trace id, latency, error class). Pair with `@protocolwealthos/audit-log`.

  The discipline only works if you call them — compose them once into your model-client wrapper and forbid raw SDK usage in the rest of your app.
