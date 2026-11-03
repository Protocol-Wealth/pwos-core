// SPDX-License-Identifier: MIT-0 OR Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";

/**
 * Disposable-Postgres exercise for the append-only template.
 *
 * Set AUDIT_LOG_TEST_DATABASE_URL to a database the test may create and
 * drop objects in. CI sets this. Local runs without the variable skip,
 * so a laptop without Postgres still typechecks the rest of the package;
 * CI fails closed if the variable is missing.
 */
const databaseUrl = process.env.AUDIT_LOG_TEST_DATABASE_URL;
if (!databaseUrl && process.env.CI) {
  throw new Error(
    "AUDIT_LOG_TEST_DATABASE_URL must be set in CI so appendOnlyTrigger.sql is exercised against PostgreSQL.",
  );
}

const templatePath = fileURLToPath(new URL("../src/sql/appendOnlyTrigger.sql", import.meta.url));
const APP_ROLE = "app_audit_appendonly_test";

function redact(url: string): string {
  return url.replace(/\/\/([^:@/]+):([^@/]+)@/, "//$1:***@");
}

function psql(sql: string, file?: string): { status: number; stdout: string; stderr: string } {
  if (!databaseUrl) throw new Error("database URL is unset");
  const args = ["--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-X", "-q"];
  if (file) args.push("-f", file);
  if (sql) args.push("-t", "-A", "-c", sql);
  args.push(databaseUrl);
  const result = spawnSync("psql", args, { encoding: "utf8" });
  if (result.error) {
    throw new Error(`psql failed to start (${redact(databaseUrl)}): ${result.error.message}`);
  }
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function query(sql: string): string {
  const result = psql(sql);
  if (result.status !== 0) {
    throw new Error(`psql query failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

function expectDenied(sql: string, pattern: RegExp): void {
  const result = psql(sql);
  expect(result.status, result.stdout).not.toBe(0);
  expect(`${result.stderr}\n${result.stdout}`).toMatch(pattern);
}

function applyTemplate(): void {
  const result = psql("", templatePath);
  if (result.status !== 0) {
    throw new Error(`applying appendOnlyTrigger.sql failed: ${result.stderr || result.stdout}`);
  }
}

function resetDatabase(): void {
  query(`
    DROP TABLE IF EXISTS audit_log CASCADE;
    DROP TABLE IF EXISTS audit_log_legacy CASCADE;
    DROP FUNCTION IF EXISTS audit_log_no_delete() CASCADE;
    DROP FUNCTION IF EXISTS audit_log_no_update() CASCADE;
    DROP FUNCTION IF EXISTS audit_log_no_truncate() CASCADE;
    DROP FUNCTION IF EXISTS audit_log_legacy_no_delete() CASCADE;
    DROP FUNCTION IF EXISTS audit_log_legacy_no_update() CASCADE;
  `);
  query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${APP_ROLE}') THEN
        CREATE ROLE ${APP_ROLE} NOLOGIN;
      END IF;
    END
    $$;
  `);
}

function evidence(): string {
  return query(
    `SELECT count(*)::text
        || ' ' || coalesce(string_agg(hash, ',' ORDER BY hash), '')
        || ' ' || coalesce(string_agg(previous_hash, ',' ORDER BY previous_hash), '')
     FROM audit_log`,
  );
}

const insertSynthetic = `
  INSERT INTO audit_log (actor_id, action, hash, previous_hash)
  VALUES ('synthetic_actor', 'synthetic.append', 'hash_aaa', 'hash_prev');
`;

describe.skipIf(!databaseUrl)("append-only Postgres trigger", () => {
  beforeEach(() => {
    resetDatabase();
    applyTemplate();
    query(`GRANT INSERT, SELECT ON audit_log TO ${APP_ROLE}`);
  });

  afterAll(() => {
    if (!databaseUrl) return;
    query(`
      DROP TABLE IF EXISTS audit_log CASCADE;
      DROP TABLE IF EXISTS audit_log_legacy CASCADE;
      DROP FUNCTION IF EXISTS audit_log_no_delete() CASCADE;
      DROP FUNCTION IF EXISTS audit_log_no_update() CASCADE;
      DROP FUNCTION IF EXISTS audit_log_no_truncate() CASCADE;
      DROP FUNCTION IF EXISTS audit_log_legacy_no_delete() CASCADE;
      DROP FUNCTION IF EXISTS audit_log_legacy_no_update() CASCADE;
    `);
    query(`DROP ROLE IF EXISTS ${APP_ROLE}`);
  });

  it("lets the owner insert and refuses UPDATE, DELETE, and TRUNCATE", () => {
    query(insertSynthetic);
    expect(evidence()).toBe("1 hash_aaa hash_prev");

    expectDenied(
      `UPDATE audit_log SET action = 'tamper', hash = 'hash_tampered' WHERE actor_id = 'synthetic_actor'`,
      /append-only; row update refused/,
    );
    expectDenied(`DELETE FROM audit_log`, /append-only; row deletion refused/);
    expectDenied(`TRUNCATE audit_log`, /append-only; TRUNCATE refused/);

    expect(evidence()).toBe("1 hash_aaa hash_prev");
    const definition = query(
      `SELECT pg_get_triggerdef(t.oid)
       FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
       WHERE c.relname = 'audit_log' AND t.tgname = 'audit_log_no_truncate' AND NOT t.tgisinternal`,
    );
    expect(definition).toMatch(/BEFORE TRUNCATE/);
    expect(definition).toMatch(/FOR EACH STATEMENT/);
  });

  it("denies UPDATE, DELETE, and TRUNCATE to the application role", () => {
    query(`SET ROLE ${APP_ROLE}; ${insertSynthetic} RESET ROLE;`);
    expect(evidence()).toBe("1 hash_aaa hash_prev");

    expectDenied(
      `SET ROLE ${APP_ROLE}; UPDATE audit_log SET hash = 'hash_tampered';`,
      /permission denied|append-only/,
    );
    expectDenied(`SET ROLE ${APP_ROLE}; DELETE FROM audit_log;`, /permission denied|append-only/);
    expectDenied(`SET ROLE ${APP_ROLE}; TRUNCATE audit_log;`, /permission denied|append-only/);

    expect(evidence()).toBe("1 hash_aaa hash_prev");
  });

  it("reinstalls idempotently on a table that already holds a row", () => {
    query(insertSynthetic);
    applyTemplate();
    applyTemplate();
    const triggers = query(
      `SELECT string_agg(tgname, ',' ORDER BY tgname)
       FROM pg_trigger
       WHERE tgrelid = 'audit_log'::regclass AND NOT tgisinternal`,
    );
    expect(triggers).toBe("audit_log_no_delete,audit_log_no_truncate,audit_log_no_update");
    expectDenied(`TRUNCATE audit_log`, /TRUNCATE refused/);
    expect(evidence()).toBe("1 hash_aaa hash_prev");
    expect(readFileSync(templatePath, "utf8")).toMatch(/BEFORE TRUNCATE ON audit_log/);
  });

  it("shows the pre-fix trigger shape allows owner TRUNCATE and the shipped template does not", () => {
    query(`
      CREATE TABLE audit_log_legacy (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        actor_id text NOT NULL,
        action text NOT NULL,
        hash text,
        previous_hash text
      );
      INSERT INTO audit_log_legacy (actor_id, action, hash, previous_hash)
      VALUES ('synthetic_actor', 'synthetic.append', 'hash_aaa', 'hash_prev');
      CREATE OR REPLACE FUNCTION audit_log_legacy_no_delete() RETURNS trigger AS $fn$
      BEGIN
        RAISE EXCEPTION 'audit_log is append-only; row deletion refused (id=%)', OLD.id;
      END;
      $fn$ LANGUAGE plpgsql;
      CREATE OR REPLACE FUNCTION audit_log_legacy_no_update() RETURNS trigger AS $fn$
      BEGIN
        RAISE EXCEPTION 'audit_log is append-only; row update refused (id=%)', OLD.id;
      END;
      $fn$ LANGUAGE plpgsql;
      CREATE TRIGGER audit_log_legacy_no_delete
        BEFORE DELETE ON audit_log_legacy
        FOR EACH ROW EXECUTE FUNCTION audit_log_legacy_no_delete();
      CREATE TRIGGER audit_log_legacy_no_update
        BEFORE UPDATE ON audit_log_legacy
        FOR EACH ROW EXECUTE FUNCTION audit_log_legacy_no_update();
    `);
    expectDenied(
      `DELETE FROM audit_log_legacy`,
      /append-only; row deletion refused/,
    );
    const truncated = psql(`TRUNCATE audit_log_legacy`);
    expect(truncated.status).toBe(0);
    expect(
      query(`SELECT count(*)::text FROM audit_log_legacy`),
    ).toBe("0");

    query(insertSynthetic);
    expectDenied(`TRUNCATE audit_log`, /TRUNCATE refused/);
    expect(evidence()).toBe("1 hash_aaa hash_prev");
  });

  it("does not stop an owner who disables the truncate trigger", () => {
    query(insertSynthetic);
    query(`ALTER TABLE audit_log DISABLE TRIGGER audit_log_no_truncate`);
    const truncated = psql(`TRUNCATE audit_log`);
    expect(truncated.status).toBe(0);
    expect(query(`SELECT count(*)::text FROM audit_log`)).toBe("0");
  });
});
