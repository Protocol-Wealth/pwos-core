---
"@protocolwealthos/audit-log": minor
---

Add three audit-anomaly detectors, an approver-separation guard, and a Postgres append-only-table SQL template.

**Anomaly detectors** (pure functions over `AuditEntry[]`) — run on a nightly cron against your day's events:

- `detectOffHours` — admin actions outside business hours, by actor, in a configurable timezone (default `America/New_York`, business hours 08:00–20:00, weekends off). Deduplicated per `(actorId, local-day-key)`.
- `detectRapidSequential` — sliding-window detector for clusters of admin actions by the same actor within a short window (default ≥8 actions in 60s). Often a leading indicator of a compromised session running automated tooling.
- `detectNewActorOnAdmin` — first-ever appearance of an actor on a privileged action; you supply the running set of `knownActors`.

Each detector returns `AnomalyFinding[]` with `rule`, `severity`, `actorId`, `sampleEntryIds`, `at`, and a human-readable `message`.

**Approver-separation guard** — `assertApprovedByDifferentParty` / `isApprovedByDifferentParty`. Refuses any approval where the reviewer equals the author. Case-folding by default for emails; opt-out for opaque ids.

**Postgres template** — `src/sql/appendOnlyTrigger.sql`. BEFORE DELETE / BEFORE UPDATE triggers that raise on every attempt, so the audit table is non-rewriteable / non-erasable at the database layer. Pair with a retention-locked archive (GCS Object Lock) for SEC Rule 17a-4 compliance.
