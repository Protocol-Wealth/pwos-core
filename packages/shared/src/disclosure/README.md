<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright 2026 Protocol Wealth, LLC and contributors. -->

# Disclosure card — adoption guide

> **What:** a machine-readable record that describes an AI-assisted system's
> model, data handling, human oversight, PII handling, audit-trail posture, and
> the regulatory rules its operator is operating under.
> **Why:** so an examiner, a client, or a downstream system can read the
> system's posture from a single canonical document rather than reverse-engineer
> it from marketing copy. Honest disclosure is the load-bearing artifact.
> **Status:** open standard *candidate*. Apache 2.0. Use it; fork it; help shape it.

This guide is for adopters — anyone running an AI-assisted advisory, research,
or compliance system who needs to publish a public disclosure card. It is
deliberately firm-agnostic; the only Protocol Wealth–specific values that
appear here are clearly marked as synthetic example placeholders.

---

## Install

```bash
pnpm add @protocolwealthos/shared zod
# or: npm install / yarn add — zod is a peer-grade runtime dep
```

Sub-path import (recommended):

```ts
import {
  type DisclosureCard,
  type HumanOversightTier,
  type PiiHandlingMode,
  parseDisclosureCard,
  safeParseDisclosureCard,
  assertNoVerifyMarkers,
  disclosureCardSchema,
  DISCLOSURE_CARD_JSON_SCHEMA,
  EXAMPLE_DISCLOSURE_CARD,
} from "@protocolwealthos/shared/disclosure";
```

The whole package also re-exports a `disclosure` namespace from the root:
`import { disclosure } from "@protocolwealthos/shared"` then
`disclosure.parseDisclosureCard(...)`.

---

## The shape

A disclosure card is a JSON object with twelve top-level fields. Required
shape (TypeScript notation, simplified):

```ts
interface DisclosureCard {
  systemName: string;
  version: string;
  operator: { firm: string; crd: string };
  generatedAt: string;        // ISO-8601 datetime
  model: { provider: string; name: string; version: string };
  inferenceJurisdiction: string;
  dataRetention: {
    inputRetentionDays: number;     // 0 = not retained
    outputRetentionDays: number;
    trainingUse: boolean;           // false under most ZDR-style contracts
  };
  humanOversight: {
    tier: "human_in_the_loop" | "human_on_the_loop" | "no_human_oversight";
    clientFacingRequiresApproval: boolean;
    scope: string;
  };
  piiHandling: {
    mode: "off" | "warn" | "block" | "redact";
    layerCount: number;
  };
  knownLimitations: string[];
  regulatoryBasis: string[];        // "SEC Rule 204-2", "Reg S-P §248.30", etc.
  auditTrail: {
    rule: "SEC 204-2";              // canonical RIA books-and-records rule
    tamperEvident: boolean;
  };
}
```

The Zod schema (`disclosureCardSchema`) enforces this shape at runtime. The
hand-rolled JSON Schema (`DISCLOSURE_CARD_JSON_SCHEMA`, Draft 2020-12)
mirrors it for callers that prefer a language-neutral validator.

### Field notes

- **`auditTrail.rule`** is hard-pinned to the string `"SEC 204-2"`. That is
  the books-and-records rule for SEC-registered investment advisers under
  the Advisers Act. It is *not* Rule 17a-4 (which is broker-dealer). Other
  RIA-relevant rules belong in `regulatoryBasis[]`, not here. If your
  operator is not an RIA (e.g. a CFTC-registered CPO, a broker-dealer, an
  EU-regulated firm), the canonical rule is different and this schema's
  `auditTrail.rule` field will need a future minor-version extension.
- **`humanOversight.tier`** is a small enum. The strictest tier
  (`human_in_the_loop`) describes a system where every client-facing
  deliverable is gated by an explicit human approval. `no_human_oversight`
  exists as an honest disclosure category for systems that genuinely operate
  unattended — do not publish that value unless your production wiring
  actually permits unattended client-facing actions.
