// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * @protocolwealthos/shared
 *
 * Internal shared types + governance primitives.
 *
 * Three sub-paths are also exported as individual entrypoints:
 *   - `@protocolwealthos/shared/hitl`        — fail-closed HITL gate
 *   - `@protocolwealthos/shared/disclosure`  — disclosure-card schema + JSON Schema
 *   - `@protocolwealthos/shared/provenance`  — SHA-256 hash-chained provenance records
 *
 * The HITL + disclosure + provenance modules are SELF-CONTAINED reference
 * primitives: each can be imported without pulling the others, none depend
 * on any other `@protocolwealthos/*` package, none import private/production
 * code from elsewhere in the PW estate. Wiring them into a production audit
 * trail / UI / tool orchestrator is HANDOFF.md territory.
 */

export * from './types.js';
export * from './constants.js';
export * from './validators.js';

// Tier-2 governance primitives. Each is also available under its own subpath
// export (see package.json exports map) for callers who prefer a narrower
// import.
export * as hitl from './hitl/index.js';
export * as disclosure from './disclosure/index.js';
export * as provenance from './provenance/index.js';
