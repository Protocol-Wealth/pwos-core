// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * Reference HTTP client for an on-chain portfolio service.
 *
 * The client is transport-agnostic in intent — it exposes typed methods
 * against the endpoint shape documented below, with pluggable auth, base
 * URL, and fetch implementation. Adapt the endpoints to your backend or
 * wrap a different vendor (DeBank, Zerion, CovalentHQ, Octav, your own
 * service) behind the same interface.
 *
 * No endpoint URLs or auth credentials are baked in — the caller supplies
 * everything at construction time.
 */

import type {
  OnchainBalance,
  OnchainClient,
  OnchainSnapshot,
  OnchainWallet,
  PerformanceWindow,
  PortfolioSummary,
} from "./types.js";

/** Credentials and connection options passed at construction. */
export interface OnchainClientOptions {
  /** Base URL of the portfolio service (include protocol + host, no trailing slash). */
  baseUrl: string;
  /** Bearer token or API key. Omitted = public endpoints only. */
  apiKey?: string;
  /** Custom fetch impl — defaults to globalThis.fetch. */
  fetch?: typeof fetch;
  /** Per-request headers added to every call. */
  headers?: Record<string, string>;
  /** Max milliseconds to wait before aborting a request. */
  timeoutMs?: number;
}

export interface PerformancePeriod {
  period?: "week" | "month" | "quarter" | "year" | "ytd" | "custom";
  start?: string;
  end?: string;
}

export class OnchainClientError extends Error {
  constructor(message: string, public readonly status: number, public readonly body: string) {
    super(message);
    this.name = "OnchainClientError";
  }
}

export class OnchainPortfolioClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly headers: Record<string, string>;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs?: number;

  constructor(opts: OnchainClientOptions) {
    if (!opts.baseUrl) {
      throw new Error("baseUrl is required");
    }
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.apiKey = opts.apiKey;
    this.headers = opts.headers ?? {};
    this.fetchImpl = opts.fetch ?? globalThis.fetch;
    this.timeoutMs = opts.timeoutMs;
    if (!this.fetchImpl) {
      throw new Error("No fetch implementation available — pass one explicitly");
    }
  }

  // ──────────────────────────── Clients ─────────────────────────────

  listClients(): Promise<OnchainClient[]> {
    return this.request<OnchainClient[]>("GET", "/api/clients");
  }

  getClient(id: string): Promise<OnchainClient> {
    return this.request<OnchainClient>("GET", `/api/clients/${encodeURIComponent(id)}`);
  }

  // ──────────────────────────── Wallets ─────────────────────────────

  listWallets(clientId: string): Promise<OnchainWallet[]> {
    return this.request<OnchainWallet[]>(
      "GET",
      `/api/clients/${encodeURIComponent(clientId)}/wallets`,
    );
  }

  getBalance(walletId: string): Promise<OnchainBalance> {
    return this.request<OnchainBalance>(
      "GET",
      `/api/wallets/${encodeURIComponent(walletId)}/balance`,
    );
  }

  syncWallet(walletId: string): Promise<OnchainBalance> {
    return this.request<OnchainBalance>(
      "POST",
      `/api/wallets/${encodeURIComponent(walletId)}/sync`,
    );
  }

  // ──────────────────────────── Snapshots ───────────────────────────

  getSnapshots(
    entityType: "client" | "group" | "wallet",
    entityId: string,
    range?: { start?: string; end?: string },
  ): Promise<OnchainSnapshot[]> {
    const params = new URLSearchParams();
    if (range?.start) params.set("start", range.start);
    if (range?.end) params.set("end", range.end);
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.request<OnchainSnapshot[]>(
      "GET",
      `/api/${entityType}s/${encodeURIComponent(entityId)}/snapshots${query}`,
    );
  }

  addSnapshot(
    input: Omit<OnchainSnapshot, "id">,
  ): Promise<OnchainSnapshot> {
    return this.request<OnchainSnapshot>("POST", "/api/snapshots", input);
  }

  // ──────────────────────────── Portfolio roll-ups ──────────────────

  getPortfolio(clientId: string): Promise<PortfolioSummary> {
    return this.request<PortfolioSummary>(
      "GET",
      `/api/clients/${encodeURIComponent(clientId)}/portfolio`,
    );
  }

  getPerformance(
    clientId: string,
    period: PerformancePeriod = { period: "month" },
  ): Promise<PerformanceWindow> {
    const params = new URLSearchParams();
    if (period.period) params.set("period", period.period);
    if (period.start) params.set("start", period.start);
    if (period.end) params.set("end", period.end);
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.request<PerformanceWindow>(
      "GET",
      `/api/clients/${encodeURIComponent(clientId)}/performance${query}`,
    );
  }

  // ──────────────────────────── Internals ───────────────────────────

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...this.headers,
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const controller = this.timeoutMs ? new AbortController() : null;
    const timeoutHandle = controller
      ? setTimeout(() => controller.abort(), this.timeoutMs)
      : null;

    try {
      const res = await this.fetchImpl(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller?.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new OnchainClientError(
          `${method} ${path} → ${res.status}`,
          res.status,
          text.slice(0, 1000),
        );
      }

      return (await res.json()) as T;
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  }
}
