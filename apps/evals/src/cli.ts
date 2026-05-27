// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Tiny CLI wrapper around `runEvals`. Useful in CI:
 *
 *   pnpm --filter @protocolwealthos-apps/evals evals:offline
 *
 * Lists all fixtures the harness sees, then runs them in offline mode and
 * prints a per-category summary. Exits with 0 on a clean offline run; any
 * load-time validation error throws and exits non-zero.
 *
 * For live mode, adopters should call `runEvals({ live: true, modelInvoke })`
 * directly from their own scripts — wiring a model into this CLI is
 * adopter-specific and out of scope for the harness.
 */

import { runEvals } from "./runner.js";

const listOnly = process.argv.includes("--list");

const summary = await runEvals({ live: false });

if (listOnly) {
  for (const r of summary.results) {
    console.log(`${r.category.padEnd(28)} ${r.caseId}`);
  }
  process.exit(0);
}

console.log(`Loaded ${summary.total} fixture(s) (offline mode — no model called).\n`);
console.log("Per-category counts:");
for (const [cat, c] of Object.entries(summary.byCategory)) {
  console.log(
    `  ${cat.padEnd(28)} total=${c.total} skipped=${c.skipped} passed=${c.passed} failed=${c.failed}`,
  );
}
console.log("\nRun with `{ live: true, modelInvoke }` from your own script to actually exercise a model.");
