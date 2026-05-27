// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * @protocolwealthos/shared
 *
 * Internal shared types + two governance primitives.
 *
 * Two sub-paths are also exported as individual entrypoints:
 *   - `@protocolwealthos/shared/hitl`        — fail-closed HITL gate
 *   - `@protocolwealthos/shared/provenance`  — SHA-256 hash-chained provenance records
 *
 * The disclosure-card schema (formerly `@protocolwealthos/shared/disclosure`)
 * was promoted to its own focused package
 * (`@protocolwealthos/disclosure-card`) before first publish — the schema is
 * the flagship adoptable-standard artifact and earned its own surface.
 *
 * The HITL + provenance modules here are SELF-CONTAINED reference primitives:
 * each can be imported without pulling the other, neither depends on any
 * other `@protocolwealthos/*` package, neither imports private/production
 * code from elsewhere in the PW estate. Wiring them into a production audit
 * trail / tool orchestrator is HANDOFF.md territory.
 */

export * from './types.js';
export * from './constants.js';
export * from './validators.js';

export * as hitl from './hitl/index.js';
export * as provenance from './provenance/index.js';
