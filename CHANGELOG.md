# Changelog

All notable changes to PWOS Core will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Phase 1: Attribution infrastructure (NOTICE, THIRD_PARTY_LICENSES.md,
  docs/attribution.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md)
- Phase 2: pnpm monorepo scaffolding with 9 new packages:
  - @pwos/pii-guard - 4-layer PII scanning (our work, patent-pending)
  - @pwos/audit-log - Immutable append-only audit (SEC Rule 204-2)
  - @pwos/mcp-tools - MCP tool definitions
  - @pwos/document-gen - Unified PDF/Word/PowerPoint generation
  - @pwos/onchain-sdk - Viem/Wagmi wrapper with RIA compliance
  - @pwos/workflow-engine - BullMQ + Temporal durable workflows
  - @pwos/crm - Contact/household/interaction models
  - @pwos/compliance - SEC exam export, AI inventory
  - @pwos/email-archive - OpenArchiver integration for SEC 17a-4
- Root package.json with pnpm workspace configuration
- tsconfig.base.json for shared TypeScript settings
- License compliance CI workflow (forbids GPL/AGPL/SSPL)

### Changed
- Expanded README to include "Built on the shoulders of giants" attribution

## [0.0.1] - 2026-04-12

- Initial public release with PII pipeline scaffolding and Apache 2.0 + patent pending
