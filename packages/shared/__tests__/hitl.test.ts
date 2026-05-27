// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * HITL gate tests.
 *
 * Load-bearing assertion: the gate is FAIL-CLOSED. Any input that doesn't
 * have a policy entry must return `requiresApproval: true`. The dedicated
 * "fail-closed invariant" describe block enumerates the unknown-class
 * variants this assertion holds against.
 */

import { describe, expect, it } from "vitest";

import {
  DEFAULT_POLICY,
  evaluateHitl,
  hitlActionSchema,
  hitlPolicySchema,
  KNOWN_ACTION_CLASSES,
  parseHitlPolicy,
  resolveHitlPolicy,
  type HitlAction,
  type HitlPolicy,
} from "../src/hitl/index.js";

const baseAction = (cls: string): HitlAction => ({
  id: "act_test_1",
  class: cls,
  label: `test action for class=${cls}`,
});

describe("evaluateHitl — default policy, known classes", () => {
  it("client_facing_deliverable -> mandatory approval", () => {
    const decision = evaluateHitl(baseAction("client_facing_deliverable"), DEFAULT_POLICY);
    expect(decision.oversight).toBe("mandatory");
    expect(decision.requiresApproval).toBe(true);
    expect(decision.actionClass).toBe("client_facing_deliverable");
    expect(decision.reason).toContain("mandatory");
  });

  it("internal_research -> optional (no approval required)", () => {
    const decision = evaluateHitl(baseAction("internal_research"), DEFAULT_POLICY);
    expect(decision.oversight).toBe("optional");
    expect(decision.requiresApproval).toBe(false);
    expect(decision.actionClass).toBe("internal_research");
    expect(decision.reason).toContain("optional");
  });

  it("both canonical classes are present in DEFAULT_POLICY", () => {
    for (const cls of KNOWN_ACTION_CLASSES) {
      expect(DEFAULT_POLICY[cls]).toBeDefined();
    }
  });
});

describe("evaluateHitl — fail-closed invariant", () => {
  // The single most important property of the gate: unknown -> require approval.

  const unknownClasses = [
    "totally_made_up_class",
    "client_facing_deliverable_typo",
    "internal_RESEARCH", // case-sensitive
    "",
    " ",
    "marketing_campaign", // plausibly client-facing, but not in default policy
    "🦄_special",
  ];

  it.each(unknownClasses)("unknown class %j -> requiresApproval: true", (cls) => {
    // Action.class must be at least 1 char per schema, but the evaluator is a
    // pure function and accepts any string; the test exercises the evaluator
    // directly so we can probe the failure modes the schema would normally
    // catch upstream.
    const decision = evaluateHitl({ id: "act_x", class: cls }, DEFAULT_POLICY);
    expect(decision.oversight).toBe("unknown");
    expect(decision.requiresApproval).toBe(true);
    expect(decision.reason).toContain("fails closed");
  });

  it("empty policy -> EVERY class is fail-closed", () => {
    const emptyPolicy: HitlPolicy = {};
    for (const cls of KNOWN_ACTION_CLASSES) {
      const d = evaluateHitl(baseAction(cls), emptyPolicy);
      expect(d.requiresApproval).toBe(true);
      expect(d.oversight).toBe("unknown");
    }
  });

  it("partial policy -> only listed classes pass; others fail closed", () => {
    const partial: HitlPolicy = { internal_research: "optional" };
    const known = evaluateHitl(baseAction("internal_research"), partial);
    expect(known.requiresApproval).toBe(false);

    const missing = evaluateHitl(baseAction("client_facing_deliverable"), partial);
    expect(missing.requiresApproval).toBe(true);
    expect(missing.oversight).toBe("unknown");
  });
});

describe("evaluateHitl — purity", () => {
  it("same inputs -> same outputs (no I/O, no clocks, no globals)", () => {
    const action = baseAction("internal_research");
    const a = evaluateHitl(action, DEFAULT_POLICY);
    const b = evaluateHitl(action, DEFAULT_POLICY);
    const c = evaluateHitl(action, DEFAULT_POLICY);
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });

  it("does not mutate the input action or policy", () => {
    const action = baseAction("client_facing_deliverable");
    const actionSnapshot = JSON.stringify(action);
    const policy: HitlPolicy = { ...DEFAULT_POLICY };
    const policySnapshot = JSON.stringify(policy);

    evaluateHitl(action, policy);
    expect(JSON.stringify(action)).toBe(actionSnapshot);
    expect(JSON.stringify(policy)).toBe(policySnapshot);
  });
});

describe("evaluateHitl — custom action classes", () => {
  it("adopter-defined class with mandatory level requires approval", () => {
    const policy: HitlPolicy = {
      ...DEFAULT_POLICY,
      send_email_to_client: "mandatory",
      execute_trade: "mandatory",
      generate_what_if_scenario: "optional",
    };

    expect(evaluateHitl(baseAction("send_email_to_client"), policy).requiresApproval).toBe(
      true,
    );
    expect(evaluateHitl(baseAction("execute_trade"), policy).requiresApproval).toBe(true);
    expect(
      evaluateHitl(baseAction("generate_what_if_scenario"), policy).requiresApproval,
    ).toBe(false);
  });
});

describe("hitlPolicySchema — Zod validation", () => {
  it("accepts the default policy", () => {
    const parsed = parseHitlPolicy(DEFAULT_POLICY);
    expect(parsed).toEqual(DEFAULT_POLICY);
  });

  it("rejects unknown oversight level", () => {
    expect(() =>
      parseHitlPolicy({ client_facing_deliverable: "definitely-not-real" }),
    ).toThrow();
  });

  it("rejects non-string keys (numeric values rejected)", () => {
    const result = hitlPolicySchema.safeParse({ foo: 42 });
    expect(result.success).toBe(false);
  });

  it("resolveHitlPolicy returns DEFAULT_POLICY when input omitted", () => {
    expect(resolveHitlPolicy()).toEqual(DEFAULT_POLICY);
    expect(resolveHitlPolicy(undefined)).toEqual(DEFAULT_POLICY);
    expect(resolveHitlPolicy(null)).toEqual(DEFAULT_POLICY);
  });
});

describe("hitlActionSchema — Zod validation", () => {
  it("accepts a minimal action", () => {
    const parsed = hitlActionSchema.parse({ id: "x", class: "y" });
    expect(parsed.id).toBe("x");
    expect(parsed.class).toBe("y");
  });

  it("rejects empty id and empty class", () => {
    expect(hitlActionSchema.safeParse({ id: "", class: "y" }).success).toBe(false);
    expect(hitlActionSchema.safeParse({ id: "x", class: "" }).success).toBe(false);
  });
});
