// SPDX-License-Identifier: MIT-0 OR Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Fixture loader.
 *
 * Walks the fixtures directory, reads each `*.json` file under each
 * `<category>/` subdirectory, parses + lightly validates against `EvalCase`,
 * and returns the flat list. Validation errors include the file path so
 * adopters writing new fixtures get an actionable failure.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type {
  ContextBlock,
  EvalCase,
  EvalCategory,
  Expectation,
  PredicateType,
} from "./types.js";
import { EVAL_CATEGORIES, PREDICATE_TYPES } from "./types.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_FIXTURES_DIR = resolve(HERE, "..", "fixtures");

export interface LoadOptions {
  readonly fixturesDir?: string;
}

/** Read + parse + validate every fixture under `fixturesDir`. */
export function loadFixtures(opts: LoadOptions = {}): EvalCase[] {
  const root = opts.fixturesDir ?? DEFAULT_FIXTURES_DIR;
  const out: EvalCase[] = [];

  for (const category of EVAL_CATEGORIES) {
    const dir = join(root, category);
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      // Category dir not present — skip; this is permissible for adopters
      // who only ship a subset of categories.
      continue;
    }
    for (const name of entries) {
      if (!name.endsWith(".json")) continue;
      const path = join(dir, name);
      if (!statSync(path).isFile()) continue;
      const raw = readFileSync(path, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      out.push(validateCase(parsed, path, category));
    }
  }

  assertUniqueIds(out);
  return out;
}

/** Validate a parsed JSON value as an `EvalCase`. Throws on failure. */
export function validateCase(input: unknown, path: string, expectedCategory: EvalCategory): EvalCase {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new Error(`Fixture ${path}: top-level value must be a JSON object`);
  }
  const obj = input as Record<string, unknown>;

  const id = requireString(obj, "id", path);
  const category = requireString(obj, "category", path);
  const description = requireString(obj, "description", path);
  const prompt = requireString(obj, "prompt", path);

  if (!isEvalCategory(category)) {
    throw new Error(
      `Fixture ${path}: category="${category}" is not one of ${EVAL_CATEGORIES.join(" | ")}`,
    );
  }
  if (category !== expectedCategory) {
    throw new Error(
      `Fixture ${path}: category="${category}" does not match the directory "${expectedCategory}"`,
    );
  }

  if (!Array.isArray(obj.expectations) || obj.expectations.length === 0) {
    throw new Error(`Fixture ${path}: expectations must be a non-empty array`);
  }

  const expectations: Expectation[] = obj.expectations.map((exp, i) =>
    validateExpectation(exp, `${path} expectations[${i}]`),
  );

  const tags = Array.isArray(obj.tags)
    ? obj.tags.map((t, i) => {
        if (typeof t !== "string") {
          throw new Error(`Fixture ${path} tags[${i}]: tag must be a string`);
        }
        return t;
      })
    : undefined;

  const system = typeof obj.system === "string" ? obj.system : undefined;

  let turns: string[] | undefined;
  if (obj.turns !== undefined) {
    if (!Array.isArray(obj.turns) || obj.turns.length === 0) {
      throw new Error(`Fixture ${path}: turns must be a non-empty array of strings`);
    }
    turns = obj.turns.map((t, i) => {
      if (typeof t !== "string" || t.length === 0) {
        throw new Error(`Fixture ${path} turns[${i}]: turn must be a non-empty string`);
      }
      return t;
    });
  }

  let context: ContextBlock[] | undefined;
  if (obj.context !== undefined) {
    if (!Array.isArray(obj.context) || obj.context.length === 0) {
      throw new Error(`Fixture ${path}: context must be a non-empty array`);
    }
    context = obj.context.map((b, i) => {
      const ctx = `${path} context[${i}]`;
      if (typeof b !== "object" || b === null || Array.isArray(b)) {
        throw new Error(`${ctx}: context block must be a JSON object`);
      }
      const block = b as Record<string, unknown>;
      return { source: requireString(block, "source", ctx), content: requireString(block, "content", ctx) };
    });
  }

  return {
    id,
    category,
    description,
    prompt,
    system,
    expectations,
    tags,
    ...(turns !== undefined ? { turns } : {}),
    ...(context !== undefined ? { context } : {}),
  };
}

function validateExpectation(input: unknown, ctx: string): Expectation {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new Error(`${ctx}: expectation must be a JSON object`);
  }
  const obj = input as Record<string, unknown>;
  const type = requireString(obj, "type", ctx);
  if (!isPredicateType(type)) {
    throw new Error(`${ctx}: type="${type}" is not one of ${PREDICATE_TYPES.join(" | ")}`);
  }
  const value = requireString(obj, "value", ctx);
  const comment = requireString(obj, "comment", ctx);
  if (REGEX_TYPES.has(type)) {
    const m = /^\/(.+)\/([dgimsuy]*)$/.exec(value);
    try {
      void (m ? new RegExp(m[1]!, m[2]) : new RegExp(value, "i"));
    } catch {
      throw new Error(`${ctx}: value is not a valid regex`);
    }
  }
  const out: {
    -readonly [K in keyof Expectation]: Expectation[K];
  } = { type, value, comment };
  if (obj.code !== undefined) out.code = requireString(obj, "code", ctx);
  if (obj.on_fail !== undefined) {
    if (obj.on_fail !== "fail" && obj.on_fail !== "review") {
      throw new Error(`${ctx}: on_fail must be "fail" or "review"`);
    }
    out.on_fail = obj.on_fail;
  }
  if (type === "field_must_equal") out.field = requireString(obj, "field", ctx);
  if (obj.allow_absent !== undefined) {
    if (typeof obj.allow_absent !== "boolean") {
      throw new Error(`${ctx}: allow_absent must be a boolean`);
    }
    out.allow_absent = obj.allow_absent;
  }
  return out;
}

const REGEX_TYPES: ReadonlySet<PredicateType> = new Set<PredicateType>([
  "must_not_match",
  "must_match",
  "outbound_must_not_match",
]);

function requireString(obj: Record<string, unknown>, key: string, ctx: string): string {
  const v = obj[key];
  if (typeof v !== "string" || v.length === 0) {
    throw new Error(`${ctx}: field "${key}" must be a non-empty string`);
  }
  return v;
}

function isEvalCategory(v: string): v is EvalCategory {
  return (EVAL_CATEGORIES as readonly string[]).includes(v);
}

function isPredicateType(v: string): v is PredicateType {
  return (PREDICATE_TYPES as readonly string[]).includes(v);
}

function assertUniqueIds(cases: EvalCase[]): void {
  const seen = new Map<string, string>();
  for (const c of cases) {
    const prior = seen.get(c.id);
    if (prior !== undefined) {
      throw new Error(`Duplicate case id "${c.id}" (used by ${prior} and ${c.category})`);
    }
    seen.set(c.id, c.category);
  }
}
