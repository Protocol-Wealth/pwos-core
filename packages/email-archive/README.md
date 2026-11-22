# @protocolwealthos/email-archive

> Email archive primitives: typed records, chain-of-custody hashing, retention eligibility, and an in-memory query evaluator.

MIT-0 OR Apache-2.0 · part of [pwos-core](https://github.com/Protocol-Wealth/pwos-core).

## Why

Storage is the caller's responsibility. Pair these primitives with object-lock storage, an immutable database table, or a dedicated archive backend. WORM guarantees come from the storage layer, not this package.

## What ships

- **Records:** `ArchivedEmail` and related address, attachment, classification, and direction types.
- **Integrity:** `canonicalize`, `hashEmail`, `finalizeRecord`, `verifyChain` — SHA-256 of a canonical record plus the previous hash.
- **Retention:** `isPurgeable`, `purgeableEmails` (legal holds are never purgeable).
- **Query:** `evaluateQuery` for tests and eDiscovery prototypes.

## License

Licensed under MIT-0 OR Apache-2.0, at your option.
