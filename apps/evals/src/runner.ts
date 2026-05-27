// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Eval-harness runner.
 *
 * Default mode (`live: false`) is OFFLINE and hermetic — fixtures load and
 * validate, but no model is invoked and every case is `skipped`. This is
 * what runs in CI: a green run proves the fixtures + the harness itself
 * are wired correctly, without burning any model tokens.
 *
 * Live mode (`live: true, modelInvoke`) actually calls the adopter-supplied
 * function. Each case's response is checked against every expectation; any
 * unsatisfied expectation marks the case `failed`.
 */

import { evaluateExpectation } from "./predicates.js";
import { loadFixtures } from "./loadFixtures.js";
import { EVAL_CATEGORIES } from "./types.js";
import type {
  CategoryCounts,
  EvalCase,
  EvalCategory,
  EvalResult,
  Expectation,
  RunOptions,
  RunSummary,
} from "./types.js";

const ZERO_COUNTS: CategoryCounts = { total: 0, passed: 0, failed: 0, skipped: 0 };

export async function runEvals(opts: RunOptions = {}): Promise<RunSummary> {
  const allCases = loadFixtures({ fixturesDir: opts.fixturesDir });

  const requestedCategories = new Set<EvalCategory>(opts.categories ?? EVAL_CATEGORIES);
  const requestedIds = opts.caseIds ? new Set(opts.caseIds) : undefined;

  const live = opts.live === true;
  if (live && opts.modelInvoke === undefined) {
    throw new Error("runEvals: live=true requires `modelInvoke` to be supplied.");
  }

  const results: EvalResult[] = [];
  for (const c of allCases) {
    if (!requestedCategories.has(c.category)) {
      results.push({
        caseId: c.id,
        category: c.category,
        status: "skipped",
        reason: "category_filter",
      });
      continue;
    }
    if (requestedIds && !requestedIds.has(c.id)) {
      results.push({
        caseId: c.id,
        category: c.category,
        status: "skipped",
        reason: "category_filter",
      });
      continue;
    }
    if (!live) {
      results.push({
        caseId: c.id,
        category: c.category,
        status: "skipped",
        reason: "offline_mode",
      });
      continue;
    }
    results.push(await runOneLive(c, opts.modelInvoke!));
  }

  return summarize(results, live);
}

async function runOneLive(c: EvalCase, modelInvoke: NonNullable<RunOptions["modelInvoke"]>): Promise<EvalResult> {
  const response = await modelInvoke({ prompt: c.prompt, system: c.system });
  const failed: Expectation[] = [];
  for (const exp of c.expectations) {
    if (!evaluateExpectation(response, exp)) failed.push(exp);
  }
  if (failed.length === 0) {
    return { caseId: c.id, category: c.category, status: "passed", response };
  }
  return { caseId: c.id, category: c.category, status: "failed", response, failed };
}

function summarize(results: EvalResult[], live: boolean): RunSummary {
  const byCategory = {} as Record<EvalCategory, CategoryCounts>;
  for (const cat of EVAL_CATEGORIES) byCategory[cat] = { ...ZERO_COUNTS };

  for (const r of results) {
    const c = byCategory[r.category];
    byCategory[r.category] = {
      total: c.total + 1,
      passed: c.passed + (r.status === "passed" ? 1 : 0),
      failed: c.failed + (r.status === "failed" ? 1 : 0),
      skipped: c.skipped + (r.status === "skipped" ? 1 : 0),
    };
  }

  const allCategoriesPassing =
    live && EVAL_CATEGORIES.every((cat) => byCategory[cat].passed > 0 && byCategory[cat].failed === 0);

  return {
    total: results.length,
    byCategory,
    results,
    allCategoriesPassing,
    offline: !live,
  };
}
