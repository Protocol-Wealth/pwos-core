// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { readFileSync } from "node:fs";

import { ToolRegistry, ToolTier } from "@protocolwealthos/mcp-tools";
import { describe, expect, it } from "vitest";

import {
  ACCOUNTING_CONTRACT_VERSION,
  ACCOUNTING_GATEWAY_TOOL_IDS,
  ACCOUNTING_METHOD_VERSION,
  ACCOUNTING_MODEL_INPUT_SCHEMA_HINTS,
  ACCOUNTING_RESPONSE_STRUCTURE_SCHEMA_HINTS,
  ACCOUNTING_TOOL_DEFINITIONS,
  ACCOUNTING_TOOL_IDS,
  AccountingIdentityKeyError,
  MAX_ACCOUNTING_DECIMAL_STRING_LENGTH,
  VERSION,
  accountingDecimalSubtractEquals,
  accountingDecimalSumEquals,
  accountingToolDiscoverySchema,
  accountingDecimalProductFitsDerivedEnvelope,
  accountingDecimalStringsEqual,
  assessAccountingResponseCorrelation,
  computeCostBasisRequestSchema,
  computeCostBasisResponseSchema,
  decodeOnchainEventsResponseSchema,
  describeAccountingResponseSchema,
  findAccountingIdentityKeys,
  getAccountingJsonSchemaHints,
  isAccountingGatewayCompatible,
  isAccountingResponseCorrelationVerified,
  isNexusAccountingResultEligibleForComposition,
  onchainPnlReportResponseSchema,
  parseAccountingRequest,
  parseAccountingResponse,
  priceHistoryResponseSchema,
  registerAccountingTools,
  reportWindowInputSchema,
  type ComputeCostBasisResponse,
} from "../src/index.js";

const METHODOLOGY = {
  method: "fifo",
  method_version: "2.0.0",
  source: "nexus-core/docs/ONCHAIN-ACCOUNTING.md",
  last_verified: "2026-07-16",
  review_status: "pending_governance_review",
  holding_period_rule:
    "calendar dates; count from the day after acquisition through disposition; long term only after the one-year anniversary",
  event_treatment: {
    acquire: "acquisition",
    dispose: "taxable_disposition",
    swap: "taxable_exchange",
    transfer_in: "explicit_transfer_treatment",
    transfer_out: "explicit_transfer_treatment",
    deposit: "explicit_tax_treatment_required",
    withdraw: "explicit_tax_treatment_required",
    lp_add: "explicit_tax_treatment_required",
    lp_remove: "explicit_tax_treatment_required",
    stake: "explicit_tax_treatment_required",
    unstake: "explicit_tax_treatment_required",
    claim: "income_basis_acquisition",
    fee: "fee_asset_disposition",
    other: "unresolved",
  },
  transfer_rule:
    "same_owner requires an opaque transfer_ref and preserves FIFO lot quantity, basis, and acquisition date; external or unknown treatment is unresolved",
  fee_rule:
    "fee_usd is allocated exactly once to acquisition basis or disposition proceeds; a digital-asset fee leg is also a separate disposition",
} as const;

const REPLAY = {
  replay_version: "1.0.0",
  mode: "full_history",
  start_at: 1_600_000_000,
  end_at: 1_640_000_001,
  opening_state_ref: null,
  opening_state_schema_version: null,
  opening_state_source: null,
  opening_state_last_verified: null,
  opening_state_basis_method: null,
  opening_state_basis_method_version: null,
  opening_state_snapshot_complete: null,
  input_event_count: 2,
  replayed_event_count: 2,
  pre_period_event_count: 0,
  in_period_event_count: 2,
  post_period_excluded_count: 0,
} as const;

const COVERAGE = {
  account_count: 1,
  asset_count: 1,
  open_lot_count: 1,
  known_basis_open_lot_count: 1,
  unknown_basis_open_lot_count: 0,
  disposition_count: 1,
  complete_disposition_count: 1,
  incomplete_disposition_count: 0,
  unresolved_event_count: 0,
  unresolved_transfer_count: 0,
  unresolved_fee_count: 0,
} as const;

const COMPLETENESS = {
  complete: true,
  statement_ready: false,
  gap_count: 0,
  gaps: [],
} as const;

const ASSET = {
  asset_id: "ethereum:asset-1",
  symbol: "TOK",
  chain: "ethereum",
  decimals: 18,
} as const;

