// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
import { describe, expect, it } from "vitest";

import { OnchainClientError, OnchainPortfolioClient } from "../src/index.js";

function makeFetch(
  handler: (url: string, init: RequestInit) => { status?: number; body?: unknown; text?: string },
) {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    const u = typeof url === "string" ? url : url.toString();
    const r = handler(u, init ?? {});
    const status = r.status ?? 200;
    const body = r.text ?? JSON.stringify(r.body ?? {});
    return new Response(body, {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

describe("OnchainPortfolioClient", () => {
  it("requires baseUrl", () => {
    expect(() => new OnchainPortfolioClient({ baseUrl: "" })).toThrow(/baseUrl/);
  });

  it("strips trailing slash from baseUrl", async () => {
    let observedUrl = "";
    const client = new OnchainPortfolioClient({
      baseUrl: "https://example.com/",
      fetch: makeFetch((u) => {
        observedUrl = u;
        return { body: [] };
      }),
    });
    await client.listClients();
    expect(observedUrl).toBe("https://example.com/api/clients");
  });

  it("attaches bearer auth when apiKey provided", async () => {
    let observedAuth: string | null = null;
    const client = new OnchainPortfolioClient({
      baseUrl: "https://example.com",
      apiKey: "sk_test_123",
      fetch: makeFetch((_u, init) => {
        observedAuth = (init.headers as Record<string, string>).Authorization ?? null;
        return { body: [] };
      }),
    });
    await client.listClients();
    expect(observedAuth).toBe("Bearer sk_test_123");
  });

  it("omits auth header when no apiKey", async () => {
    let hasAuth = false;
    const client = new OnchainPortfolioClient({
      baseUrl: "https://example.com",
      fetch: makeFetch((_u, init) => {
        hasAuth = Boolean((init.headers as Record<string, string>).Authorization);
        return { body: [] };
      }),
    });
    await client.listClients();
    expect(hasAuth).toBe(false);
  });

  it("throws OnchainClientError on non-2xx", async () => {
    const client = new OnchainPortfolioClient({
      baseUrl: "https://example.com",
      fetch: makeFetch(() => ({ status: 503, text: "upstream down" })),
    });
    await expect(client.listClients()).rejects.toBeInstanceOf(OnchainClientError);
  });

  it("decodes typed responses", async () => {
    const client = new OnchainPortfolioClient({
      baseUrl: "https://example.com",
      fetch: makeFetch(() => ({ body: [{ id: "c1", name: "Acme" }] })),
    });
    const clients = await client.listClients();
    expect(clients).toEqual([{ id: "c1", name: "Acme" }]);
  });

  it("encodes path params safely", async () => {
    let observedUrl = "";
    const client = new OnchainPortfolioClient({
      baseUrl: "https://example.com",
      fetch: makeFetch((u) => {
        observedUrl = u;
        return { body: {} };
      }),
    });
    await client.getClient("id with/slash");
    expect(observedUrl).toContain("id%20with%2Fslash");
  });

  it("builds snapshot range query", async () => {
    let observedUrl = "";
    const client = new OnchainPortfolioClient({
      baseUrl: "https://example.com",
      fetch: makeFetch((u) => {
        observedUrl = u;
        return { body: [] };
      }),
    });
    await client.getSnapshots("client", "c1", { start: "2026-01-01", end: "2026-02-01" });
    expect(observedUrl).toContain("start=2026-01-01");
    expect(observedUrl).toContain("end=2026-02-01");
  });
});
