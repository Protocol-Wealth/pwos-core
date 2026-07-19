// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

// Publish-shape guard for every published @protocolwealthos/* package.
//
// The manifests intentionally point their top-level `main`/`types`/`exports`
// at raw `./src/*.ts` for local development, and rely on the `publishConfig`
// block to rewrite those entries to compiled `./dist/*.js` at publish time
// (pnpm and npm both apply publishConfig overrides when packing). That is
// correct today, but it is convention-bound: if a package ever drops its
// publishConfig override — or adds a new subpath export to the base `exports`
// and forgets to mirror it under publishConfig — the PUBLISHED package.json
// would keep an entry pointing at raw TypeScript. Every Node >= 23 consumer of
// such a tarball crashes with ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING.
//
// This script simulates the publishConfig override (exactly what pnpm/npm pack
// do), then asserts that EVERY resolved published entry point resolves to a
// compiled artifact under ./dist/ ending in .js or .d.ts (never ./src/*.ts),
// and that each target file actually exists on disk. Run it after a build.
//
// It is a deliberate zero-dependency check rather than `publint`: publint packs
// via the detected package manager (pnpm here), which applies publishConfig, so
// it always sees the already-correct dist shape and cannot detect the raw-src
// regression this guard exists to catch — verified: publint reports "All good!"
// on a package whose exports point at ./src/index.ts.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packagesDir = join(repoRoot, "packages");

// Fields pnpm/npm copy from `publishConfig` onto the published manifest,
// overriding the development entry points.
const OVERRIDE_FIELDS = [
  "main",
  "module",
  "types",
  "typings",
  "browser",
  "bin",
  "unpkg",
  "jsdelivr",
  "exports",
];

// Collect every string leaf inside an `exports` tree (condition keys are object
// keys; the file paths are the string values).
function collectExportTargets(node, targets) {
  if (typeof node === "string") {
    targets.push(node);
  } else if (node && typeof node === "object") {
    for (const value of Object.values(node)) collectExportTargets(value, targets);
  }
}

function publishedEntryTargets(manifest) {
  const published = { ...manifest };
  const publishConfig = manifest.publishConfig ?? {};
  for (const field of OVERRIDE_FIELDS) {
    if (field in publishConfig) published[field] = publishConfig[field];
  }

  const targets = [];
  for (const field of ["main", "module", "types", "typings", "browser"]) {
    if (typeof published[field] === "string") {
      targets.push({ field, value: published[field] });
    }
  }
  if (typeof published.bin === "string") {
    targets.push({ field: "bin", value: published.bin });
  } else if (published.bin && typeof published.bin === "object") {
    for (const [name, value] of Object.entries(published.bin)) {
      if (typeof value === "string") targets.push({ field: `bin.${name}`, value });
    }
  }
  const exportTargets = [];
  collectExportTargets(published.exports, exportTargets);
  for (const value of exportTargets) targets.push({ field: "exports", value });

  return targets;
}

function validatePackage(packageDir) {
  const manifestPath = join(packageDir, "package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const errors = [];

  if (manifest.private === true) return { name: manifest.name, skipped: true, errors };

  const targets = publishedEntryTargets(manifest);
  if (targets.length === 0) {
    errors.push("no published entry points (main/types/exports) resolved after applying publishConfig");
  }

  for (const { field, value } of targets) {
    if (!value.startsWith("./dist/")) {
      errors.push(`${field} -> "${value}" is not under ./dist/ (would publish uncompiled source)`);
      continue;
    }
    if (value.endsWith(".ts") && !value.endsWith(".d.ts")) {
      errors.push(`${field} -> "${value}" publishes a raw .ts file (Node >= 23 type-stripping crash)`);
      continue;
    }
    if (!value.endsWith(".js") && !value.endsWith(".d.ts")) {
      errors.push(`${field} -> "${value}" is neither a .js nor a .d.ts artifact`);
      continue;
    }
    if (!existsSync(resolve(packageDir, value))) {
      errors.push(`${field} -> "${value}" does not exist on disk (run \`pnpm -r build\` first)`);
    }
  }

  return { name: manifest.name, skipped: false, errors };
}

const packageDirs = readdirSync(packagesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join(packagesDir, entry.name))
  .filter((dir) => existsSync(join(dir, "package.json")));

let failed = false;
let checked = 0;

for (const packageDir of packageDirs) {
  const result = validatePackage(packageDir);
  if (result.skipped) continue;
  checked += 1;
  if (result.errors.length > 0) {
    failed = true;
    console.error(`✗ ${result.name}`);
    for (const error of result.errors) console.error(`    ${error}`);
  }
}

if (failed) {
  console.error(
    "\nPublish-shape check failed. Every published main/types/exports entry must resolve to a\n" +
      "compiled ./dist/*.js or ./dist/*.d.ts artifact (via package.json or its publishConfig override).",
  );
  process.exit(1);
}

console.log(`Publish shape verified: ${checked} package(s) publish only compiled ./dist artifacts.`);
