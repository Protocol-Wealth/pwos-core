// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { describe, expect, it } from "vitest";
import { pickConnectionStrategy } from "../src/cloudSqlIam.js";

describe("pickConnectionStrategy", () => {
  it("picks IAM when CLOUD_SQL_INSTANCE_CONNECTION_NAME + user + db are present", () => {
    const r = pickConnectionStrategy({
      CLOUD_SQL_INSTANCE_CONNECTION_NAME: "p:r:i",
      DATABASE_USER: "svc",
      DATABASE_NAME: "db",
    });
    expect(r).toEqual({
      strategy: "iam",
      instanceConnectionName: "p:r:i",
      user: "svc",
      database: "db",
    });
  });

  it("refuses to fall back to password when only the instance name is set", () => {
    expect(() =>
      pickConnectionStrategy({
        CLOUD_SQL_INSTANCE_CONNECTION_NAME: "p:r:i",
        DATABASE_URL: "postgres://…",
      })
    ).toThrow(/refusing to fall back/);
  });

  it("falls back to DATABASE_URL when no instance name is set", () => {
    const r = pickConnectionStrategy({ DATABASE_URL: "postgres://x" });
    expect(r).toEqual({ strategy: "password", databaseUrl: "postgres://x" });
  });

  it("throws when nothing is configured", () => {
    expect(() => pickConnectionStrategy({})).toThrow(/No database connection/);
  });
});
