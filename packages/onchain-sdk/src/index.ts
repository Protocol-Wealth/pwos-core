// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * @protocolwealthos/onchain-sdk
 *
 * Typed client + models for an on-chain portfolio tracking service. Intended
 * for advisor-side platforms that aggregate wallet data, DeFi positions,
 * daily snapshots, and performance windows.
 *
 * Usage::
 *
 *     import { OnchainPortfolioClient } from "@protocolwealthos/onchain-sdk";
 *
 *     const client = new OnchainPortfolioClient({
 *       baseUrl: "https://your-portfolio-service.example.com",
 *       apiKey: process.env.PORTFOLIO_API_KEY,
 *     });
 *
 *     const clients = await client.listClients();
 *     const balance = await client.getBalance("wallet_id");
 *
 * Adapts to any HTTP service that speaks the documented endpoint shape —
 * or wrap a different vendor (DeBank, Zerion, Covalent) behind the same
 * interface by subclassing and overriding ``request``.
 */

export const VERSION = "0.1.0";

export {
  OnchainClientError,
  OnchainPortfolioClient,
  type OnchainClientOptions,
  type PerformancePeriod,
} from "./client.js";

export type {
  ChainType,
  OnchainBalance,
  OnchainClient,
  OnchainGroup,
  OnchainSnapshot,
  OnchainWallet,
  PerformanceWindow,
  PortfolioSummary,
  ProtocolPosition,
  TokenBalance,
} from "./types.js";
