# Changelog

All notable changes to PWOS Core will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added — Phase 3b (pii-guard + audit-log + onchain-sdk + document-gen)

**@pwos/pii-guard** — 4-layer PII scanning pipeline:
- `LAYER1_PATTERNS` — 31 deterministic regex patterns (credentials, crypto,
  financial IDs, personal info, mortgage/RE, platform IDs)
- `detectFinancial` — context-aware CUSIP, account refs, policy numbers
- `AllowList` — configurable allow-list (default: 60+ finance acronyms)
- `detectInjection` — prompt injection detector (22 patterns, 7 categories)
- `validateInput` — input sanitizer (control chars, invisible unicode, script tags)
- `scan` / `rehydrate` — orchestrator with optional NER hook; redaction
  manifest enables round-trip rehydration
- 13 unit tests, all passing

**@pwos/audit-log** — append-only audit log with hash chaining:
- `AuditLogger` — pluggable ID/clock for deterministic testing
- `AuditStore` protocol + `InMemoryAuditStore` reference impl
- SHA-256 hash chain with `hashEntry` / `verifyChain` for tamper detection
- Works in Node 18+ (dynamic `node:crypto` import) and browsers (Web Crypto)
- 7 unit tests, all passing

**@pwos/onchain-sdk** — typed client for portfolio tracking services:
- `OnchainPortfolioClient` — configurable base URL, bearer auth, timeout
- Types: `OnchainClient`, `OnchainWallet`, `OnchainBalance`,
  `OnchainSnapshot`, `ProtocolPosition`, `PortfolioSummary`,
  `PerformanceWindow`
- No internal URLs, env vars, or credentials baked in — adapt to any
  portfolio API (your own service, DeBank, Zerion, Covalent)
- 8 unit tests, all passing

**@pwos/document-gen** — document model + CSV generator:
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
