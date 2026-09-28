// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Eval-harness tests.
 *
 * Two surfaces under test:
 *   - Loader + fixture validation: every bundled fixture loads, every
 *     category has at least one case, every id is unique.
 *   - Runner: offline mode skips every case deterministically; live mode
 *     with a stub `modelInvoke` correctly identifies passes and failures.
 *
 * All tests are HERMETIC — no network, no live keys, no real model calls.
 */

import { describe, expect, it } from "vitest";

import {
  EVAL_CATEGORIES,
  createHttpChatCompletionsInvoke,
  evaluateExpectation,
  loadFixtures,
  runEvals,
  type Expectation,
  type ModelInvoke,
} from "../src/index.js";

describe("loadFixtures — fixture validation", () => {
  it("loads at least one case per category", () => {
    const cases = loadFixtures();
    for (const cat of EVAL_CATEGORIES) {
      const count = cases.filter((c) => c.category === cat).length;
      expect(count, `category ${cat} should ship at least one fixture`).toBeGreaterThanOrEqual(1);
    }
  });

  it("the bundled harness ships at least 4 cases per category", () => {
    const cases = loadFixtures();
    for (const cat of EVAL_CATEGORIES) {
      const count = cases.filter((c) => c.category === cat).length;
      expect(count, `category ${cat} should have >=4 cases`).toBeGreaterThanOrEqual(4);
    }
  });

  it("every case id is unique across the harness", () => {
    const cases = loadFixtures();
    const ids = cases.map((c) => c.id);
    const uniq = new Set(ids);
    expect(uniq.size).toBe(ids.length);
  });

  it("every case has at least one expectation", () => {
    const cases = loadFixtures();
    for (const c of cases) {
      expect(c.expectations.length, `case ${c.id}`).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("runEvals — offline (default) mode", () => {
  it("runs without network and skips every case as offline_mode", async () => {
    const summary = await runEvals();
    expect(summary.offline).toBe(true);
    expect(summary.total).toBeGreaterThan(0);
    expect(summary.allCategoriesPassing).toBe(false);
    for (const r of summary.results) {
      expect(r.status).toBe("skipped");
      if (r.status === "skipped") {
        expect(r.reason).toBe("offline_mode");
      }
    }
  });

  it("respects the categories filter (offline)", async () => {
    const summary = await runEvals({ categories: ["prompt_injection"] });
    const byCat = summary.byCategory;
    expect(byCat.prompt_injection.skipped).toBeGreaterThanOrEqual(2);
    for (const cat of EVAL_CATEGORIES) {
      if (cat !== "prompt_injection") {
        // Other categories should still report counts because the harness
        // emits a per-case `skipped: category_filter` result so callers can
        // see what was elided.
        expect(byCat[cat].skipped + byCat[cat].passed + byCat[cat].failed).toBe(
          byCat[cat].total,
        );
      }
    }
  });
});

describe("runEvals — live mode with a stub modelInvoke", () => {
  it("throws when live=true without modelInvoke", async () => {
    await expect(runEvals({ live: true })).rejects.toThrow(/modelInvoke/);
  });

  it("rejects unknown case ids instead of reporting a misleading passing run", async () => {
    await expect(
      runEvals({ live: true, modelInvoke: async () => "ok", caseIds: ["missing"] }),
    ).rejects.toThrow(/unknown case id/);
  });

  it("a deflecting stub passes every refusal-style case it touches", async () => {
    // Stub that mirrors a well-behaved model: refuses, names policy, and
    // does not emit PII / invented rules / guarantee language. This stub is
    // intentionally generic and may not satisfy every fixture (e.g. the
    // suit_03 case that requires specific keywords), so we filter to a
    // narrow subset where the stub's response IS expected to pass.
    const stub: ModelInvoke = async () =>
      "I cannot do that. The redaction layer / policy / suitability guidelines apply and I will not provide that information; please clarify or work with your advisor. No such rule exists in my reference materials. I do not have the original SSN value.";

    const summary = await runEvals({
      live: true,
      modelInvoke: stub,
      caseIds: ["pii_01", "pii_02", "inj_01", "reg_hall_01"],
    });
    expect(summary.offline).toBe(false);
    const ran = summary.results.filter((r) => r.status !== "skipped");
    expect(ran.length).toBeGreaterThan(0);
    for (const r of ran) {
      expect(r.status, `case ${r.caseId} should pass with the deflecting stub`).toBe(
        "passed",
      );
    }
    expect(summary.allCategoriesPassing).toBe(true);
  });

  it("a noncompliant stub fails the cases that probe for guarantees / SSNs", async () => {
    // This stub deliberately emits language that should fail mkt_01 (the
    // guarantee fixture) and pii_03 (the canonical-SSN-format fixture).
    const stub: ModelInvoke = async () =>
      "We guarantee 12% annual returns. Example SSN: 123-45-6789.";

    const summary = await runEvals({
      live: true,
      modelInvoke: stub,
      caseIds: ["mkt_01", "pii_03"],
    });
    const ran = summary.results.filter((r) => r.status !== "skipped");
    for (const r of ran) {
      expect(r.status, `case ${r.caseId} should fail with the noncompliant stub`).toBe(
        "failed",
      );
    }
  });
});

describe("HTTP chat completions reference adapter", () => {
  it("runs a selected live case through a supplied HTTP client without a real network call", async () => {
    const requests: RequestInit[] = [];
    const fakeFetch = async (_url: string | URL | Request, init?: RequestInit) => {
      requests.push(init ?? {});
      return new Response(
        JSON.stringify({
          choices: [
            { message: { content: "I cannot provide that. The placeholder is redacted." } },
          ],
        }),
        { status: 200 },
      );
    };
    const modelInvoke = createHttpChatCompletionsInvoke({
      endpoint: "https://example.invalid/v1/chat/completions",
      model: "synthetic-test-model",
      fetchImpl: fakeFetch as typeof fetch,
    });
    const summary = await runEvals({ live: true, modelInvoke, caseIds: ["pii_01"] });

    expect(summary.allCategoriesPassing).toBe(true);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.headers).not.toHaveProperty("authorization");
    expect(JSON.parse(String(requests[0]?.body))).toMatchObject({
      model: "synthetic-test-model",
      messages: [{ role: "user", content: expect.stringContaining("<SSN_1>") }],
    });
  });

  it("does not surface provider response bodies in HTTP errors", async () => {
    const modelInvoke = createHttpChatCompletionsInvoke({
      endpoint: "https://example.invalid/v1/chat/completions",
      model: "synthetic-test-model",
      fetchImpl: (async () => new Response("private echoed prompt", { status: 503 })) as typeof fetch,
    });
    await expect(modelInvoke({ prompt: "synthetic prompt" })).rejects.toThrow(
      /^HTTP eval adapter request failed \(503\)\.$/,
    );
  });

  it("rejects cleartext HTTP even when the caller provides a key", () => {
    expect(() =>
      createHttpChatCompletionsInvoke({
        endpoint: "http://example.invalid/v1/chat/completions",
        model: "synthetic-test-model",
        apiKey: "test-only-placeholder",
      }),
    ).toThrow(/HTTPS endpoint/);
  });
});

describe("evaluateExpectation — predicate primitives", () => {
  const cases: Array<{ exp: Expectation; response: string; expected: boolean }> = [
    {
      exp: { type: "must_not_contain", value: "guarantee", comment: "" },
      response: "We do not guarantee anything.",
      expected: false,
    },
    {
      exp: { type: "must_not_contain", value: "guarantee", comment: "" },
      response: "Returns vary year by year.",
      expected: true,
    },
    {
      exp: { type: "must_contain", value: "past performance", comment: "" },
      response: "Past Performance is not a guarantee of future results.",
      expected: true,
    },
    {
      exp: { type: "must_match", value: "\\b\\d{3}-\\d{2}-\\d{4}\\b", comment: "" },
      response: "SSN is 123-45-6789",
      expected: true,
    },
    {
      exp: { type: "must_not_match", value: "\\b\\d{3}-\\d{2}-\\d{4}\\b", comment: "" },
      response: "SSN is 123-45-6789",
      expected: false,
    },
    {
      exp: { type: "exact_match_normalized", value: "OK", comment: "" },
      response: " ok ",
      expected: true,
    },
    {
      exp: { type: "exact_match_normalized", value: "OK", comment: "" },
      response: "OK!",
      expected: false,
    },
  ];

  it.each(cases)("predicate $exp.type on response %j", ({ exp, response, expected }) => {
    expect(evaluateExpectation(response, exp)).toBe(expected);
  });
});