const DISPOSAL = {
  disposition_ref: "sell:out:0:fragment:0",
  disposition_type: "principal",
  account_ref: "account-opaque-1",
  asset: ASSET,
  quantity: "1",
  gross_proceeds_usd: "30",
  fee_adjustment_usd: "0",
  proceeds_usd: "30",
  cost_basis_usd: "10",
  realized_gain_usd: "20",
  lot_ref: "buy:in:0",
  acquisition_event_id: "buy",
  acquisition_tx_ref: null,
  origin_lot_ref: "buy:in:0",
  disposal_event_id: "sell",
  disposal_tx_ref: null,
  basis_source: "market",
  basis_override_ref: null,
  basis_last_verified: null,
  basis_evidence_source: null,
  basis_fee_adjustment_usd: "0",
  basis_price_source: "fixture",
  basis_price_as_of: 1_600_000_000,
  proceeds_price_source: "fixture",
  proceeds_price_as_of: 1_640_000_000,
  fee_allocation: null,
  fee_payment: null,
  acquired_at: 1_600_000_000,
  disposed_at: 1_640_000_000,
  holding_days: 463,
  term: "long",
  complete: true,
  missing_fields: [],
} as const;

const COMMON_RESPONSE = {
  contractVersion: "0.2.0",
  disclaimer: "Illustrative accounting output; not tax advice.",
  method: "fifo",
  methodology: METHODOLOGY,
  replay: REPLAY,
  coverage: COVERAGE,
  completeness: COMPLETENESS,
  assumptions: [
    {
      code: "full_history_assertion",
      message: "caller asserted that supplied pre-period events are complete history",
      event_id: null,
      transfer_ref: null,
    },
  ],
} as const;

const GOLDEN_COST_BASIS_RESPONSE = {
  ...COMMON_RESPONSE,
  open_lots: [
    {
      lot_ref: "buy:in:0",
      account_ref: "account-opaque-1",
      asset: ASSET,
      quantity: "1",
      cost_basis_usd: "10",
      unit_cost_usd: "10",
      acquired_at: 1_600_000_000,
      acquisition_sequence: null,
      acquisition_leg_index: 0,
      basis_source: "market",
      basis_override_ref: null,
      basis_last_verified: null,
      basis_evidence_source: null,
      acquisition_fee_usd: "0",
      acquisition_event_id: "buy",
      acquisition_tx_ref: null,
      origin_lot_ref: "buy:in:0",
      basis_price_source: "fixture",
      basis_price_as_of: 1_600_000_000,
      market_value_usd: null,
      unrealized_pnl_usd: null,
      market_price_source: null,
      market_price_as_of: null,
    },
  ],
  disposals: [DISPOSAL],
  totals: {
    open_cost_basis_usd: "10",
    open_market_value_usd: null,
    open_unrealized_pnl_usd: null,
    realized_gain_usd: "20",
  },
  warnings: [],
} as const;

const GOLDEN_PNL_RESPONSE = {
  ...COMMON_RESPONSE,
  disclaimer:
    "Illustrative onchain realized-PnL summary for tax awareness only - not tax advice, not a tax return, and not a complete cost-basis record.",
  summary: {
    realized_gain_usd: "20",
    short_term_gain_usd: "0",
    long_term_gain_usd: "20",
    proceeds_usd: "30",
    cost_basis_usd: "10",
    disposal_count: 1,
    incomplete_count: 0,
    calculation_gap_count: 0,
    complete: true,
  },
  by_year: [
    {
      year: 2021,
      realized_gain_usd: "20",
      short_term_gain_usd: "0",
      long_term_gain_usd: "20",
      proceeds_usd: "30",
      cost_basis_usd: "10",
      disposal_count: 1,
      incomplete_count: 0,
      calculation_gap_count: 0,
      complete: true,
    },
  ],
  dispositions: [DISPOSAL],
  warnings: [],
} as const;

const GOLDEN_REQUEST = {
  events: [
    {
      event_id: "buy",
      account_ref: "account-opaque-1",
      kind: "acquire",
      timestamp: 1_600_000_000,
      legs: [
        {
          asset: ASSET,
          direction: "in",
          amount: "2",
          usd_value: "20",
          price_source: "fixture",
          price_as_of: 1_600_000_000,
        },
      ],
    },
    {
      event_id: "sell",
      account_ref: "account-opaque-1",
      kind: "dispose",
      timestamp: 1_640_000_000,
      legs: [
        {
          asset: ASSET,
          direction: "out",
          amount: "1",
          usd_value: "30",
          price_source: "fixture",
          price_as_of: 1_640_000_000,
        },
      ],
    },
  ],
  report_window: {
    start_at: 1_600_000_000,
    end_at: 1_640_000_001,
    full_history: true,
  },
  method: "fifo",
} as const;

