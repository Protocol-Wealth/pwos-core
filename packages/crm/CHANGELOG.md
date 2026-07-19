# @protocolwealthos/crm

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

- [#15](https://github.com/Protocol-Wealth/pwos-core/pull/15) [`1a0b471`](https://github.com/Protocol-Wealth/pwos-core/commit/1a0b47173329d808dd486f05e93cfcea4484633c) Thanks [@rivendale](https://github.com/rivendale)! - Add household profile / goals / notes — "financial memory" types for advisor platforms.

  **`HouseholdProfile`** (versioned) — captures the structured context advisors accumulate across client meetings: risk tolerance + principal notes, tax filing status + marginal federal bracket + state of residence, dependent count, career stage, expected retirement date, real-estate footprint, liquidity profile, business interest flag, estate-document flags (will / trust / POA / healthcare directive), beneficiary review timestamp, philosophical preferences. Profile mutations create a **new version row** (don't overwrite); history is the audit trail.

  **`HouseholdGoal`** — named financial goal: kind (retirement / education / home_purchase / major_expense / emergency_fund / legacy / philanthropy / business_exit / debt_payoff), target amount + currency + date, priority (primary / secondary / stretch), status (draft / active / achieved / abandoned / deferred), progress tracker.

  **`HouseholdNote`** — append-only timestamped note with kind enum (meeting / phone_call / decision / advisor_observation / client_request / compliance / system) and optional contact / goal linkage. New facts get new notes; never edit.

  Three helpers:

  - `currentHouseholdProfile(versions)` — pick the latest by `effectiveAt`
  - `activeGoals(goals, householdId)` — active goals filtered by household
  - `staleProfiles(versions, asOfIso, staleAfterDays)` — for nightly "quarterly review" reminders

  All three types are designed to compose with `@protocolwealthos/audit-log` so every mutation produces one hash-chained audit row.

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
