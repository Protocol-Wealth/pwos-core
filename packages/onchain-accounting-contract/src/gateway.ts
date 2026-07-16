// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import type { z } from "zod";

import type { AccountingToolId } from "./constants.js";
import { accountingDecimalStringsEqual } from "./decimal.js";
import { assertAccountingPayloadPiiFree } from "./identity.js";
import {
  computeCostBasisRequestSchema,
  decodeOnchainEventsRequestSchema,
  onchainPnlReportRequestSchema,
  priceHistoryRequestSchema,
  type ComputeCostBasisRequest,
  type DecodeOnchainEventsRequest,
  type OnchainPnlReportRequest,
  type PriceHistoryRequest,
} from "./inputs.js";
import {
  computeCostBasisResponseSchema,
  decodeOnchainEventsResponseSchema,
  onchainPnlReportResponseSchema,
  priceHistoryResponseSchema,
  type ComputeCostBasisResponse,
  type DecodeOnchainEventsResponse,
  type OnchainPnlReportResponse,
  type PriceHistoryResponse,
} from "./outputs.js";

export interface AccountingRequestMap {
  price_history: PriceHistoryRequest;
  decode_onchain_events: DecodeOnchainEventsRequest;
  compute_cost_basis: ComputeCostBasisRequest;
  onchain_pnl_report: OnchainPnlReportRequest;
}

export interface AccountingResponseMap {
  price_history: PriceHistoryResponse;
  decode_onchain_events: DecodeOnchainEventsResponse;
  compute_cost_basis: ComputeCostBasisResponse;
  onchain_pnl_report: OnchainPnlReportResponse;
}

export const ACCOUNTING_REQUEST_SCHEMAS = {
  price_history: priceHistoryRequestSchema,
  decode_onchain_events: decodeOnchainEventsRequestSchema,
  compute_cost_basis: computeCostBasisRequestSchema,
  onchain_pnl_report: onchainPnlReportRequestSchema,
} as const;

export const ACCOUNTING_RESPONSE_SCHEMAS = {
  price_history: priceHistoryResponseSchema,
  decode_onchain_events: decodeOnchainEventsResponseSchema,
  compute_cost_basis: computeCostBasisResponseSchema,
  onchain_pnl_report: onchainPnlReportResponseSchema,
} as const;

/** Scan for identity keys, then parse and normalize one gateway request. */
export function parseAccountingRequest<T extends AccountingToolId>(
  toolId: T,
  value: unknown,
): AccountingRequestMap[T] {
  assertAccountingPayloadPiiFree(value);
  const schema = ACCOUNTING_REQUEST_SCHEMAS[toolId] as unknown as z.ZodType<
    AccountingRequestMap[T]
  >;
  return schema.parse(value);
}

/** Strictly parse a successful versioned gateway response. */
export function parseAccountingResponse<T extends AccountingToolId>(
  toolId: T,
  value: unknown,
): AccountingResponseMap[T] {
  const schema = ACCOUNTING_RESPONSE_SCHEMAS[toolId] as unknown as z.ZodType<
    AccountingResponseMap[T]
  >;
  return schema.parse(value);
}

function optionalDecimalsEqual(left: string | null, right: string | null | undefined): boolean {
  if (left === null || right == null) return left === null && right == null;
  return accountingDecimalStringsEqual(left, right);
}

export type AccountingCorrelationAssessment =
  | {
      status: "verified";
      toolId: AccountingToolId;
      reason: string;
    }
  | {
      status: "partial";
      toolId: AccountingToolId;
      reason: string;
      unverified: readonly string[];
    }
  | {
      status: "unverifiable";
      toolId: AccountingToolId;
      reason: string;
    };

function verified(toolId: AccountingToolId, reason: string): AccountingCorrelationAssessment {
  return { status: "verified", toolId, reason };
}

function partial(
  toolId: AccountingToolId,
  reason: string,
  unverified: readonly string[],
): AccountingCorrelationAssessment {
  return { status: "partial", toolId, reason, unverified };
}

function unverifiable(toolId: AccountingToolId, reason: string): AccountingCorrelationAssessment {
  return { status: "unverifiable", toolId, reason };
}

function priceCoordinate(coin: string, timestamp: number): string {
  return JSON.stringify([coin, timestamp]);
}

