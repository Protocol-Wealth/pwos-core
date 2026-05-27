// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * @protocolwealthos/disclosure-card
 *
 * Disclosure-card primitives.
 *
 * A disclosure card is the machine-readable record an RIA (or any operator of
 * an AI-assisted system) publishes to document what the system is, what model
 * sits behind it, how data is handled, what human oversight applies, and
 * which regulatory rules the operator is operating under.
 *
 * Surfacing this card in a UI (e.g. PWOS Compliance Center, public /disclosures
 * route) is OUT OF SCOPE for this package — see HANDOFF.md at the repo root
 * for the wiring contract the private-estate consumer is expected to honor.
 */

export {
  auditTrailBlockSchema,
  dataRetentionBlockSchema,
  disclosureCardSchema,
  humanOversightBlockSchema,
  modelBlockSchema,
  operatorBlockSchema,
  piiHandlingBlockSchema,
} from "./schema.js";

export {
  assertNoVerifyMarkers,
  parseDisclosureCard,
  safeParseDisclosureCard,
} from "./validator.js";

export {
  DISCLOSURE_CARD_JSON_SCHEMA,
  getDisclosureCardJsonSchema,
} from "./jsonSchema.js";

export { EXAMPLE_DISCLOSURE_CARD } from "./example.js";

export type {
  AuditTrailBlock,
  DataRetentionBlock,
  DisclosureCard,
  HumanOversightBlock,
  HumanOversightTier,
  ModelBlock,
  OperatorBlock,
  PiiHandlingBlock,
  PiiHandlingMode,
} from "./types.js";

export { HUMAN_OVERSIGHT_TIERS, PII_HANDLING_MODES } from "./types.js";
