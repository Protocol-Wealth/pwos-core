# Changelog

All notable changes to PWOS Core will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added — Phase 3b completion (compliance / workflow-engine / crm / email-archive)

Five remaining pwos-core stubs from Phase 3b were extended into
production-ready primitive packages on April 13. Combined with mcp-tools
(below), this completes the 9-package OSS surface area for pwos-core.

**@protocolwealthos/compliance** — SEC Rule 204-2 primitives:
- `RetentionCalculator` with 7 default policies (advisory 5y, audit 7y, etc.)
- `BooksAndRecordsBundle` with SHA-256 chain-of-custody hashes per section
- `evaluateCalendar` for annual/quarterly/monthly recurring obligations
- `classifySeverity` + `summarize` + `notifiableIncidents` for PII tracking
- `policyStatus` / `vendorStatus` + `policiesNeedingReview` / `vendorsNeedingReview`
- 26 vitest tests, typecheck clean

**@protocolwealthos/workflow-engine** — durable-job runtime:
- `Job` / `JobQueue` / `JobHandler` / `Worker` types and primitives
- Backoff: `fixed` / `linear` / `exponential` (+cap) with jitter decorators
- `InMemoryJobQueue` with priority, runAfter, idempotency keys
- `Worker` with retry policy, `PermanentJobError` short-circuit, observer hook
- 24 vitest tests, typecheck clean

**@protocolwealthos/crm** — advisor CRM types + status helpers:
- Contact / Household / Interaction / Opportunity / CrmTask types
- `isStaleContact` / `isOverdueTask` / `isStalledOpportunity` predicates + filters
- `groupByLifecycle` / `pipelineValueByStage` aggregations
- 15 vitest tests, typecheck clean

**@protocolwealthos/email-archive** — SEC Rule 17a-4 primitives:
- `ArchivedEmail` / `ArchiveQuery` / `EmailAttachment` types
- `hashEmail` + `finalizeRecord` + `verifyChain` for chain-of-custody
- `isPurgeable` + `purgeableEmails` for retention enforcement
- `evaluateQuery` in-memory eDiscovery evaluator
- 14 vitest tests, typecheck clean

### Added — mcp-tools extension

**@protocolwealthos/mcp-tools** — library-agnostic MCP tool primitives:
- `ToolDefinition` / `JsonSchema` / `ObjectSchema` / `ToolAnnotations` / `ToolResult` types
- `ToolTier` enum (`PUBLIC` / `ADVISOR` / `CLIENT_FILTERED` / `SENSITIVE`) with `tierRank`, `isAuthorizedFor`, `tierFilter`
- `ToolRegistry` class with `register` / `registerAll` / `upsert` / `find` / `get` / `unregister` / `listForTier` / `listByTags`, plus `ToolNameConflictError` and `ToolNotFoundError`
- Response-filter pipeline (`ResponseFilter` type, `applyFilters` runner) with built-ins:
  - `disclaimerFilter` — attach SEC-compliant text to successful responses
  - `piiRedactionFilter` — mask PII for CLIENT_FILTERED tier (plugs in @protocolwealthos/pii-guard)
  - `publicTierSanitizer` — replace directive language (STRONG BUY → STRONG) for public tier
  - `observerFilter` — audit / metrics hook that cannot block the response path
- Anthropic adapter: `toAnthropicTool` / `toAnthropicTools` emit plain objects shaped for the Messages API — no runtime dep on `@anthropic-ai/sdk`. Strips non-standard JSON-Schema keys.
- 22 vitest unit tests, typecheck clean

### Added — Phase 3b (pii-guard + audit-log + onchain-sdk + document-gen)

**@protocolwealthos/pii-guard** — 4-layer PII scanning pipeline:
- `LAYER1_PATTERNS` — 31 deterministic regex patterns (credentials, crypto,
  financial IDs, personal info, mortgage/RE, platform IDs)
- `detectFinancial` — context-aware CUSIP, account refs, policy numbers
- `AllowList` — configurable allow-list (default: 60+ finance acronyms)
- `detectInjection` — prompt injection detector (22 patterns, 7 categories)
- `validateInput` — input sanitizer (control chars, invisible unicode, script tags)
- `scan` / `rehydrate` — orchestrator with optional NER hook; redaction
  manifest enables round-trip rehydration
- 13 unit tests, all passing

**@protocolwealthos/audit-log** — append-only audit log with hash chaining:
- `AuditLogger` — pluggable ID/clock for deterministic testing
- `AuditStore` protocol + `InMemoryAuditStore` reference impl
- SHA-256 hash chain with `hashEntry` / `verifyChain` for tamper detection
- Works in Node 18+ (dynamic `node:crypto` import) and browsers (Web Crypto)
- 7 unit tests, all passing

**@protocolwealthos/onchain-sdk** — typed client for portfolio tracking services:
- `OnchainPortfolioClient` — configurable base URL, bearer auth, timeout
- Types: `OnchainClient`, `OnchainWallet`, `OnchainBalance`,
  `OnchainSnapshot`, `ProtocolPosition`, `PortfolioSummary`,
  `PerformanceWindow`
- No internal URLs, env vars, or credentials baked in — adapt to any
  portfolio API (your own service, DeBank, Zerion, Covalent)
- 8 unit tests, all passing

**@protocolwealthos/document-gen** — document model + CSV generator:
- Block-based document model: headings, paragraphs (with style hints),
  lists, tables, images, spacers, page breaks
- RFC 4180 CSV export (`rowsToCsv`, `objectsToCsv`, `escapeCsvField`)
- `PlainTextRenderer` — dep-free default, useful for tests + debugging
- `DocumentRenderer` protocol — plug in PDF/PPTX/DOCX via user-supplied adapter
- 8 unit tests, all passing

### Added — Phase 1+2 (scaffolding)
- Attribution infrastructure (NOTICE, THIRD_PARTY_LICENSES.md,
  docs/attribution.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md)
- pnpm monorepo with 9 packages (pii-guard, audit-log, mcp-tools,
  document-gen, onchain-sdk, workflow-engine, crm, compliance, email-archive)
- Root package.json with pnpm workspace configuration
- tsconfig.base.json for shared TypeScript settings
- License compliance CI workflow (forbids GPL/AGPL/SSPL)

### Changed
- Expanded README to include "Built on the shoulders of giants" attribution
- Package.json files for 4 extended packages: added `type: "module"`,
  proper `exports`, devDependencies for TypeScript 5.6+ and vitest 2.1+

## [0.0.1] - 2026-04-12

- Initial public release with PII pipeline scaffolding and Apache 2.0 + patent pending
