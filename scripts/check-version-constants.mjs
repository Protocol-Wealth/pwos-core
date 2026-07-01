// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const packagesDir = join(root, "packages");
const versionPattern = /export\s+const\s+VERSION\s*=\s*"([^"]+)"/;
const failures = [];

for (const dirent of readdirSync(packagesDir, { withFileTypes: true })) {
  if (!dirent.isDirectory()) continue;

  const packageDir = join(packagesDir, dirent.name);
  const manifest = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8"));
  const indexSource = readFileSync(join(packageDir, "src", "index.ts"), "utf8");
  const match = indexSource.match(versionPattern);

  if (!match) continue;
  if (match[1] !== manifest.version) {
    failures.push(`${manifest.name}: VERSION is ${match[1]} but package.json is ${manifest.version}`);
  }
}

if (failures.length > 0) {
  console.error("Version constant drift detected:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Version constants match package manifests.");
