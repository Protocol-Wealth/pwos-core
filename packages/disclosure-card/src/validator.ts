// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Validation entrypoints for disclosure cards.
 *
 * Two flavors:
 *   - `parseDisclosureCard(input)`  — throws ZodError on invalid input
 *   - `safeParseDisclosureCard(input)` — returns `{ success, data | error }`
 *
 * Plus a small structural sanity check (`assertNoVerifyMarkers`) that lets
 * the caller fail the publish step if any `regulatoryBasis` entry still
 * carries the `[VERIFY]` suffix — useful as a CI gate before a card is
 * served publicly.
 */

import type { z } from "zod";

import type { DisclosureCard } from "./types.js";
import { disclosureCardSchema } from "./schema.js";

export function parseDisclosureCard(input: unknown): DisclosureCard {
  return disclosureCardSchema.parse(input);
}

export function safeParseDisclosureCard(
  input: unknown,
): z.SafeParseReturnType<unknown, DisclosureCard> {
  return disclosureCardSchema.safeParse(input);
}

/**
 * Throws if any `regulatoryBasis` entry still carries the `[VERIFY]` suffix.
 * Use this in a CI step before a disclosure card is published publicly.
 */
export function assertNoVerifyMarkers(card: DisclosureCard): void {
  const flagged = card.regulatoryBasis.filter((c) => c.includes("[VERIFY]"));
  if (flagged.length > 0) {
    throw new Error(
      `Disclosure card has ${flagged.length} regulatoryBasis entry/entries still marked [VERIFY]: ${flagged.join("; ")}`,
    );
  }
}
