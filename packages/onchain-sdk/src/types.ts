// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * Generalized on-chain portfolio types.
 *
 * These types describe portfolios held across EVM chains, Solana, Bitcoin,
 * and others, at the level an advisor platform cares about: clients own
 * wallets, wallets hold tokens and protocol positions, and both roll up
 * into daily snapshots for reporting.
 *
 * The types are stable across vendors — adapt a concrete SDK to them by
 * mapping your vendor's response into these shapes.
 */

/** Supported chain families — extend via string literal widening as needed. */
export type ChainType =
  | "evm"
  | "solana"
  | "bitcoin"
  | "cosmos"
  | "other";

export interface OnchainClient {
  id: string;
  name: string;
  realName?: string;
  displayName?: string;
  email?: string;
  status?: string;
  groups?: OnchainGroup[];
}

export interface OnchainGroup {
  id: string;
  name: string;
  wallets: OnchainWallet[];
}

export interface OnchainWallet {
  id: string;
  address: string;
  chainType: ChainType;
  specificChain?: string;
  label?: string;
  groupName?: string;
  isTracking: boolean;
  lastSnapshotAt?: string;
}

export interface TokenBalance {
  chain: string;
  tokenSymbol: string;
  balance: string;
  balanceUsd: number;
  contractAddress?: string;
}

export interface ProtocolPosition {
  protocolName: string;
  positionType: "lending" | "lp" | "staking" | "vault" | "derivative" | "other";
  netUsdValue: number;
  apy?: number;
  rewardsUsd?: number;
  healthFactor?: number;
  details?: Record<string, unknown>;
}

export interface OnchainBalance {
  walletId: string;
  address: string;
  chainType: ChainType;
  totalUsd: number;
  balances: TokenBalance[];
  protocolPositions?: ProtocolPosition[];
  fetchedAt: string;
}

export interface OnchainSnapshot {
  id: string;
  entityType: "client" | "group" | "wallet";
  entityId: string;
  snapshotDate: string;
  totalValue: number;
  holdingsValue: number;
  positionsValue: number;
  dailyPnl?: number;
  dailyPnlPercent?: number;
}

export interface PortfolioSummary {
  clientId: string;
  totalUsd: number;
  chainAllocation: Record<string, number>;
  topHoldings: Array<{ symbol: string; usdValue: number; percent: number }>;
  asOf: string;
}

export interface PerformanceWindow {
  start: string;
  end: string;
  startValue: number;
  endValue: number;
  pnl: number;
  pnlPercent: number;
  flows: number;
}
