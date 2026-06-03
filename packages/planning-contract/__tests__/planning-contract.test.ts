// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ToolRegistry } from "@protocolwealthos/mcp-tools";
import { describe, expect, it } from "vitest";

import {
  ANALYZE_ROTH_CONVERSION_TOOL,
  IRMAA_HEADROOM_TOOL,
  PLANNING_CONTRACT_JSON_SCHEMA,
  PLANNING_CONTRACT_VERSION,
  PLANNING_TOOL_DEFINITIONS,
  SEQUENCE_CONVERSIONS_TOOL,
  getPlanningContractJsonSchema,
  registerPlanningTools,
} from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, "..", "src");

describe("version", () => {
  it("is semver and matches the canonical 1.0.0", () => {
    expect(PLANNING_CONTRACT_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(PLANNING_CONTRACT_VERSION).toBe("1.0.0");
  });

  it("the JSON-Schema $id pins the same major version", () => {
    expect(PLANNING_CONTRACT_JSON_SCHEMA.title).toBe("PlanningContract");
    expect(PLANNING_CONTRACT_JSON_SCHEMA.$id).toContain("1.0.0");
  });
});

describe("JSON-Schema", () => {
  it("declares the required top-level fields", () => {
    expect(PLANNING_CONTRACT_JSON_SCHEMA.required).toEqual([
      "case_id",
      "tax_year",
      "filing_status",
      "state_code",
      "birth_years",
      "income_ex_conversion",
      "accounts",
      "intent",
    ]);
  });

  it("getPlanningContractJsonSchema returns an independent deep copy", () => {
    const a = getPlanningContractJsonSchema();
    const b = getPlanningContractJsonSchema();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

describe("PII-free by construction", () => {
  const FORBIDDEN = [
    "name",
    "firstName",
    "lastName",
    "dob",
    "dateOfBirth",
    "ssn",
    "email",
    "phone",
    "address",
    "accountNumber",
  ];

  function propertyNames(node: unknown, acc: Set<string>): void {
    if (Array.isArray(node)) {
      for (const item of node) propertyNames(item, acc);
      return;
    }
    if (node && typeof node === "object") {
      const obj = node as Record<string, unknown>;
      if (obj.properties && typeof obj.properties === "object") {
        for (const key of Object.keys(obj.properties as Record<string, unknown>)) acc.add(key);
      }
      for (const value of Object.values(obj)) propertyNames(value, acc);
    }
  }

  it("no identity-shaped property name appears in the schema", () => {
    const names = new Set<string>();
    propertyNames(PLANNING_CONTRACT_JSON_SCHEMA, names);
    expect(names.size).toBeGreaterThan(0);
    for (const name of names) {
      const normalized = name.toLowerCase().replace(/[\s_-]/g, "");
      expect(FORBIDDEN.map((f) => f.toLowerCase())).not.toContain(normalized);
    }
  });

  it("no identity-shaped field name is declared in the TS contract/analysis types", () => {
    for (const file of ["contract.ts", "analysis.ts"]) {
      const src = readFileSync(join(srcDir, file), "utf8");
      for (const word of FORBIDDEN) {
        const re = new RegExp(`^[ \\t]+${word}\\??:`, "mi");
        expect(re.test(src), `${file} declares '${word}'`).toBe(false);
      }
    }
  });
});

describe("MCP tool definitions", () => {
  it("exposes three read-only planning tools with unique snake_case names", () => {
    expect(PLANNING_TOOL_DEFINITIONS).toHaveLength(3);
    const names = PLANNING_TOOL_DEFINITIONS.map((t) => t.name);
    expect(new Set(names).size).toBe(3);
    for (const t of PLANNING_TOOL_DEFINITIONS) {
      expect(t.name).toMatch(/^[a-z][a-z0-9_]+$/);
      expect(t.annotations?.readOnlyHint).toBe(true);
      expect(t.input_schema.type).toBe("object");
    }
  });

  it("the composite tools require a contract", () => {
    expect(ANALYZE_ROTH_CONVERSION_TOOL.input_schema.required).toContain("contract");
    expect(SEQUENCE_CONVERSIONS_TOOL.input_schema.required).toContain("contract");
  });

  it("irmaa_headroom requires the projection inputs", () => {
    expect(IRMAA_HEADROOM_TOOL.input_schema.required).toEqual(
      expect.arrayContaining(["target_premium_year", "magi_ex_conversion", "per_person", "inflation", "buffer"]),
    );
  });

  it("registerPlanningTools registers them on a ToolRegistry", () => {
    const registry = new ToolRegistry();
    registerPlanningTools(registry);
    expect(registry.has("analyze_roth_conversion")).toBe(true);
    expect(registry.has("sequence_conversions")).toBe(true);
    expect(registry.has("irmaa_headroom")).toBe(true);
  });
});
