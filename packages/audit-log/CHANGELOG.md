# @protocolwealthos/audit-log

## 0.5.2

### Patch Changes

- [#85](https://github.com/Protocol-Wealth/pwos-core/pull/85) [`8cf65f9`](https://github.com/Protocol-Wealth/pwos-core/commit/8cf65f995518344f1894f2e44edd805c73f79902) Thanks [@rivendale](https://github.com/rivendale)! - fix(audit-log): `verifyChain` now verifies each entry against the running predecessor hash and asserts the stored `previousHash` link matches it.

  Previously `verifyChain` recomputed each entry's hash from that entry's OWN stored `previousHash` and never checked the link against the actual predecessor. As a result a deleted middle entry, a front-truncated genesis, or an edited row whose own hash was recomputed all passed as "intact" — defeating the tamper-evidence the package promises for SEC 204-2 / 17a-4 chains. The chain is now walked with a running predecessor hash (genesis anchor `""`, matching the write side), and both the stored link and the recomputed hash must hold. Adds tamper tests covering delete-middle, edit-and-rehash, and genesis-truncation.

## 0.5.1

### Patch Changes

- [`420c388`](https://github.com/Protocol-Wealth/pwos-core/commit/420c388811893ddd202650c2d481a5aaa608559a) - Synchronize exported VERSION constants with package manifests and keep PlanningContract public descriptions aligned with contract v1.1.0.

## 0.5.0

### Minor Changes

- [#17](https://github.com/Protocol-Wealth/pwos-core/pull/17) [`517e3f9`](https://github.com/Protocol-Wealth/pwos-core/commit/517e3f93ca6f6e4a0eee95a6e695928e4cea8495) Thanks [@rivendale](https://github.com/rivendale)! - Replace shallow canonicalization in `hash.ts` with a deep stable serializer.

  `stableJsonString` is now inlined in `packages/audit-log/src/hash.ts` and exported alongside `hashEntry` and `verifyChain`. The implementation matches `@protocolwealthos/mcp-tools`'s `stableJsonString` byte-for-byte; a parity test (`__tests__/stable-json-parity.test.ts`) enforces this at CI time.

  **Behavior change.** The prior canonicalizer called `JSON.stringify(obj, Object.keys(obj).sort())`, which only sorted top-level keys; nested objects retained insertion order. As a result, two semantically-identical payloads with reordered nested keys could produce different chain hashes — chain fragility on round-trip through `jsonb` or any client that normalizes key order. The new canonicalizer sorts recursively at every nesting level.

  **Breaking for existing chains.** Any audit row whose `details` payload contains a nested object will hash differently under v0.4.0 than under v0.3.0. Consumers MUST run a backfill that re-canonicalizes every row's `current_hash` and rewrites `previous_hash` to maintain chain linkage. A single `canonicalization_version_bump` audit event recording the migration is the recommended auditable trail. Rows with flat-only payloads (no nested objects) hash identically under both versions and don't strictly need rewriting, but a uniform backfill is simpler than per-row inspection.

  **Why inlined, not depending on `@protocolwealthos/mcp-tools`.** `audit-log` is intentionally zero-dep — it's the regulatory floor of the platform (SEC Rule 17a-4, GLBA NPI auditing) and must remain loadable by any code path that needs to write an audit row, including paths that don't otherwise touch MCP. The 10-line duplication is enforced consistent with the peer via the parity test. Revisit if the canonical-serializer surface grows beyond ~20 lines.

## 0.3.0

### Minor Changes

- [#13](https://github.com/Protocol-Wealth/pwos-core/pull/13) [`4d0f9f6`](https://github.com/Protocol-Wealth/pwos-core/commit/4d0f9f62750c5cc0195d200b4f3c2523b967e8c3) Thanks [@rivendale](https://github.com/rivendale)! - Add three audit-anomaly detectors, an approver-separation guard, and a Postgres append-only-table SQL template.

  **Anomaly detectors** (pure functions over `AuditEntry[]`) — run on a nightly cron against your day's events:

  - `detectOffHours` — admin actions outside business hours, by actor, in a configurable timezone (default `America/New_York`, business hours 08:00–20:00, weekends off). Deduplicated per `(actorId, local-day-key)`.
  - `detectRapidSequential` — sliding-window detector for clusters of admin actions by the same actor within a short window (default ≥8 actions in 60s). Often a leading indicator of a compromised session running automated tooling.
  - `detectNewActorOnAdmin` — first-ever appearance of an actor on a privileged action; you supply the running set of `knownActors`.

  Each detector returns `AnomalyFinding[]` with `rule`, `severity`, `actorId`, `sampleEntryIds`, `at`, and a human-readable `message`.

  **Approver-separation guard** — `assertApprovedByDifferentParty` / `isApprovedByDifferentParty`. Refuses any approval where the reviewer equals the author. Case-folding by default for emails; opt-out for opaque ids.

  **Postgres template** — `src/sql/appendOnlyTrigger.sql`. BEFORE DELETE / BEFORE UPDATE triggers that raise on every attempt, so the audit table is non-rewriteable / non-erasable at the database layer. Pair with a retention-locked archive (GCS Object Lock) for SEC Rule 17a-4 compliance.

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
