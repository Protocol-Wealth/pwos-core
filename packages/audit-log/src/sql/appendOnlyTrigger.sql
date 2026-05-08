-- SPDX-License-Identifier: Apache-2.0
-- Copyright 2026 Protocol Wealth, LLC and contributors.
--
-- Reference Postgres template for an append-only audit_log table.
--
-- The defining property: rows can be inserted but never modified or
-- deleted. The BEFORE DELETE / BEFORE UPDATE triggers raise an
-- exception unconditionally, so even a superuser executing a stray
-- DELETE on this table fails — your post-incident write-up has the
-- attempt, not a missing row.
--
-- This is the Postgres half of "every action leaves a record". For
-- regulatory non-rewriteable / non-erasable obligations (SEC Rule 17a-4),
-- pair this with a retention-locked archive (GCS Object Lock,
-- S3 Object Lock in Compliance mode, etc.).
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

-- BEFORE DELETE: refuse every row removal. There are no exceptions —
-- compliance bundling reads with a SELECT, never a DELETE.
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
