// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const packagesDir = join(root, "packages");
const versionPattern = /export\s+const\s+VERSION\s*=\s*"([^"]+)"/;
const updated = [];

for (const dirent of readdirSync(packagesDir, { withFileTypes: true })) {
  if (!dirent.isDirectory()) continue;

  const packageDir = join(packagesDir, dirent.name);
  const manifest = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8"));
  const indexPath = join(packageDir, "src", "index.ts");
  const indexSource = readFileSync(indexPath, "utf8");
  const match = indexSource.match(versionPattern);

  if (!match || match[1] === manifest.version) continue;

  writeFileSync(
    indexPath,
    indexSource.replace(versionPattern, `export const VERSION = "${manifest.version}"`),
  );
  updated.push(`${manifest.name}: ${match[1]} -> ${manifest.version}`);
}

if (updated.length === 0) {
  console.log("Version constants already match package manifests.");
} else {
  console.log("Updated version constants:");
  for (const line of updated) console.log(`- ${line}`);
}
