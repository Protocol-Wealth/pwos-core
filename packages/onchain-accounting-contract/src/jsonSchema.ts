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
  io: "input" | "output",
): JsonSchemaObject {
  const generated = z.toJSONSchema(schema, { io }) as JsonSchemaObject;
  return {
    ...generated,
    $id: `https://github.com/Protocol-Wealth/pwos-core/packages/onchain-accounting-contract/onchain-accounting-${slug}-${ACCOUNTING_CONTRACT_VERSION}.schema.json`,
    title,
  };
}

/**
 * Draft 2020-12 model-input hints generated from the runtime schemas.
 *
 * These describe structural input shape and intentionally omit Zod-only
 * refinements. Consumers must still call `parseAccountingRequest` before use.
 */
export const ACCOUNTING_MODEL_INPUT_SCHEMA_HINTS = {
  price_history: generateSchema(
    ACCOUNTING_REQUEST_SCHEMAS.price_history,
    "PriceHistoryRequest",
    "price-history-request",
    "input",
  ),
  decode_onchain_events: generateSchema(
    ACCOUNTING_REQUEST_SCHEMAS.decode_onchain_events,
    "DecodeOnchainEventsRequest",
    "decode-onchain-events-request",
    "input",
  ),
  compute_cost_basis: generateSchema(
    ACCOUNTING_REQUEST_SCHEMAS.compute_cost_basis,
    "ComputeCostBasisRequest",
    "compute-cost-basis-request",
    "input",
  ),
  onchain_pnl_report: generateSchema(
    ACCOUNTING_REQUEST_SCHEMAS.onchain_pnl_report,
    "OnchainPnlReportRequest",
    "onchain-pnl-report-request",
    "input",
  ),
} as const;

/**
 * Draft 2020-12 response-structure hints generated from the runtime schemas.
 *
 * These are useful for discovery and documentation, but strict runtime parsing
 * remains authoritative for refinements and accounting invariants.
 */
export const ACCOUNTING_RESPONSE_STRUCTURE_SCHEMA_HINTS = {
  price_history: generateSchema(
    ACCOUNTING_RESPONSE_SCHEMAS.price_history,
    "PriceHistoryResponse",
    "price-history-response",
    "output",
  ),
  decode_onchain_events: generateSchema(
    ACCOUNTING_RESPONSE_SCHEMAS.decode_onchain_events,
    "DecodeOnchainEventsResponse",
    "decode-onchain-events-response",
    "output",
  ),
  compute_cost_basis: generateSchema(
    ACCOUNTING_RESPONSE_SCHEMAS.compute_cost_basis,
    "ComputeCostBasisResponse",
    "compute-cost-basis-response",
    "output",
  ),
  onchain_pnl_report: generateSchema(
    ACCOUNTING_RESPONSE_SCHEMAS.onchain_pnl_report,
    "OnchainPnlReportResponse",
    "onchain-pnl-report-response",
    "output",
  ),
} as const;

/** Return detached structural hints for model input and response discovery. */
export function getAccountingJsonSchemaHints(): {
  modelInputs: Record<string, JsonSchemaObject>;
  responseStructures: Record<string, JsonSchemaObject>;
} {
  return JSON.parse(
    JSON.stringify({
      modelInputs: ACCOUNTING_MODEL_INPUT_SCHEMA_HINTS,
      responseStructures: ACCOUNTING_RESPONSE_STRUCTURE_SCHEMA_HINTS,
    }),
  ) as {
    modelInputs: Record<string, JsonSchemaObject>;
    responseStructures: Record<string, JsonSchemaObject>;
  };
}
