---
"@protocolwealthos/audit-log": patch
---

The Postgres append-only template now installs a `BEFORE TRUNCATE ... FOR EACH STATEMENT` trigger, so `TRUNCATE` is refused while the trigger stays enabled. Row-level `DELETE` triggers do not fire for `TRUNCATE`. Re-running the file replaces the functions and recreates the triggers without dropping existing rows.

The template does not stop a superuser or table owner who disables or drops the triggers, and it does not set an archive retention period. Grant the application role `INSERT` and `SELECT` only, and do not make it the table owner.

Refs #128