function assessPriceCorrelation(
  request: PriceHistoryRequest,
  response: PriceHistoryResponse,
): AccountingCorrelationAssessment {
  if (response.prices.length !== request.queries.length) {
    return unverifiable("price_history", "response length does not match ordered price queries");
  }

  const queryCoordinates = new Set(
    request.queries.map((query) => priceCoordinate(query.coin, query.timestamp)),
  );
  const overrides = new Map<string, string>();
  for (const override of request.overrides) {
    const coordinate = priceCoordinate(override.coin, override.timestamp);
    if (!queryCoordinates.has(coordinate)) {
      return unverifiable("price_history", "price override does not match a requested coordinate");
    }
    if (overrides.has(coordinate)) {
      return unverifiable("price_history", "duplicate price override coordinate is ambiguous");
    }
    overrides.set(coordinate, override.price_usd);
  }
  for (let index = 0; index < response.prices.length; index += 1) {
    const price = response.prices[index];
    const query = request.queries[index];
    if (!price || !query || price.coin !== query.coin || price.timestamp !== query.timestamp) {
      return unverifiable("price_history", `price coordinate mismatch at ordered index ${index}`);
    }
    const override = overrides.get(priceCoordinate(query.coin, query.timestamp));
    if (
      override !== undefined &&
      (price.status !== "priced" ||
        !accountingDecimalStringsEqual(price.priceUsd, override) ||
        price.source !== "override" ||
        price.asOf !== query.timestamp ||
        price.confidence !== null ||
        price.reason !== null)
    ) {
      return unverifiable(
        "price_history",
        `authoritative override was not preserved at ordered index ${index}`,
      );
    }
  }
  return verified(
    "price_history",
    "ordered coordinates and every authoritative override match the response",
  );
}

type DecoderTransaction = DecodeOnchainEventsRequest["transactions"][number];

function hintlessEventKind(transaction: DecoderTransaction): DecodeOnchainEventsResponse["events"][number]["kind"] {
  const principal = transaction.movements.filter((movement) => movement.role === "principal");
  if (principal.length === 0) return "fee";
  const hasIn = principal.some((movement) => movement.direction === "in");
  const hasOut = principal.some((movement) => movement.direction === "out");
  if (hasIn && hasOut) return "other";
  if (hasIn) return "transfer_in";
  if (hasOut) return "transfer_out";
  return "other";
}

function assessDecoderCorrelation(
  request: DecodeOnchainEventsRequest,
  response: DecodeOnchainEventsResponse,
): AccountingCorrelationAssessment {
  if (response.events.length !== request.transactions.length) {
    return unverifiable("decode_onchain_events", "response length does not match transactions");
  }

  const unverifiedInputs = new Set<string>();
  const expectedCounts: Partial<Record<string, number>> = {};
  for (let index = 0; index < response.events.length; index += 1) {
    const event = response.events[index];
    const transaction = request.transactions[index];
    if (!event || !transaction) {
      return unverifiable("decode_onchain_events", `missing ordered item at index ${index}`);
    }
    const sequenceSuffix = transaction.sequence == null ? "" : `:${transaction.sequence}`;
    const expectedEventId =
      transaction.tx_ref ??
      `${transaction.chain}:${transaction.account_ref}:${transaction.timestamp}${sequenceSuffix}`;
    if (
      event.event_id !== expectedEventId ||
      event.account_ref !== transaction.account_ref ||
      event.timestamp !== transaction.timestamp ||
      event.sequence !== (transaction.sequence ?? null) ||
      event.tx_ref !== (transaction.tx_ref ?? null) ||
      !optionalDecimalsEqual(event.fee_usd, transaction.fee_usd) ||
      event.fee_allocation !== (transaction.fee_allocation ?? null) ||
      event.fee_payment !== (transaction.fee_payment ?? null) ||
      event.tax_treatment !== (transaction.tax_treatment ?? null) ||
      event.legs.length !== transaction.movements.length
    ) {
      return unverifiable("decode_onchain_events", `echoed decoder fields mismatch at index ${index}`);
    }

    const hasHints = transaction.protocol_hint != null || transaction.method != null;
    if (hasHints) unverifiedInputs.add("event classification for hinted transactions");
    if (transaction.movements.some((movement) => movement.counterparty != null)) {
      unverifiedInputs.add("movement counterparties");
    }
    if (!hasHints && event.kind !== hintlessEventKind(transaction)) {
      return unverifiable(
        "decode_onchain_events",
        `hintless deterministic classification mismatch at index ${index}`,
      );
    }
    const isTransfer = event.kind === "transfer_in" || event.kind === "transfer_out";
    if (
      !isTransfer &&
      (transaction.transfer_ref != null || transaction.transfer_treatment != null)
    ) {
      unverifiedInputs.add("transfer metadata for non-transfer classifications");
    }
    if (
      event.transfer_ref !== (isTransfer ? (transaction.transfer_ref ?? event.event_id) : null) ||
      event.transfer_treatment !==
        (isTransfer ? (transaction.transfer_treatment ?? "unknown") : null)
    ) {
      return unverifiable("decode_onchain_events", `transfer metadata mismatch at index ${index}`);
    }

    for (let legIndex = 0; legIndex < event.legs.length; legIndex += 1) {
      const leg = event.legs[legIndex];
      const movement = transaction.movements[legIndex];
      if (
        !leg ||
        !movement ||
        leg.asset.asset_id !== movement.asset.asset_id ||
        leg.asset.symbol !== (movement.asset.symbol ?? null) ||
        leg.asset.chain !== (movement.asset.chain ?? transaction.chain) ||
        leg.asset.decimals !== (movement.asset.decimals ?? null) ||
        leg.direction !== movement.direction ||
        leg.role !== movement.role ||
        !accountingDecimalStringsEqual(leg.amount, movement.amount) ||
        !optionalDecimalsEqual(leg.unit_price_usd, movement.unit_price_usd) ||
        !optionalDecimalsEqual(leg.usd_value, movement.usd_value) ||
        leg.price_source !== (movement.price_source ?? null) ||
        leg.price_as_of !== (movement.price_as_of ?? null)
      ) {
        return unverifiable(
          "decode_onchain_events",
          `echoed decoder leg mismatch at transaction ${index}, leg ${legIndex}`,
        );
      }
    }
    expectedCounts[event.kind] = (expectedCounts[event.kind] ?? 0) + 1;
  }

  const actual = response.eventCountsByKind;
  const expectedKinds = Object.keys(expectedCounts);
  if (
    Object.keys(actual).length !== expectedKinds.length ||
    !expectedKinds.every((kind) => actual[kind as keyof typeof actual] === expectedCounts[kind])
  ) {
    return unverifiable("decode_onchain_events", "eventCountsByKind does not match events");
  }
  if (unverifiedInputs.size > 0) {
    return partial(
      "decode_onchain_events",
      "echoed fields match, but some request fields are not echoed by wire 0.2.0",
      [...unverifiedInputs],
    );
  }
  return verified(
    "decode_onchain_events",
    "all echoed fields and hintless deterministic classifications match",
  );
}