- **`piiHandling.mode`** uses the same vocabulary as the sibling
  `@protocolwealthos/pii-guard` package. `redact` is the strongest mode that
  still permits the model to see processed data; `block` refuses to send.
- **`regulatoryBasis[]`** is a free-form citation array. Cite specific
  rules: `"SEC Rule 204-2 (books and records)"`,
  `"SEC Marketing Rule 206(4)-1"`, `"Reg S-P §248.30(b) (safeguards)"`.
  For any citation you cannot independently verify, suffix it with the
  literal string `" [VERIFY]"`. The CI gate
  (`assertNoVerifyMarkers`) refuses to let a card publish while any
  `[VERIFY]` marker remains.

---

## How to author a card

Start from the bundled synthetic example, then change every value:

```ts
import {
  EXAMPLE_DISCLOSURE_CARD,
  parseDisclosureCard,
  assertNoVerifyMarkers,
  type DisclosureCard,
} from "@protocolwealthos/shared/disclosure";

const myCard: DisclosureCard = {
  ...EXAMPLE_DISCLOSURE_CARD,
  systemName: "Acme Advisory Co-pilot",
  version: "2026.05.27",
  operator: { firm: "Acme Advisors, LLC", crd: "100000" }, // your real CRD
  generatedAt: new Date().toISOString(),
  model: {
    provider: "anthropic",
    name: "claude-sonnet-4-6",
    version: "claude-sonnet-4-6",
  },
  inferenceJurisdiction: "us_central",          // your inference region
  dataRetention: {
    inputRetentionDays: 0,                       // your contract
    outputRetentionDays: 0,
    trainingUse: false,
  },
  humanOversight: {
    tier: "human_in_the_loop",
    clientFacingRequiresApproval: true,
    scope: "All client-facing deliverables require explicit advisor approval.",
  },
  piiHandling: { mode: "redact", layerCount: 4 },
  knownLimitations: [
    // operator-supplied; CCO-reviewed; honest about what the system can't do
    "Output is informational; recommendations require advisor review.",
    "No tax advice.",
  ],
  regulatoryBasis: [
    "SEC Rule 204-2 (books and records)",
    "SEC Marketing Rule 206(4)-1",
    "Reg S-P §248.30 (safeguards)",
  ],
  auditTrail: { rule: "SEC 204-2", tamperEvident: true },
};

// Throw on shape violation (TypeScript types + runtime Zod):
parseDisclosureCard(myCard);

// Throw if any regulatoryBasis citation still carries [VERIFY] — CI gate:
assertNoVerifyMarkers(myCard);
```

---

## How to validate a card you received from somewhere else

Two flavors:

```ts
import {
  parseDisclosureCard,
  safeParseDisclosureCard,
} from "@protocolwealthos/shared/disclosure";

// 1. Throw on invalid input (good in a build step):
const card = parseDisclosureCard(maybeCard);

// 2. Return a result object (good when you want to render an error):
const result = safeParseDisclosureCard(maybeCard);
if (!result.success) {
  console.error("Disclosure card failed validation:", result.error.issues);
} else {
  doSomethingWith(result.data);
}
```

---

## Validating without TypeScript / Zod

The package also exports a hand-rolled JSON Schema (Draft 2020-12) so
adopters who don't want a TypeScript / Zod dependency can validate cards
with any JSON-Schema-compliant validator (`ajv`, `jsonschema`, Pydantic
in Python via a generated model, `gojsonschema`, etc.).

```ts
import { DISCLOSURE_CARD_JSON_SCHEMA } from "@protocolwealthos/shared/disclosure";

// JSON-serializable; safe to publish at a public URL alongside the card:
console.log(JSON.stringify(DISCLOSURE_CARD_JSON_SCHEMA, null, 2));
```

A typical adopter pattern:

