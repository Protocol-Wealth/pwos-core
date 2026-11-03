// SPDX-License-Identifier: MIT-0 OR Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Scorer self-test CLI. Exits 0 when every canned case gets its expected
 * verdict, and 1 with "scorer broken" otherwise. No model is called.
 *
 *   pnpm --filter @protocolwealthos/evals evals:selftest
 */

import { runScorerSelfTest } from "./selfTest.js";

const report = runScorerSelfTest();
for (const r of report.results) {
  console.log(`${r.ok ? "ok  " : "BAD "} ${r.id.padEnd(4)} expected=${r.expected} got=${r.got}`);
}
if (!report.ok) {
  console.error("scorer broken: a canned case did not get its expected verdict");
  process.exit(1);
}
console.log(`scorer self-test passed (${report.results.length} cases)`);
