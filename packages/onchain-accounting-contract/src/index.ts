// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * @protocolwealthos/onchain-accounting-contract
 *
 * Strict TypeScript/runtime mirror of nexus-core accounting contract 0.2.0.
 * Math and methodology live in Nexus; this package carries only the public-safe,
 * de-identified ABI, schemas, tool declarations, and compatibility helpers.
 */

export const VERSION = "0.2.0";

export * from "./constants.js";
export * from "./decimal.js";
export * from "./identity.js";
export * from "./common.js";
export * from "./inputs.js";
export * from "./serializedLedger.js";
export * from "./outputs.js";
export * from "./gateway.js";
export * from "./jsonSchema.js";
export * from "./tools.js";
