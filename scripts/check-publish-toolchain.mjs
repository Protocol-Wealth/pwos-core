// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

function command(command, args) {
  return execFileSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 30_000,
  }).trim();
}

function major(version) {
  if (!version) return null;
  const value = Number.parseInt(version.split(".", 1)[0] ?? "", 10);
  return Number.isInteger(value) ? value : null;
}

function npmVersionForActiveNode() {
  const executableDir = dirname(process.execPath);
  const candidates = [
    resolve(executableDir, "../lib/node_modules/npm/package.json"),
    resolve(executableDir, "node_modules/npm/package.json"),
    resolve(executableDir, "../node_modules/npm/package.json"),
  ];

  for (const manifestPath of candidates) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      if (typeof manifest.version === "string") return manifest.version;
    } catch {
      // Try the next standard Node/npm installation layout.
    }
  }

  return null;
}

function invokingPnpmVersion() {
  return process.env.npm_config_user_agent?.match(/(?:^|\s)pnpm\/([^\s]+)/)?.[1] ?? null;
}

const errors = [];
const nodeVersion = process.versions.node;
const npmVersion = npmVersionForActiveNode();
const pnpmVersion = invokingPnpmVersion();

if (major(nodeVersion) !== 22) {
  errors.push(`Node 22.x is required; found ${nodeVersion}`);
}
if (major(npmVersion) !== 10) {
  errors.push(
    `npm 10.x is required; found ${npmVersion ?? "unknown"}. npm 12 changes npm-info JSON and breaks Changesets 2.x publication detection.`,
  );
}
if (major(pnpmVersion) !== 9) {
  errors.push(
    `pnpm 9.x must invoke this script; found ${pnpmVersion ?? "unknown"}. Run the pnpm changeset:publish command rather than calling this file directly.`,
  );
}

try {
  const branch = command("git", ["branch", "--show-current"]);
  if (branch !== "main") {
    errors.push(`publication must run from main; current branch is ${branch || "detached HEAD"}`);
  }

  const status = command("git", ["status", "--porcelain"]);
  if (status) {
    errors.push("publication requires a clean worktree");
  }

  command("git", ["fetch", "--quiet", "origin", "main"]);
  const head = command("git", ["rev-parse", "HEAD"]);
  const originMain = command("git", ["rev-parse", "origin/main"]);
  if (head !== originMain) {
    errors.push("main must exactly match origin/main before publication");
  }
} catch {
  errors.push("unable to verify a clean, current main against origin/main");
}

if (errors.length > 0) {
  console.error("Publish preflight failed:");
  for (const error of errors) console.error(`- ${error}`);
  console.error(
    "Run: nvm install 22 && nvm use 22 && corepack enable && corepack prepare pnpm@9.0.0 --activate",
  );
  process.exit(1);
}

console.log(`Publish toolchain verified: Node ${nodeVersion}, npm ${npmVersion}, pnpm ${pnpmVersion}`);
