# @protocolwealthos/disclosure-card

## 0.2.0

### Minor Changes

- [#43](https://github.com/Protocol-Wealth/pwos-core/pull/43) [`4ae4ae1`](https://github.com/Protocol-Wealth/pwos-core/commit/4ae4ae1f43ed87d1263993ea605c9792eacb6ed8) Thanks [@rivendale](https://github.com/rivendale)! - Initial public npm release (0.1.0).

  `@protocolwealthos/disclosure-card` is a focused, standalone package shipping
  the machine-readable disclosure schema for AI-assisted advisory and research
  systems. The schema was previously developed under
  `@protocolwealthos/shared/disclosure`; it was promoted to its own package
  before first publish because the schema is the load-bearing
  candidate-standard artifact and earned its own surface (a fork-friendly
  import, a focused npm page, an unambiguous version stream).

  Ships:

  - `disclosureCardSchema` — Zod runtime validator.
  - `DISCLOSURE_CARD_JSON_SCHEMA` — hand-rolled Draft 2020-12 JSON Schema for
    callers without TypeScript / Zod (`ajv`, `jsonschema`, Pydantic, etc.).
  - `parseDisclosureCard` / `safeParseDisclosureCard` — typed validation entry
    points.
  - `assertNoVerifyMarkers` — pre-publish CI gate: refuses to let a card
    publish while any `regulatoryBasis[]` citation still carries a `" [VERIFY]"`
    suffix.
  - `EXAMPLE_DISCLOSURE_CARD` — synthetic example instance used in tests and
    as a starting template in the adopter-facing README.
  - Full `DisclosureCard` TypeScript type + every sub-block (`OperatorBlock`,
    `ModelBlock`, `DataRetentionBlock`, `HumanOversightBlock`, `PiiHandlingBlock`,
    `AuditTrailBlock`) and the small canonical enums (`HUMAN_OVERSIGHT_TIERS`,
    `PII_HANDLING_MODES`).

  API surface is intentionally `0.x` to signal a pre-1.0 contract — minor
  breaking changes are possible until `1.0.0`. Adopter-facing usage
  documentation ships in `packages/disclosure-card/README.md`.

  Apache 2.0; defensive-patent posture (USPTO [#64](https://github.com/Protocol-Wealth/pwos-core/issues/64)/034,215; OIN member).
