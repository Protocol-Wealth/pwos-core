// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Cloud SQL IAM-auth connector adapter.
 *
 * Why not pull in `@google-cloud/cloud-sql-connector` directly: this
 * package is intentionally zero-dep so consumers can audit it without
 * pulling Google's connector stack. We expose:
 *
 *   - The shape of an "IAM connector" (what `getOptions(...)` returns
 *     in Google's connector library): host, port, user, db, ssl.
 *   - A small helper that picks between IAM-auth (when
 *     `CLOUD_SQL_INSTANCE_CONNECTION_NAME` is set) and password-auth
 *     fallback (a `DATABASE_URL`).
 *
 * Plug your Postgres pool (pg, postgres, drizzle) into the result.
 *
 * What this gives you in a Cloud Run service:
 *
 *   - No static database password in env (or anywhere)
 *   - Per-service IAM identity at the database
 *   - Token rotation handled by your connector (refresh interval ~1h)
 */

export interface CloudSqlIamConnectionOptions {
  /** Hostname returned by the connector (typically a 169.254.* address). */
  host: string;
  port: number;
  user: string;
  database: string;
  ssl?:
    | true
    | false
    | { rejectUnauthorized: boolean; ca?: string; key?: string; cert?: string };
}

/**
 * Connector facade — implement this against `@google-cloud/cloud-sql-connector`
 * (or any other IAM-aware connector) in your application; pwos-core stays
 * dep-free.
 */
export interface CloudSqlIamConnector {
  /**
   * Resolve connection options for the given Cloud SQL instance.
   * `instanceConnectionName` looks like `project:region:instance`.
   */
  getOptions(instanceConnectionName: string): Promise<CloudSqlIamConnectionOptions>;
}

export type DbConnectionStrategy =
  | { strategy: "iam"; instanceConnectionName: string; user: string; database: string }
  | { strategy: "password"; databaseUrl: string };

export interface PickStrategyEnv {
  CLOUD_SQL_INSTANCE_CONNECTION_NAME?: string;
  DATABASE_USER?: string;
  DATABASE_NAME?: string;
  DATABASE_URL?: string;
}

/**
 * Choose IAM auth when `CLOUD_SQL_INSTANCE_CONNECTION_NAME` is set,
 * otherwise fall back to `DATABASE_URL`. Throws if neither is
 * available — silent fallbacks are footguns.
 */
export function pickConnectionStrategy(env: PickStrategyEnv): DbConnectionStrategy {
  const inst = env.CLOUD_SQL_INSTANCE_CONNECTION_NAME?.trim();
  if (inst) {
    const user = env.DATABASE_USER?.trim();
    const database = env.DATABASE_NAME?.trim();
    if (!user || !database) {
      throw new Error(
        "CLOUD_SQL_INSTANCE_CONNECTION_NAME is set but DATABASE_USER and/or DATABASE_NAME are missing — refusing to fall back to password auth implicitly."
      );
    }
    return { strategy: "iam", instanceConnectionName: inst, user, database };
  }
  const url = env.DATABASE_URL?.trim();
  if (url) return { strategy: "password", databaseUrl: url };
  throw new Error(
    "No database connection configured: set CLOUD_SQL_INSTANCE_CONNECTION_NAME (IAM) or DATABASE_URL (password)."
  );
}
