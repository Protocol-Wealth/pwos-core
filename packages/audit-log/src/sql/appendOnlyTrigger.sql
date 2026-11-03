-- SPDX-License-Identifier: MIT-0 OR Apache-2.0
-- Copyright 2026 Protocol Wealth, LLC and contributors.
--
-- Reference Postgres template for an append-only audit_log table.
-- Requires PostgreSQL 14+ (EXECUTE FUNCTION).
--
-- The defining property while these triggers stay enabled: INSERT is
-- allowed, and UPDATE, DELETE, and TRUNCATE raise. TRUNCATE does not
-- fire row-level DELETE triggers, so the statement-level trigger below
-- is what refuses it. Re-running this file is safe: functions are
-- replaced, triggers are dropped and recreated, and CREATE TABLE IF
-- NOT EXISTS leaves an existing table in place.
--
-- Privileges. Apply this file as the migration role that owns the
-- table. GRANT INSERT and SELECT to the application role. Do not GRANT
-- UPDATE, DELETE, TRUNCATE, or TRIGGER, and do not make that role the
-- owner. TRUNCATE is owner-only in PostgreSQL; the trigger is what
-- stops the owner from truncating while the trigger is enabled.
--
-- Limits. A superuser or the table owner can DISABLE or DROP these
-- triggers. A superuser can also set session_replication_role = replica
-- and skip them. This template does not constrain a privileged
-- administrator. It is not a retention period and it is not an archive
-- lock. Pair it with a separate retention-locked archive (GCS Object
-- Lock, S3 Object Lock in Compliance mode, or equivalent) when the
-- deployment needs non-erasable copies. The application hash chain is
-- also a separate control: this file does not compute hashes.
--
-- Adjust column shapes to match your application; the trigger logic is
-- the load-bearing part.

CREATE TABLE IF NOT EXISTS audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- ISO-8601 timestamp; default to NOW() at the database for
    -- monotonic-by-clock ordering.
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor_id        TEXT NOT NULL,
    action          TEXT NOT NULL,
    resource_type   TEXT,
    resource_id     TEXT,
    details         JSONB,
    ip_address      TEXT,
    -- Application-side hash chain (see @protocolwealthos/audit-log
    -- `hashEntry`). Optional but recommended.
    hash            TEXT,
    previous_hash   TEXT
);

-- BEFORE DELETE: refuse every row removal while the trigger is enabled.
-- Compliance bundling reads with a SELECT, never a DELETE.
CREATE OR REPLACE FUNCTION audit_log_no_delete() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION
        'audit_log is append-only; row deletion refused (id=%)',
        OLD.id;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_no_delete ON audit_log;
CREATE TRIGGER audit_log_no_delete
    BEFORE DELETE ON audit_log
    FOR EACH ROW
    EXECUTE FUNCTION audit_log_no_delete();

-- BEFORE UPDATE: refuse mutation of any column once written. New facts
-- are recorded by appending a new row, not by editing an old one.
CREATE OR REPLACE FUNCTION audit_log_no_update() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION
        'audit_log is append-only; row update refused (id=%)',
        OLD.id;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_no_update ON audit_log;
CREATE TRIGGER audit_log_no_update
    BEFORE UPDATE ON audit_log
    FOR EACH ROW
    EXECUTE FUNCTION audit_log_no_update();

-- BEFORE TRUNCATE: row triggers do not run for TRUNCATE. A statement
-- trigger is the one that can refuse it. FOR EACH ROW is invalid here.
CREATE OR REPLACE FUNCTION audit_log_no_truncate() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'audit_log is append-only; TRUNCATE refused';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_no_truncate ON audit_log;
CREATE TRIGGER audit_log_no_truncate
    BEFORE TRUNCATE ON audit_log
    FOR EACH STATEMENT
    EXECUTE FUNCTION audit_log_no_truncate();

-- Useful indexes for the common query shapes.
CREATE INDEX IF NOT EXISTS audit_log_occurred_at_idx
    ON audit_log (occurred_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_actor_action_idx
    ON audit_log (actor_id, action);
CREATE INDEX IF NOT EXISTS audit_log_resource_idx
    ON audit_log (resource_type, resource_id);

-- Note: the application-layer wrapper (see @protocolwealthos/audit-log
-- AuditLogger) is responsible for funneling every mutation through a
-- single insert path that also updates the hash chain. If your
-- application allows arbitrary INSERTs into audit_log from places
-- other than the wrapper, the chain is still correct (each insert
-- still re-reads previous_hash) but the actor/action shape is at the
-- mercy of the caller.