/**
 * Assess response binding without overstating what wire contract 0.2.0 echoes.
 * Calculation responses are always unverifiable until a request digest is added.
 */
export function assessAccountingResponseCorrelation<T extends AccountingToolId>(
  toolId: T,
  request: AccountingRequestMap[T],
  response: AccountingResponseMap[T],
): AccountingCorrelationAssessment {
  if (toolId === "price_history") {
    return assessPriceCorrelation(request as PriceHistoryRequest, response as PriceHistoryResponse);
  }
  if (toolId === "decode_onchain_events") {
    return assessDecoderCorrelation(
      request as DecodeOnchainEventsRequest,
      response as DecodeOnchainEventsResponse,
    );
  }
  if (toolId === "compute_cost_basis" || toolId === "onchain_pnl_report") {
    return unverifiable(
      toolId,
      "wire contract 0.2.0 does not echo a canonical request digest for calculation results",
    );
  }
  return unverifiable(toolId, "unsupported accounting tool correlation assessment");
}

/** Fail-closed convenience boolean: true only for a fully verified assessment. */
export function isAccountingResponseCorrelationVerified<T extends AccountingToolId>(
  toolId: T,
  request: AccountingRequestMap[T],
  response: AccountingResponseMap[T],
): boolean {
  return assessAccountingResponseCorrelation(toolId, request, response).status === "verified";
}

/**
 * Engine-scoped calculation eligibility for private composition. This is never
 * client-delivery, authorization, books-and-records, or advisor approval state.
 */
export function isNexusAccountingResultEligibleForComposition(
  response: ComputeCostBasisResponse | OnchainPnlReportResponse,
): boolean {
  const parsed =
    "summary" in response
      ? onchainPnlReportResponseSchema.safeParse(response)
      : computeCostBasisResponseSchema.safeParse(response);
  if (!parsed.success) return false;
  const result = parsed.data;
  const dispositions = "summary" in result ? result.dispositions : result.disposals;
  const baseEligible =
    result.methodology.review_status === "approved" &&
    result.replay.mode !== "all_events" &&
    result.completeness.complete &&
    result.completeness.statement_ready &&
    result.completeness.gap_count === 0 &&
    result.coverage.incomplete_disposition_count === 0 &&
    result.coverage.unresolved_event_count === 0 &&
    result.coverage.unresolved_transfer_count === 0 &&
    result.coverage.unresolved_fee_count === 0 &&
    dispositions.every(
      (disposition) => disposition.complete && disposition.missing_fields.length === 0,
    );
  if (!baseEligible) return false;
  if ("summary" in result) {
    return (
      result.summary.complete &&
      result.summary.incomplete_count === 0 &&
      result.summary.calculation_gap_count === 0 &&
      result.by_year.every(
        (bucket) =>
          bucket.complete && bucket.incomplete_count === 0 && bucket.calculation_gap_count === 0,
      )
    );
  }
  return (
    result.coverage.unknown_basis_open_lot_count === 0 &&
    result.open_lots.every((lot) => lot.cost_basis_usd !== null)
  );
}
