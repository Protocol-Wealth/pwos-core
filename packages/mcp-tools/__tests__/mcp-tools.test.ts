// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
import { describe, expect, it } from "vitest";

import {
  ToolNameConflictError,
  ToolNotFoundError,
  ToolRegistry,
  ToolTier,
  applyFilters,
  disclaimerFilter,
  isAuthorizedFor,
  observerFilter,
  piiRedactionFilter,
  publicTierSanitizer,
  toAnthropicTool,
  toAnthropicTools,
  tierFilter,
  tierRank,
  type ToolDefinition,
  type ToolResult,
} from "../src/index.js";

function tool(
  name: string,
  tier: ToolTier = ToolTier.PUBLIC,
  overrides: Partial<ToolDefinition> = {},
): ToolDefinition {
  return {
    name,
    description: `Tool ${name}`,
    tier,
    input_schema: {
      type: "object",
      properties: { ticker: { type: "string" } },
      required: ["ticker"],
    },
    ...overrides,
  };
}

describe("ToolRegistry", () => {
  it("registers and retrieves tools", () => {
    const r = new ToolRegistry();
    r.register(tool("pw_score"));
    expect(r.has("pw_score")).toBe(true);
    expect(r.get("pw_score").name).toBe("pw_score");
    expect(r.size).toBe(1);
  });

  it("throws on duplicate name", () => {
    const r = new ToolRegistry();
    r.register(tool("foo"));
    expect(() => r.register(tool("foo"))).toThrow(ToolNameConflictError);
  });

  it("upsert replaces existing registration", () => {
    const r = new ToolRegistry();
    r.register(tool("foo"));
    r.upsert({ ...tool("foo"), description: "updated" });
    expect(r.get("foo").description).toBe("updated");
  });

  it("find returns undefined for missing tool", () => {
    const r = new ToolRegistry();
    expect(r.find("nope")).toBeUndefined();
  });

  it("get throws for missing tool", () => {
    const r = new ToolRegistry();
    expect(() => r.get("nope")).toThrow(ToolNotFoundError);
  });

  it("unregister removes and reports", () => {
    const r = new ToolRegistry();
    r.register(tool("foo"));
    expect(r.unregister("foo")).toBe(true);
    expect(r.unregister("foo")).toBe(false);
  });

  it("listForTier respects hierarchy", () => {
    const r = new ToolRegistry();
    r.register(tool("pub", ToolTier.PUBLIC));
    r.register(tool("adv", ToolTier.ADVISOR));
    r.register(tool("sens", ToolTier.SENSITIVE));

    expect(r.listForTier(ToolTier.PUBLIC)).toHaveLength(1);
    expect(r.listForTier(ToolTier.ADVISOR)).toHaveLength(2);
    expect(r.listForTier(ToolTier.SENSITIVE)).toHaveLength(3);
  });

  it("listByTags requires all tags", () => {
    const r = new ToolRegistry();
    r.register(tool("a", ToolTier.PUBLIC, { tags: ["read", "financial"] }));
    r.register(tool("b", ToolTier.PUBLIC, { tags: ["read"] }));
    r.register(tool("c", ToolTier.PUBLIC, { tags: ["write"] }));

    expect(r.listByTags(["read"]).map((t) => t.name)).toEqual(["a", "b"]);
    expect(r.listByTags(["read", "financial"]).map((t) => t.name)).toEqual(["a"]);
    expect(r.listByTags([]).map((t) => t.name).length).toBe(3);
  });
});

describe("Tier", () => {
  it("tierRank orders low-to-high", () => {
    expect(tierRank(ToolTier.PUBLIC)).toBeLessThan(tierRank(ToolTier.ADVISOR));
    expect(tierRank(ToolTier.ADVISOR)).toBeLessThan(tierRank(ToolTier.CLIENT_FILTERED));
    expect(tierRank(ToolTier.CLIENT_FILTERED)).toBeLessThan(tierRank(ToolTier.SENSITIVE));
  });

  it("isAuthorizedFor covers privilege hierarchy", () => {
    expect(isAuthorizedFor(ToolTier.SENSITIVE, ToolTier.PUBLIC)).toBe(true);
    expect(isAuthorizedFor(ToolTier.ADVISOR, ToolTier.ADVISOR)).toBe(true);
    expect(isAuthorizedFor(ToolTier.PUBLIC, ToolTier.ADVISOR)).toBe(false);
  });

  it("tierFilter drops unauthorized tools", () => {
    const tools = [
      tool("pub", ToolTier.PUBLIC),
      tool("adv", ToolTier.ADVISOR),
      tool("sens", ToolTier.SENSITIVE),
    ];
    expect(tierFilter(tools, ToolTier.ADVISOR).map((t) => t.name)).toEqual([
      "pub",
      "adv",
    ]);
  });

  it("defaults missing tier to PUBLIC", () => {
    const tools: Array<{ name: string; tier?: ToolTier }> = [
      { name: "untiered" },
      { name: "adv", tier: ToolTier.ADVISOR },
    ];
    expect(tierFilter(tools, ToolTier.PUBLIC).map((t) => t.name)).toEqual(["untiered"]);
  });
});