describe("contract and decimal invariants", () => {
  it("pins the deployed contract and methodology independently", () => {
    const manifest = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { version: string; dependencies: Record<string, string> };
    expect(VERSION).toBe(manifest.version);
    expect(VERSION).toBe("0.1.0");
    expect(manifest.dependencies["@protocolwealthos/mcp-tools"]).toBe("workspace:^0.3.0");
    expect(ACCOUNTING_CONTRACT_VERSION).toBe("0.2.0");
    expect(ACCOUNTING_METHOD_VERSION).toBe("2.0.0");
    expect(ACCOUNTING_TOOL_IDS).toEqual([
      "price_history",
      "decode_onchain_events",
      "compute_cost_basis",
      "onchain_pnl_report",
    ]);
  });

  it("preserves exact decimal strings and rejects floating-point inputs", () => {
    const parsed = computeCostBasisRequestSchema.parse({
      ...GOLDEN_REQUEST,
      events: [
        {
          ...GOLDEN_REQUEST.events[0],
          legs: [
            {
              ...GOLDEN_REQUEST.events[0].legs[0],
              amount: "12345678901234567890.123456789012345678",
            },
          ],
        },
      ],
    });
    expect(parsed.events[0]?.legs[0]?.amount).toBe("12345678901234567890.123456789012345678");
    expect(
      computeCostBasisRequestSchema.safeParse({
        ...GOLDEN_REQUEST,
        events: [
          {
            ...GOLDEN_REQUEST.events[0],
            legs: [{ ...GOLDEN_REQUEST.events[0].legs[0], amount: 1 }],
          },
        ],
      }).success,
    ).toBe(false);
    expect(accountingDecimalStringsEqual("1.00", "1e0")).toBe(true);
    expect(accountingDecimalSumEquals(["0.1", "2e-1"], "0.3")).toBe(true);
    expect(accountingDecimalSubtractEquals("100.01", "0.02", "99.99")).toBe(true);
  });

  it("enforces the bounded decimal envelope before arithmetic", () => {
    expect(
      computeCostBasisRequestSchema.safeParse({
        ...GOLDEN_REQUEST,
        events: [
          {
            ...GOLDEN_REQUEST.events[0],
            legs: [{ ...GOLDEN_REQUEST.events[0].legs[0], usd_value: "1e-100000000" }],
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("bounds lexical input and mirrors Nexus zero-product canonicalization", () => {
    expect(
      accountingDecimalProductFitsDerivedEnvelope([
        `0.${"0".repeat(256)}`,
        `0.${"0".repeat(35)}1`,
      ]),
    ).toBe(true);
    expect(
      computeCostBasisRequestSchema.safeParse({
        ...GOLDEN_REQUEST,
        events: [
          {
            ...GOLDEN_REQUEST.events[0],
            legs: [
              {
                ...GOLDEN_REQUEST.events[0].legs[0],
                amount: "1".repeat(MAX_ACCOUNTING_DECIMAL_STRING_LENGTH + 1),
              },
            ],
          },
        ],
      }).success,
    ).toBe(false);
  });
});

describe("PII-free input boundary", () => {
  it("recursively finds Nexus identity-key aliases", () => {
    expect(findAccountingIdentityKeys({ nested: [{ client_id: "x", walletAddress: "y" }] })).toEqual([
      "client_id",
      "walletAddress",
    ]);
  });

  it("fails before parsing on identity fields", () => {
    expect(() =>
      parseAccountingRequest("compute_cost_basis", { ...GOLDEN_REQUEST, client_id: "x" }),
    ).toThrow(AccountingIdentityKeyError);
  });

  it("rejects a raw wallet in every opaque account_ref", () => {
    expect(
      computeCostBasisRequestSchema.safeParse({
        ...GOLDEN_REQUEST,
        events: [
          {
            ...GOLDEN_REQUEST.events[0],
            account_ref: `0x${"a".repeat(40)}`,
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects unknown nested fields and contradictory price provenance", () => {
    const event = GOLDEN_REQUEST.events[0];
    expect(
      computeCostBasisRequestSchema.safeParse({
        ...GOLDEN_REQUEST,
        events: [{ ...event, legs: [{ ...event.legs[0], clientName: "x" }] }],
      }).success,
    ).toBe(false);
    expect(
      computeCostBasisRequestSchema.safeParse({
        ...GOLDEN_REQUEST,
        events: [{ ...event, legs: [{ ...event.legs[0], price_as_of: null }] }],
      }).success,
    ).toBe(false);
  });
});

describe("replay and response parity", () => {
  it("accepts a quiet bounded period but not an unbounded empty replay", () => {
    expect(
      computeCostBasisRequestSchema.safeParse({
        events: [],
        report_window: { start_at: 10, end_at: 20, full_history: true },
      }).success,
    ).toBe(true);
    expect(computeCostBasisRequestSchema.safeParse({ events: [] }).success).toBe(false);
  });

  it("requires exactly one valid opening-history assertion", () => {
    expect(
      reportWindowInputSchema.safeParse({ start_at: 10, end_at: 20, full_history: false }).success,
    ).toBe(false);
    expect(
      reportWindowInputSchema.safeParse({
        start_at: 10,
        end_at: 20,
        full_history: false,
        opening_state: {
          schema_version: "2.0.0",
          basis_method: "fifo",
          basis_method_version: "2.0.0",
          snapshot_complete: true,
          state_ref: "state-opaque",
          as_of: 9,
          source: "fixture",
          last_verified: "2026-07-16",
          lots: [],
        },
      }).success,
    ).toBe(true);
  });

  it("parses Nexus-derived v0.2.0 cost-basis and PnL fixtures", () => {
    const costRequest = parseAccountingRequest("compute_cost_basis", GOLDEN_REQUEST);
    const pnlRequest = parseAccountingRequest("onchain_pnl_report", GOLDEN_REQUEST);
    const cost = parseAccountingResponse("compute_cost_basis", GOLDEN_COST_BASIS_RESPONSE);
    const pnl = parseAccountingResponse("onchain_pnl_report", GOLDEN_PNL_RESPONSE);
    expect(cost.disposals[0]?.realized_gain_usd).toBe("20");
    expect(pnl.by_year[0]?.long_term_gain_usd).toBe("20");
    expect(assessAccountingResponseCorrelation("compute_cost_basis", costRequest, cost).status).toBe(
      "unverifiable",
    );
    expect(assessAccountingResponseCorrelation("onchain_pnl_report", pnlRequest, pnl).status).toBe(
      "unverifiable",
    );
    expect(isAccountingResponseCorrelationVerified("compute_cost_basis", costRequest, cost)).toBe(
      false,
    );
    expect(isAccountingResponseCorrelationVerified("onchain_pnl_report", pnlRequest, pnl)).toBe(
      false,
    );
    expect(isNexusAccountingResultEligibleForComposition(cost)).toBe(false);
    expect(isNexusAccountingResultEligibleForComposition(pnl)).toBe(false);
  });

  it("fails closed on a forged pending-review statement_ready flag", () => {
    expect(
      computeCostBasisResponseSchema.safeParse({
        ...GOLDEN_COST_BASIS_RESPONSE,
        completeness: { ...COMPLETENESS, statement_ready: true },
      }).success,
    ).toBe(false);
  });

  it("rejects negative proceeds and non-exact disposal arithmetic", () => {
    const invalidDisposals = [
      {
        ...DISPOSAL,
        gross_proceeds_usd: "1",
        fee_adjustment_usd: "2",
        proceeds_usd: "-1",
        realized_gain_usd: "-11",
      },
      { ...DISPOSAL, proceeds_usd: "29" },
      { ...DISPOSAL, realized_gain_usd: "19" },
    ];
    for (const disposal of invalidDisposals) {
      expect(
        computeCostBasisResponseSchema.safeParse({
          ...GOLDEN_COST_BASIS_RESPONSE,
          disposals: [disposal],
        }).success,
      ).toBe(false);
    }
  });

  it("allows engine composition eligibility only after explicit methodology approval", () => {
    const approved = computeCostBasisResponseSchema.parse({
      ...GOLDEN_COST_BASIS_RESPONSE,
      methodology: { ...METHODOLOGY, review_status: "approved" },
      completeness: { ...COMPLETENESS, statement_ready: true },
    });
    const approvedPnl = onchainPnlReportResponseSchema.parse({
      ...GOLDEN_PNL_RESPONSE,
      methodology: { ...METHODOLOGY, review_status: "approved" },
      completeness: { ...COMPLETENESS, statement_ready: true },
    });
    expect(isNexusAccountingResultEligibleForComposition(approved)).toBe(true);
    expect(isNexusAccountingResultEligibleForComposition(approvedPnl)).toBe(true);
  });

  it("rejects response extras, inconsistent gaps, and forged completeness", () => {
    expect(
      onchainPnlReportResponseSchema.safeParse({ ...GOLDEN_PNL_RESPONSE, client_id: "x" }).success,
    ).toBe(false);
    expect(
      computeCostBasisResponseSchema.safeParse({
        ...GOLDEN_COST_BASIS_RESPONSE,
        completeness: { ...COMPLETENESS, gap_count: 1 },
      }).success,
    ).toBe(false);

    const incompleteDisposal = {
      ...DISPOSAL,
      gross_proceeds_usd: null,
      proceeds_usd: null,
      realized_gain_usd: null,
      complete: false,
      missing_fields: ["proceeds_usd"],
    };
    const incompleteResponse = {
      ...GOLDEN_COST_BASIS_RESPONSE,
      disposals: [incompleteDisposal],
      coverage: {
        ...COVERAGE,
        complete_disposition_count: 0,
        incomplete_disposition_count: 1,
      },
      totals: { ...GOLDEN_COST_BASIS_RESPONSE.totals, realized_gain_usd: null },
      completeness: {
        complete: false,
        statement_ready: false,
        gap_count: 1,
        gaps: [
          {
            code: "unknown_disposition_proceeds",
            message: "Synthetic disposition proceeds are unknown.",
            event_id: "sell",
            account_ref: "account-opaque-1",
            asset_id: ASSET.asset_id,
          },
        ],
      },
    };
    const parsedIncomplete = computeCostBasisResponseSchema.parse(incompleteResponse);
    expect(isNexusAccountingResultEligibleForComposition(parsedIncomplete)).toBe(false);
    expect(
      computeCostBasisResponseSchema.safeParse({
        ...incompleteResponse,
        methodology: { ...METHODOLOGY, review_status: "approved" },
        completeness: {
          complete: true,
          statement_ready: true,
          gap_count: 0,
          gaps: [],
        },
      }).success,
    ).toBe(false);
  });

  it("rejects raw wallets in response refs and malformed constructed counters", () => {
    const rawWallet = `0x${"a".repeat(40)}`;
    const responseWithOpaqueGap = {
      ...GOLDEN_COST_BASIS_RESPONSE,
      completeness: {
        complete: false,
        statement_ready: false,
        gap_count: 1,
        gaps: [
          {
            code: "fixture_gap",
            message: "Synthetic incomplete fixture.",
            event_id: "sell",
            account_ref: "account-opaque-1",
            asset_id: ASSET.asset_id,
          },
        ],
      },
    };
    expect(computeCostBasisResponseSchema.safeParse(responseWithOpaqueGap).success).toBe(true);
    expect(
      computeCostBasisResponseSchema.safeParse({
        ...GOLDEN_COST_BASIS_RESPONSE,
        open_lots: [{ ...GOLDEN_COST_BASIS_RESPONSE.open_lots[0], account_ref: rawWallet }],
      }).success,
    ).toBe(false);
    expect(
      computeCostBasisResponseSchema.safeParse({
        ...GOLDEN_COST_BASIS_RESPONSE,
        disposals: [{ ...DISPOSAL, account_ref: rawWallet }],
      }).success,
    ).toBe(false);
    expect(
      computeCostBasisResponseSchema.safeParse({
        ...responseWithOpaqueGap,
        completeness: {
          ...responseWithOpaqueGap.completeness,
          gaps: [{ ...responseWithOpaqueGap.completeness.gaps[0], account_ref: rawWallet }],
        },
      }).success,
    ).toBe(false);

    const invalidResults = [
      {
        ...GOLDEN_COST_BASIS_RESPONSE,
        coverage: { ...COVERAGE, account_count: -1 },
      },
      {
        ...GOLDEN_COST_BASIS_RESPONSE,
        replay: { ...REPLAY, input_event_count: -1 },
      },
      {
        ...GOLDEN_COST_BASIS_RESPONSE,
        open_lots: [
          { ...GOLDEN_COST_BASIS_RESPONSE.open_lots[0], acquisition_leg_index: -1 },
        ],
      },
      {
        ...GOLDEN_COST_BASIS_RESPONSE,
        disposals: [{ ...DISPOSAL, holding_days: -1 }],
      },
      {
        ...GOLDEN_COST_BASIS_RESPONSE,
        open_lots: [
          {
            ...GOLDEN_COST_BASIS_RESPONSE.open_lots[0],
            basis_source: "x".repeat(129),
          },
        ],
      },
      {
        ...GOLDEN_COST_BASIS_RESPONSE,
        disposals: [{ ...DISPOSAL, disposition_ref: " ".repeat(257) }],
      },
      {
        ...GOLDEN_COST_BASIS_RESPONSE,
        warnings: ["   "],
      },
    ];
    for (const invalid of invalidResults) {
      expect(computeCostBasisResponseSchema.safeParse(invalid).success).toBe(false);
    }
  });

  it("rejects contradictory PnL aggregates, partitions, and counts", () => {
    expect(
      onchainPnlReportResponseSchema.safeParse({
        ...GOLDEN_PNL_RESPONSE,
        summary: { ...GOLDEN_PNL_RESPONSE.summary, realized_gain_usd: "21" },
      }).success,
    ).toBe(false);
    expect(
      onchainPnlReportResponseSchema.safeParse({
        ...GOLDEN_PNL_RESPONSE,
        by_year: [{ ...GOLDEN_PNL_RESPONSE.by_year[0], disposal_count: 2 }],
      }).success,
    ).toBe(false);
    expect(
      onchainPnlReportResponseSchema.safeParse({
        ...GOLDEN_PNL_RESPONSE,
        by_year: [{ ...GOLDEN_PNL_RESPONSE.by_year[0], year: 2022 }],
      }).success,
    ).toBe(false);
    expect(
      onchainPnlReportResponseSchema.safeParse({
        ...GOLDEN_PNL_RESPONSE,
        summary: { ...GOLDEN_PNL_RESPONSE.summary, disposal_count: -1 },
      }).success,
    ).toBe(false);
  });
});

describe("price and decoder correlation", () => {
  it("requires explicit nulls for an unpriced oracle gap", () => {
    expect(
      priceHistoryResponseSchema.safeParse({
        contractVersion: "0.2.0",
        disclaimer: "Not advice.",
        prices: [
          {
            coin: "ethereum:unknown",
            timestamp: 100,
            status: "unpriced",
            priceUsd: null,
            source: null,
            asOf: null,
            confidence: null,
            reason: "no oracle coverage",
          },
        ],
      }).success,
    ).toBe(true);
    expect(
      priceHistoryResponseSchema.safeParse({
        contractVersion: "0.2.0",
        disclaimer: "Not advice.",
        prices: [
          {
            coin: "ethereum:unknown",
            timestamp: 100,
            status: "unpriced",
            priceUsd: "0",
            source: null,
            asOf: null,
            confidence: null,
            reason: "no oracle coverage",
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("verifies authoritative price overrides only when value and provenance match", () => {
    const request = parseAccountingRequest("price_history", {
      queries: [{ coin: "ethereum:asset-1", timestamp: 100 }],
      overrides: [{ coin: "ethereum:asset-1", timestamp: 100, price_usd: "12.50" }],
    });
    const response = parseAccountingResponse("price_history", {
      contractVersion: "0.2.0",
      disclaimer: "Not advice.",
      prices: [
        {
          coin: "ethereum:asset-1",
          timestamp: 100,
          status: "priced",
          priceUsd: "12.5",
          source: "override",
          asOf: 100,
          confidence: null,
          reason: null,
        },
      ],
    });
    expect(assessAccountingResponseCorrelation("price_history", request, response).status).toBe(
      "verified",
    );
    expect(isAccountingResponseCorrelationVerified("price_history", request, response)).toBe(true);

    for (const prices of [
      [{ ...response.prices[0]!, priceUsd: "12.51" }],
      [{ ...response.prices[0]!, source: "oracle" }],
      [
        {
          coin: "ethereum:asset-1",
          timestamp: 100,
          status: "unpriced" as const,
          priceUsd: null,
          source: null,
          asOf: null,
          confidence: null,
          reason: "missing",
        },
      ],
    ]) {
      const candidate = priceHistoryResponseSchema.parse({ ...response, prices });
      expect(assessAccountingResponseCorrelation("price_history", request, candidate).status).toBe(
        "unverifiable",
      );
      expect(isAccountingResponseCorrelationVerified("price_history", request, candidate)).toBe(
        false,
      );
    }
  });

  it("correlates ordered decoder output to the exact normalized request", () => {
    const request = parseAccountingRequest("decode_onchain_events", {
      transactions: [
        {
          account_ref: "account-opaque-1",
          chain: "Ethereum",
          timestamp: 1_600_000_000,
          sequence: 0,
          tx_ref: "transaction-opaque-1",
          protocol_hint: "uniswap_v3",
          method: "swap",
          movements: [
            {
              asset: { asset_id: "ethereum:usdc", decimals: 6 },
              direction: "out",
              amount: "1000.00",
              usd_value: "1000.00",
              price_source: "fixture",
              price_as_of: 1_600_000_000,
            },
          ],
        },
      ],
    });
    const response = decodeOnchainEventsResponseSchema.parse({
      contractVersion: "0.2.0",
      disclaimer: "Not advice.",
      eventCountsByKind: { swap: 1 },
      events: [
        {
          event_id: "transaction-opaque-1",
          account_ref: "account-opaque-1",
          kind: "swap",
          timestamp: 1_600_000_000,
          sequence: 0,
          tx_ref: "transaction-opaque-1",
          legs: [
            {
              asset: {
                asset_id: "ethereum:usdc",
                symbol: null,
                chain: "ethereum",
                decimals: 6,
              },
              direction: "out",
              amount: "1000.00",
              unit_price_usd: null,
              usd_value: "1000.00",
              role: "principal",
              price_source: "fixture",
              price_as_of: 1_600_000_000,
            },
          ],
          fee_usd: null,
          fee_allocation: null,
          fee_payment: null,
          transfer_ref: null,
          transfer_treatment: null,
          tax_treatment: null,
        },
      ],
    });
    expect(assessAccountingResponseCorrelation("decode_onchain_events", request, response)).toMatchObject(
      {
        status: "partial",
        unverified: ["event classification for hinted transactions"],
      },
    );
    expect(isAccountingResponseCorrelationVerified("decode_onchain_events", request, response)).toBe(
      false,
    );
    expect(
      assessAccountingResponseCorrelation("decode_onchain_events", request, {
        ...response,
        events: [{ ...response.events[0]!, event_id: "wrong-transaction" }],
      }).status,
    ).toBe("unverifiable");
  });

  it("fully verifies a hintless deterministic decoder classification", () => {
    const request = parseAccountingRequest("decode_onchain_events", {
      transactions: [
        {
          account_ref: "account-opaque-1",
          chain: "Ethereum",
          timestamp: 1_600_000_000,
          tx_ref: "transaction-opaque-2",
          movements: [
            {
              asset: { asset_id: "ethereum:asset-1" },
              direction: "out",
              amount: "1",
            },
          ],
        },
      ],
    });
    const response = decodeOnchainEventsResponseSchema.parse({
      contractVersion: "0.2.0",
      disclaimer: "Not advice.",
      eventCountsByKind: { transfer_out: 1 },
      events: [
        {
          event_id: "transaction-opaque-2",
          account_ref: "account-opaque-1",
          kind: "transfer_out",
          timestamp: 1_600_000_000,
          sequence: null,
          tx_ref: "transaction-opaque-2",
          legs: [
            {
              asset: {
                asset_id: "ethereum:asset-1",
                symbol: null,
                chain: "ethereum",
                decimals: null,
              },
              direction: "out",
              amount: "1",
              unit_price_usd: null,
              usd_value: null,
              role: "principal",
              price_source: null,
              price_as_of: null,
            },
          ],
          fee_usd: null,
          fee_allocation: null,
          fee_payment: null,
          transfer_ref: "transaction-opaque-2",
          transfer_treatment: "unknown",
          tax_treatment: null,
        },
      ],
    });
    expect(assessAccountingResponseCorrelation("decode_onchain_events", request, response).status).toBe(
      "verified",
    );
    expect(isAccountingResponseCorrelationVerified("decode_onchain_events", request, response)).toBe(
      true,
    );

    const misclassified = decodeOnchainEventsResponseSchema.parse({
      ...response,
      eventCountsByKind: { other: 1 },
      events: [
        {
          ...response.events[0]!,
          kind: "other",
          transfer_ref: null,
          transfer_treatment: null,
        },
      ],
    });
    expect(
      assessAccountingResponseCorrelation("decode_onchain_events", request, misclassified).status,
    ).toBe("unverifiable");
  });
});

describe("JSON Schemas and tool declarations", () => {
  it("generates detached structural hints with input defaults left optional", () => {
    const schema = ACCOUNTING_MODEL_INPUT_SCHEMA_HINTS.compute_cost_basis;
    expect(schema.type).toBe("object");
    expect(schema.additionalProperties).toBe(false);
    expect((schema.properties as Record<string, unknown>).report_window).toBeDefined();
    expect(schema.required).toEqual(["events"]);
    expect(ACCOUNTING_MODEL_INPUT_SCHEMA_HINTS.price_history.required).toEqual(["queries"]);
    expect(ACCOUNTING_RESPONSE_STRUCTURE_SCHEMA_HINTS.compute_cost_basis.required).toContain(
      "completeness",
    );
    expect(schema.$id).toMatch(/^https:\/\/github\.com\/Protocol-Wealth\/pwos-core\//);
    expect(getAccountingJsonSchemaHints().modelInputs.compute_cost_basis).not.toBe(schema);
  });

  it("requires exact duplicate-free discovery while accepting any tool order", () => {
    const tools = [
      "compute_cost_basis",
      "decode_onchain_events",
      "describe",
      "onchain_pnl_report",
      "price_history",
    ];
    expect(
      accountingToolDiscoverySchema.parse({ contractVersion: "0.2.0", tools }).tools,
    ).toEqual(tools);
    expect(isAccountingGatewayCompatible({ contractVersion: "0.2.0", tools })).toBe(true);
    expect(
      isAccountingGatewayCompatible({
        contractVersion: "0.2.0",
        tools: ACCOUNTING_GATEWAY_TOOL_IDS,
      }),
    ).toBe(true);
    expect(
      isAccountingGatewayCompatible({ contractVersion: "0.2.0", tools: tools.slice(0, 4) }),
    ).toBe(false);
    expect(
      isAccountingGatewayCompatible({
        contractVersion: "0.2.0",
        tools: [...tools.slice(0, 4), "compute_cost_basis"],
      }),
    ).toBe(false);
    expect(isAccountingGatewayCompatible({ contractVersion: "0.1.0", tools })).toBe(false);
  });

  it("validates the exact describe version handshake", () => {
    const tools = [
      "compute_cost_basis",
      "decode_onchain_events",
      "describe",
      "onchain_pnl_report",
      "price_history",
    ];
    expect(
      describeAccountingResponseSchema.parse({
        contractVersion: "0.2.0",
        disclaimer: "Not advice.",
        engine: "onchain-accounting",
        status: "available",
        tools,
        plannedTools: ACCOUNTING_TOOL_IDS,
        eventLedgerSchema: { type: "object" },
        costBasisRequestSchema: { type: "object" },
        pnlReportRequestSchema: { type: "object" },
        methodology: {
          method: "fifo",
          methodVersion: "2.0.0",
          source: "nexus-core/docs/ONCHAIN-ACCOUNTING.md",
          lastVerified: "2026-07-16",
          reviewStatus: "pending_governance_review",
          eventTreatment: METHODOLOGY.event_treatment,
        },
      }).methodology.reviewStatus,
    ).toBe("pending_governance_review");
  });

  it("registers four advisor-only, read-only calculation declarations", () => {
    const registry = new ToolRegistry();
    registerAccountingTools(registry);
    expect(registry.list().map((tool) => tool.name)).toEqual(ACCOUNTING_TOOL_IDS);
    expect(ACCOUNTING_TOOL_DEFINITIONS.every((tool) => tool.tier === ToolTier.ADVISOR)).toBe(true);
    expect(
      ACCOUNTING_TOOL_DEFINITIONS.every(
        (tool) => tool.annotations?.readOnlyHint && tool.annotations?.idempotentHint,
      ),
    ).toBe(true);
  });
});

// Compile-time fixture: the public result type retains exact string decimals.
const _typedCostBasisFixture: ComputeCostBasisResponse = GOLDEN_COST_BASIS_RESPONSE;
void _typedCostBasisFixture;
