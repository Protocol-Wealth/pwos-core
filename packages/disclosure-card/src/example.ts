// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Synthetic example disclosure card.
 *
 * Used as a reference instance in tests, in docs, and as a starting point for
 * adopters writing their own. Values are placeholders — DO NOT publish this
 * card as-is; fill in your firm's real operator details, model, jurisdiction,
 * retention, oversight, PII handling, limitations, and regulatory basis.
 */

import type { DisclosureCard } from "./types.js";

export const EXAMPLE_DISCLOSURE_CARD: DisclosureCard = {
  systemName: "PWOS Reference Surface",
  version: "0.1.0-example",
  operator: {
    firm: "Example Advisors, LLC",
    crd: "999999",
  },
  generatedAt: "2026-05-27T00:00:00Z",
  model: {
    provider: "anthropic",
    name: "claude-sonnet-4-6",
    version: "claude-sonnet-4-6",
  },
  inferenceJurisdiction: "us_central",
  dataRetention: {
    inputRetentionDays: 0,
    outputRetentionDays: 0,
    trainingUse: false,
  },
  humanOversight: {
    tier: "human_in_the_loop",
    clientFacingRequiresApproval: true,
    scope:
      "All client-facing deliverables (emails, reports, recommendations) require explicit advisor approval before being delivered. Internal research scratchpads do not require approval.",
  },
  piiHandling: {
    mode: "redact",
    layerCount: 4,
  },
  knownLimitations: [
    "The system does not provide tax advice.",
    "Output is informational only; investment recommendations require advisor review.",
    "Historical performance data is sourced from third parties; verify against custodial statements before client delivery.",
    "Forecasts and scenario analyses are model-driven; actual outcomes may differ materially.",
  ],
  regulatoryBasis: [
    "SEC Rule 204-2 (books and records)",
    "SEC Marketing Rule 206(4)-1 [VERIFY]",
    "Reg S-P §248.30 (safeguards)",
  ],
  auditTrail: {
    rule: "SEC 204-2",
    tamperEvident: true,
  },
};