1. Publish the card at e.g. `https://acme-advisors.com/disclosures/ai-copilot.json`.
2. Publish the schema at e.g. `https://acme-advisors.com/disclosures/ai-copilot.schema.json`,
   either by serving `DISCLOSURE_CARD_JSON_SCHEMA` directly or by copying it
   to a static asset.
3. Reference the schema from the card via the standard `"$schema"` field
   so any client that fetches the card knows where to validate it from.

---

## The `[VERIFY]` pre-publish gate

The `regulatoryBasis[]` array is the highest-risk field on the card: a
wrong citation is a stronger compliance failure than a missing one. The
schema cannot tell whether `"SEC Rule 999"` exists; only a human can. The
convention is:

- During drafting, suffix any citation you are not 100% sure of with
  `" [VERIFY]"`.
- Before publish, run `assertNoVerifyMarkers(card)`. It throws if any
  citation still carries the `[VERIFY]` suffix.
- Wire `assertNoVerifyMarkers` into your CI pipeline at the point where
  the card is built into the published artifact.

```ts
// In your publish step (a script, a CI job, a pre-deploy check):
import { assertNoVerifyMarkers } from "@protocolwealthos/shared/disclosure";
import { myCard } from "./card.js";

assertNoVerifyMarkers(myCard); // throws if any [VERIFY] remains; CI fails closed.
```

---

## What this package does NOT do

- **Auto-generate the values.** The card is operator-authored. Auto-filling
  the firm/CRD from a system-of-record is fine; auto-filling
  `knownLimitations[]` from a model's self-assessment is not — that's the
  CCO's call.
- **Enforce posture at runtime.** Setting
  `humanOversight.clientFacingRequiresApproval: true` in your card does not
  enforce a HITL gate at the tool layer. The sibling package
  `@protocolwealthos/shared/hitl` is the runtime enforcement primitive; the
  card is the *disclosure* of that posture. Don't publish a card whose
  claimed posture outruns your production wiring.
- **Provide regulatory advice.** Cite the rules you operate under; do not
  treat this schema as a substitute for your CCO's judgment on which rules
  apply or how.
- **Translate.** All field labels + canonical enum values are English. If
  you serve the card in a multi-lingual surface, render the labels in
  your UI layer; do not localize the schema's enum values.

---

## Versioning + back-compat policy

`@protocolwealthos/shared` is currently `0.x`. The disclosure-card schema
is the most stable surface in the package (the goal is candidate-standard
status), but during the `0.x` series breaking changes ARE possible. We
follow this discipline:

- **Adding an optional field** → minor bump.
- **Adding a required field** → minor bump until `1.0`, major bump after.
- **Renaming a field, removing a field, narrowing an enum** → minor bump
  until `1.0`, major bump after, with at least one deprecation cycle.
- **Hardening a constraint (e.g. tightening a regex)** → patch bump if
  every prior valid card still validates; otherwise minor.

The `version` field on a specific card is the operator's version of
their own card, not the schema version. The schema version lives in
`@protocolwealthos/shared`'s package.json. Adopters who want to pin both
should record the package version they validated against in their build
artifact alongside the card itself.

---

## Related

- [`@protocolwealthos/shared/hitl`](../hitl/README.md) — fail-closed
  HITL gate; the runtime enforcement primitive that `clientFacingRequiresApproval`
  describes.
- [`@protocolwealthos/shared/provenance`](../provenance/index.ts) —
  SHA-256 hash-chained provenance records; the runtime substrate for
  `auditTrail.tamperEvident: true`.
- [`@protocolwealthos/pii-guard`](https://github.com/Protocol-Wealth/pwos-core/tree/main/packages/pii-guard)
  — 4-layer PII redaction pipeline; the runtime substrate for
  `piiHandling.mode: "redact"`.

License: Apache 2.0. Defensive-patent posture (USPTO #64/034,215; OIN
member); the patent grant flows automatically under Apache 2.0.
