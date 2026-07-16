// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { z } from "zod";

import { ACCOUNTING_CONTRACT_VERSION } from "./constants.js";
import { ACCOUNTING_REQUEST_SCHEMAS, ACCOUNTING_RESPONSE_SCHEMAS } from "./gateway.js";

type JsonSchemaObject = Record<string, unknown>;

function generateSchema(
  schema: z.ZodType,
  title: string,
  slug: string,
): JsonSchemaObject {
  const generated = z.toJSONSchema(schema) as JsonSchemaObject;
  return {
    ...generated,
    $id: `https://github.com/Protocol-Wealth/pwos-core/packages/onchain-accounting-contract/onchain-accounting-${slug}-${ACCOUNTING_CONTRACT_VERSION}.schema.json`,
    title,
  };
}

/** Draft 2020-12 request schemas generated from the runtime source of truth. */
export const ACCOUNTING_REQUEST_JSON_SCHEMAS = {
  price_history: generateSchema(
    ACCOUNTING_REQUEST_SCHEMAS.price_history,
    "PriceHistoryRequest",
    "price-history-request",
  ),
  decode_onchain_events: generateSchema(
    ACCOUNTING_REQUEST_SCHEMAS.decode_onchain_events,
    "DecodeOnchainEventsRequest",
    "decode-onchain-events-request",
  ),
  compute_cost_basis: generateSchema(
    ACCOUNTING_REQUEST_SCHEMAS.compute_cost_basis,
    "ComputeCostBasisRequest",
    "compute-cost-basis-request",
  ),
  onchain_pnl_report: generateSchema(
    ACCOUNTING_REQUEST_SCHEMAS.onchain_pnl_report,
    "OnchainPnlReportRequest",
    "onchain-pnl-report-request",
  ),
} as const;

/** Draft 2020-12 response schemas generated from the runtime source of truth. */
export const ACCOUNTING_RESPONSE_JSON_SCHEMAS = {
  price_history: generateSchema(
    ACCOUNTING_RESPONSE_SCHEMAS.price_history,
    "PriceHistoryResponse",
    "price-history-response",
  ),
  decode_onchain_events: generateSchema(
    ACCOUNTING_RESPONSE_SCHEMAS.decode_onchain_events,
    "DecodeOnchainEventsResponse",
    "decode-onchain-events-response",
  ),
  compute_cost_basis: generateSchema(
    ACCOUNTING_RESPONSE_SCHEMAS.compute_cost_basis,
    "ComputeCostBasisResponse",
    "compute-cost-basis-response",
  ),
  onchain_pnl_report: generateSchema(
    ACCOUNTING_RESPONSE_SCHEMAS.onchain_pnl_report,
    "OnchainPnlReportResponse",
    "onchain-pnl-report-response",
  ),
} as const;

/** Return detached JSON-serializable schema maps for serving or persistence. */
export function getAccountingJsonSchemas(): {
  requests: Record<string, JsonSchemaObject>;
  responses: Record<string, JsonSchemaObject>;
} {
  return JSON.parse(
    JSON.stringify({
      requests: ACCOUNTING_REQUEST_JSON_SCHEMAS,
      responses: ACCOUNTING_RESPONSE_JSON_SCHEMAS,
    }),
  ) as {
    requests: Record<string, JsonSchemaObject>;
    responses: Record<string, JsonSchemaObject>;
  };
}
