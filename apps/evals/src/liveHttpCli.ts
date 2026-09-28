// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/** Explicitly opt-in live eval runner for an adopter-owned HTTP endpoint. */

import { createHttpChatCompletionsInvoke } from "./httpChatCompletions.js";
import { runEvals } from "./runner.js";

const endpoint = process.env.EVALS_HTTP_URL;
const model = process.env.EVALS_MODEL;
if (!endpoint || !model) {
  throw new Error("Set EVALS_HTTP_URL and EVALS_MODEL before running live HTTP evals.");
}

const summary = await runEvals({
  live: true,
  modelInvoke: createHttpChatCompletionsInvoke({
    endpoint,
    model,
    apiKey: process.env.EVALS_API_KEY,
  }),
});

for (const [category, counts] of Object.entries(summary.byCategory)) {
  console.log(`${category}: passed=${counts.passed} failed=${counts.failed}`);
}
for (const result of summary.results) {
  if (result.status === "failed") {
    console.error(`${result.caseId}: ${result.failed.map((expectation) => expectation.comment).join("; ")}`);
  }
}

process.exitCode = summary.allCategoriesPassing ? 0 : 1;
