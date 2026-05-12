---
"@protocolwealthos/audit-log": minor
---

Replace shallow canonicalization in `hash.ts` with a deep stable serializer.

`stableJsonString` is now inlined in `packages/audit-log/src/hash.ts` and exported alongside `hashEntry` and `verifyChain`. The implementation matches `@protocolwealthos/mcp-tools`'s `stableJsonString` byte-for-byte; a parity test (`__tests__/stable-json-parity.test.ts`) enforces this at CI time.

**Behavior change.** The prior canonicalizer called `JSON.stringify(obj, Object.keys(obj).sort())`, which only sorted top-level keys; nested objects retained insertion order. As a result, two semantically-identical payloads with reordered nested keys could produce different chain hashes — chain fragility on round-trip through `jsonb` or any client that normalizes key order. The new canonicalizer sorts recursively at every nesting level.

**Breaking for existing chains.** Any audit row whose `details` payload contains a nested object will hash differently under v0.4.0 than under v0.3.0. Consumers MUST run a backfill that re-canonicalizes every row's `current_hash` and rewrites `previous_hash` to maintain chain linkage. A single `canonicalization_version_bump` audit event recording the migration is the recommended auditable trail. Rows with flat-only payloads (no nested objects) hash identically under both versions and don't strictly need rewriting, but a uniform backfill is simpler than per-row inspection.

**Why inlined, not depending on `@protocolwealthos/mcp-tools`.** `audit-log` is intentionally zero-dep — it's the regulatory floor of the platform (SEC Rule 17a-4, GLBA NPI auditing) and must remain loadable by any code path that needs to write an audit row, including paths that don't otherwise touch MCP. The 10-line duplication is enforced consistent with the peer via the parity test. Revisit if the canonical-serializer surface grows beyond ~20 lines.
