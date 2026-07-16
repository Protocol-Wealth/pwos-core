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

type LedgerCalculationRequest = ComputeCostBasisRequest | OnchainPnlReportRequest;
type LedgerCalculationResponse = ComputeCostBasisResponse | OnchainPnlReportResponse;

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

/** Verify gateway-echoed coordinates against the ordered request. */
export function isAccountingResponseCorrelated<T extends AccountingToolId>(
  toolId: T,
  request: AccountingRequestMap[T],
  response: AccountingResponseMap[T],
): boolean {
  if (toolId === "price_history") {
    const priceRequest = request as PriceHistoryRequest;
    const priceResponse = response as PriceHistoryResponse;
    if (priceResponse.prices.length !== priceRequest.queries.length) return false;
    return priceResponse.prices.every((price, index) => {
      const query = priceRequest.queries[index];
      return query !== undefined && price.coin === query.coin && price.timestamp === query.timestamp;
    });
  }

  if (toolId === "decode_onchain_events") {
    const decodeRequest = request as DecodeOnchainEventsRequest;
    const decodeResponse = response as DecodeOnchainEventsResponse;
    if (decodeResponse.events.length !== decodeRequest.transactions.length) return false;

    const expectedCounts: Partial<Record<string, number>> = {};
    for (let index = 0; index < decodeResponse.events.length; index += 1) {
      const event = decodeResponse.events[index];
      const transaction = decodeRequest.transactions[index];
      if (!event || !transaction) return false;
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
        return false;
      }
      const isTransfer = event.kind === "transfer_in" || event.kind === "transfer_out";
      if (
        event.transfer_ref !== (isTransfer ? (transaction.transfer_ref ?? event.event_id) : null) ||
        event.transfer_treatment !==
          (isTransfer ? (transaction.transfer_treatment ?? "unknown") : null)
      ) {
        return false;
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
          return false;
        }
      }
      expectedCounts[event.kind] = (expectedCounts[event.kind] ?? 0) + 1;
    }

    const actual = decodeResponse.eventCountsByKind;
    const expectedKinds = Object.keys(expectedCounts);
    return (
      Object.keys(actual).length === expectedKinds.length &&
      expectedKinds.every((kind) => actual[kind as keyof typeof actual] === expectedCounts[kind])
    );
  }

  if (toolId === "compute_cost_basis" || toolId === "onchain_pnl_report") {
    return isLedgerCalculationResponseCorrelated(
      request as LedgerCalculationRequest,
      response as LedgerCalculationResponse,
    );
  }

  return true;
}

function isLedgerCalculationResponseCorrelated(
  request: LedgerCalculationRequest,
  response: LedgerCalculationResponse,
): boolean {
  if (response.method !== request.method) return false;
  const replay = response.replay;
  if (replay.input_event_count !== request.events.length) return false;

  const window = request.report_window;
  if (window == null) {
    return (
      replay.mode === "all_events" &&
      replay.start_at === null &&
      replay.end_at === null &&
      replay.opening_state_ref === null &&
      replay.opening_state_schema_version === null &&
      replay.opening_state_source === null &&
      replay.opening_state_last_verified === null &&
      replay.opening_state_basis_method === null &&
      replay.opening_state_basis_method_version === null &&
      replay.opening_state_snapshot_complete === null &&
      replay.replayed_event_count === request.events.length &&
      replay.pre_period_event_count === 0 &&
      replay.in_period_event_count === request.events.length &&
      replay.post_period_excluded_count === 0
    );
  }

  const replayed = request.events.filter((event) => event.timestamp < window.end_at);
  const prePeriod = replayed.filter((event) => event.timestamp < window.start_at).length;
  const opening = window.opening_state;
  return (
    replay.mode === (window.full_history ? "full_history" : "opening_state") &&
    replay.start_at === window.start_at &&
    replay.end_at === window.end_at &&
    replay.opening_state_ref === (opening?.state_ref ?? null) &&
    replay.opening_state_schema_version === (opening?.schema_version ?? null) &&
    replay.opening_state_source === (opening?.source ?? null) &&
    replay.opening_state_last_verified === (opening?.last_verified ?? null) &&
    replay.opening_state_basis_method === (opening?.basis_method ?? null) &&
    replay.opening_state_basis_method_version === (opening?.basis_method_version ?? null) &&
    replay.opening_state_snapshot_complete === (opening?.snapshot_complete ?? null) &&
    replay.replayed_event_count === replayed.length &&
    replay.pre_period_event_count === prePeriod &&
    replay.in_period_event_count === replayed.length - prePeriod &&
    replay.post_period_excluded_count === request.events.length - replayed.length
  );
}

/** True only when Nexus itself reports calculation, replay, and governance ready. */
export function isAccountingStatementReady(
  response: ComputeCostBasisResponse | OnchainPnlReportResponse,
): boolean {
  return (
    response.methodology.review_status === "approved" &&
    response.replay.mode !== "all_events" &&
    response.completeness.complete &&
    response.completeness.statement_ready
  );
}
