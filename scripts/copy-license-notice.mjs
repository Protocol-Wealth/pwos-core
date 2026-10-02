// SPDX-License-Identifier: MIT-0 OR Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

// Copies the repository-root LICENSE-MIT-0, LICENSE-APACHE and NOTICE into the
// package directory being packed, so every published @protocolwealthos/*
// tarball carries both license texts (MIT-0 OR Apache-2.0) AND the NOTICE file.
// Apache-2.0 §4(d) requires propagating NOTICE to downstream recipients, and
// our NOTICE also carries the USPTO defensive-patent notice + third-party
// attributions.
//
// Why a prepack copy instead of committed per-package files: the root license
// files and NOTICE are the single source of truth. Committing per-package
// duplicates invites drift. Instead each package's `prepack` runs this script, and the copies are
// gitignored (packages/*/LICENSE-MIT-0, packages/*/LICENSE-APACHE,
// packages/*/NOTICE) — build artifacts, exactly
// like dist/. npm/pnpm still pack files listed in `files` even when gitignored
// (dist/ already relies on this), so the copies ship in the tarball.
//
// pnpm auto-hoists only a root file named LICENSE, and plain `npm publish`
// hoists nothing — copying all three here makes the tarball correct under
// every publish path, not just the pnpm convention.
//
// Invoked from a package's `prepack` hook, where cwd is the package directory.

import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

const packageDir = process.cwd();

function findRepoRoot(start) {
  let dir = start;
  for (;;) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

const repoRoot = findRepoRoot(packageDir);
if (!repoRoot) {
  console.error(
    `copy-license-notice: could not locate the workspace root (pnpm-workspace.yaml) from ${packageDir}`,
  );
  process.exit(1);
}

for (const name of ["LICENSE-MIT-0", "LICENSE-APACHE", "NOTICE"]) {
  const source = join(repoRoot, name);
  if (!existsSync(source)) {
    console.error(`copy-license-notice: root ${name} not found at ${source}`);
    process.exit(1);
  }
  copyFileSync(source, join(packageDir, name));
}
