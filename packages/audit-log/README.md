# @protocolwealthos/audit-log

> Append-only audit log with SHA-256 hash chaining, intended to satisfy SEC Rule 204-2 Books-and-Records retention.

MIT-0 OR Apache-2.0 · part of [pwos-core](https://github.com/Protocol-Wealth/pwos-core).

## Quick start

```ts
import { AuditLogger, InMemoryAuditStore } from "@protocolwealthos/audit-log";

const logger = new AuditLogger({ store: new InMemoryAuditStore() });
await logger.log({
  actorId: "user_123",
  action: "client.create",
  resourceType: "client",
  resourceId: "client_456",
});
```

Wire a real store (Postgres, DynamoDB, etc.) in production by implementing the `AuditStore` interface. `readonlyView()` exposes only the query paths of an existing store.

## What ships

- **`AuditLogger` + `InMemoryAuditStore`** — append-only writes with hash chaining (`hashEntry`, `verifyChain`, `stableJsonString`).
- **Postgres template** — `src/sql/appendOnlyTrigger.sql` refuses `UPDATE`, `DELETE`, and `TRUNCATE` while its triggers remain enabled. It does not stop a superuser or table owner who disables those triggers, and it is not an archive-retention control.
- **Anomaly helpers** — `detectOffHours`, `detectRapidSequential`, `detectNewActorOnAdmin`.
- **Approver separation** — `assertApprovedByDifferentParty` / `isApprovedByDifferentParty`.

Defensive patent: [USPTO #64/034,215](https://patentcenter.uspto.gov/applications/64034215).

## License

Licensed under MIT-0 OR Apache-2.0, at your option.
