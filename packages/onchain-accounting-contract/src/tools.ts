// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import {
  ToolTier,
  type ObjectSchema,
  type ToolDefinition,
  type ToolRegistry,
} from "@protocolwealthos/mcp-tools";

import { ACCOUNTING_MODEL_INPUT_SCHEMA_HINTS } from "./jsonSchema.js";

const ACCOUNTING_TAGS = ["financial", "accounting", "onchain", "read"] as const;

function asObjectSchema(schema: Record<string, unknown>): ObjectSchema {
  if (schema.type !== "object" || typeof schema.properties !== "object") {
    throw new Error("accounting tool input schema must be an object schema");
  }
  return schema as ObjectSchema;
}

/** `price_history` declaration; production resolution may call external oracles. */
export const PRICE_HISTORY_TOOL: ToolDefinition = {
  name: "price_history",
  description:
    "Resolve historical USD prices for de-identified public asset identifiers and unix timestamps. Returns explicit unpriced gaps rather than fabricated zero values. Read-only and PII-free; caller overrides require the same coin/timestamp pair.",
  tier: ToolTier.ADVISOR,
  tags: [...ACCOUNTING_TAGS, "pricing"],
  annotations: {
    title: "Historical onchain prices",
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: true,
  },
  input_schema: asObjectSchema(ACCOUNTING_MODEL_INPUT_SCHEMA_HINTS.price_history),
};

/** `decode_onchain_events` declaration. */
export const DECODE_ONCHAIN_EVENTS_TOOL: ToolDefinition = {
  name: "decode_onchain_events",
  description:
    "Normalize de-identified public-chain asset movements into the versioned accounting event ledger. Uses opaque account and transaction references only; no client identity or wallet-to-client linkage is accepted.",
  tier: ToolTier.ADVISOR,
  tags: [...ACCOUNTING_TAGS, "decoder"],
  annotations: {
    title: "Decode onchain accounting events",
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: false,
  },
  input_schema: asObjectSchema(ACCOUNTING_MODEL_INPUT_SCHEMA_HINTS.decode_onchain_events),
};

/** `compute_cost_basis` declaration. */
export const COMPUTE_COST_BASIS_TOOL: ToolDefinition = {
  name: "compute_cost_basis",
  description:
    "Compute account-scoped FIFO lots, dispositions, realized/unrealized PnL, replay lineage, coverage, and structured completeness over a de-identified priced event ledger. Unknown basis or price remains null, never zero.",
  tier: ToolTier.ADVISOR,
  tags: [...ACCOUNTING_TAGS, "fifo", "cost-basis"],
  annotations: {
    title: "Compute onchain FIFO cost basis",
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: false,
  },
  input_schema: asObjectSchema(ACCOUNTING_MODEL_INPUT_SCHEMA_HINTS.compute_cost_basis),
};

/** `onchain_pnl_report` declaration. */
export const ONCHAIN_PNL_REPORT_TOOL: ToolDefinition = {
  name: "onchain_pnl_report",
  description:
    "Aggregate account-scoped FIFO dispositions into realized-PnL and tax-year summaries with replay, lineage, coverage, completeness, methodology provenance, and a tax-awareness disclaimer. Not tax advice or a tax return.",
  tier: ToolTier.ADVISOR,
  tags: [...ACCOUNTING_TAGS, "fifo", "pnl"],
  annotations: {
    title: "Onchain realized-PnL report",
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: false,
  },
  input_schema: asObjectSchema(ACCOUNTING_MODEL_INPUT_SCHEMA_HINTS.onchain_pnl_report),
};

/** Calculation-tool declarations in the gateway's canonical order. */
export const ACCOUNTING_TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  PRICE_HISTORY_TOOL,
  DECODE_ONCHAIN_EVENTS_TOOL,
  COMPUTE_COST_BASIS_TOOL,
  ONCHAIN_PNL_REPORT_TOOL,
];

/** Register the read-only accounting calculations on an existing registry. */
export function registerAccountingTools(registry: ToolRegistry): void {
  registry.registerAll(ACCOUNTING_TOOL_DEFINITIONS);
}