describe("Filters", () => {
  const okResult: ToolResult<string> = {
    tool: "foo",
    ok: true,
    data: "client ABC-123 has $50k",
  };

  it("disclaimerFilter attaches text to successful responses", async () => {
    const out = await applyFilters("foo", okResult, [disclaimerFilter("Not advice.")]);
    expect(out.meta?.disclaimer).toBe("Not advice.");
  });

  it("disclaimerFilter skips failed responses", async () => {
    const failed: ToolResult = { tool: "foo", ok: false, error: { code: "x", message: "y" } };
    const out = await applyFilters("foo", failed, [disclaimerFilter("X")]);
    expect(out.meta?.disclaimer).toBeUndefined();
  });

  it("publicTierSanitizer masks directive language for PUBLIC tier", async () => {
    const filter = publicTierSanitizer(new Map([[/\bSTRONG BUY\b/g, "STRONG"]]));
    const resp: ToolResult<string> = { tool: "x", ok: true, data: "Rating: STRONG BUY" };
    const out = await applyFilters("x", resp, [filter], { tier: ToolTier.PUBLIC });
    expect(out.data).toBe("Rating: STRONG");
    expect(out.meta?.public_tier_sanitized).toBe(true);
  });

  it("publicTierSanitizer leaves advisor tier alone", async () => {
    const filter = publicTierSanitizer(new Map([[/\bSTRONG BUY\b/g, "STRONG"]]));
    const resp: ToolResult<string> = { tool: "x", ok: true, data: "Rating: STRONG BUY" };
    const out = await applyFilters("x", resp, [filter], { tier: ToolTier.ADVISOR });
    expect(out.data).toBe("Rating: STRONG BUY");
  });

  it("piiRedactionFilter runs only for CLIENT_FILTERED tier", async () => {
    let scanCalls = 0;
    const scan = async (text: string) => {
      scanCalls++;
      return { sanitizedText: text.replace("ABC-123", "<ACCT>"), hasPII: true };
    };
    const filter = piiRedactionFilter(scan);

    // Advisor tier — no scan
    await applyFilters("f", okResult, [filter], { tier: ToolTier.ADVISOR });
    expect(scanCalls).toBe(0);

    // Client-filtered tier — scan runs, PII masked
    const out = await applyFilters("f", okResult, [filter], {
      tier: ToolTier.CLIENT_FILTERED,
    });
    expect(scanCalls).toBe(1);
    expect(out.data).toBe("client <ACCT> has $50k");
    expect(out.meta?.pii_redacted).toBe(true);
  });

  it("observerFilter swallows errors", async () => {
    const filter = observerFilter(() => {
      throw new Error("audit write failed");
    });
    const out = await applyFilters("f", okResult, [filter]);
    expect(out).toEqual(okResult);
  });

  it("applyFilters runs multiple filters in order", async () => {
    const seen: string[] = [];
    const mark = (label: string) =>
      observerFilter(() => {
        seen.push(label);
      });
    await applyFilters("f", okResult, [mark("a"), mark("b"), mark("c")]);
    expect(seen).toEqual(["a", "b", "c"]);
  });
});

describe("Anthropic adapter", () => {
  it("converts ToolDefinition to Anthropic shape", () => {
    const anth = toAnthropicTool(tool("pw_score"));
    expect(anth.name).toBe("pw_score");
    expect(anth.description).toBe("Tool pw_score");
    expect(anth.input_schema.type).toBe("object");
    expect(anth.input_schema.required).toEqual(["ticker"]);
  });

  it("strips non-standard JSON-Schema keys", () => {
    const t: ToolDefinition = {
      name: "x",
      description: "x",
      input_schema: {
        type: "object",
        properties: {
          ticker: {
            type: "string",
            description: "symbol",
            // non-standard keys
            "x-custom": "should-drop",
          } as any,
        },
        required: ["ticker"],
      },
    };
    const anth = toAnthropicTool(t);
    const props = anth.input_schema.properties as any;
    expect(props.ticker["x-custom"]).toBeUndefined();
    expect(props.ticker.description).toBe("symbol");
  });

  it("toAnthropicTools maps arrays", () => {
    const out = toAnthropicTools([tool("a"), tool("b"), tool("c")]);
    expect(out).toHaveLength(3);
    expect(out.map((t) => t.name)).toEqual(["a", "b", "c"]);
  });
});
