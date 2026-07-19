# @protocolwealthos/disclosure-card

## 0.3.2

### Patch Changes

- [#87](https://github.com/Protocol-Wealth/pwos-core/pull/87) [`dce504c`](https://github.com/Protocol-Wealth/pwos-core/commit/dce504c6801da7efb720fc5429170050b7acadde) Thanks [@rivendale](https://github.com/rivendale)! - Ship LICENSE and NOTICE in every published tarball, and guard the compiled publish shape.

  - Each package's `prepack` now copies the repository-root `LICENSE` and `NOTICE` into the package before packing, so every tarball carries the full Apache-2.0 license text and the NOTICE (Apache-2.0 §4(d) NOTICE propagation + the USPTO defensive-patent notice and third-party attributions). Previously `NOTICE` never reached npm and `LICENSE` shipped only via pnpm auto-hoisting.
  - Added `"LICENSE"` and `"NOTICE"` to the `files` array of the four packages that omitted them (`disclosure-card`, `onchain-accounting-contract`, `planning-contract`, `shared`) and resolved the dangling `files` references in the rest.
  - Added `pnpm lint:publish` (`scripts/check-publish-shape.mjs`), run in CI and as a publish preflight, which fails if any published `main`/`types`/`exports` entry would resolve to raw `./src/*.ts` instead of a compiled `./dist` artifact.

  No library source or runtime behavior changes.

## 0.3.1

### Patch Changes

- [#78](https://github.com/Protocol-Wealth/pwos-core/pull/78) [`0e3b777`](https://github.com/Protocol-Wealth/pwos-core/commit/0e3b777b918ed69b6d7ca7e36c4932b06428cb7c) Thanks [@lifrmn](https://github.com/lifrmn)! - Document the contract boundary for the primitives consumed by the private
  estate. Each README gains a "Contract Boundary" section clarifying that the
  package exposes a generic, adopter-facing public contract that must not depend
  on private-estate data, credentials, production endpoint URLs, firm-specific
  settings, or private-estate identifiers. Only reusable, non-private contract
  improvements land here; feedback is tracked in [#76](https://github.com/Protocol-Wealth/pwos-core/issues/76).

## 0.3.0

### Minor Changes

- [#51](https://github.com/Protocol-Wealth/pwos-core/pull/51) [`3a33729`](https://github.com/Protocol-Wealth/pwos-core/commit/3a3372933025af8a63a57ac31085f593b81fb74e) Thanks [@rivendale](https://github.com/rivendale)! - Support zod 4. Replace the removed `z.SafeParseReturnType` alias in
  `safeParseDisclosureCard` with the schema-derived return type
  (`ReturnType<typeof disclosureCardSchema.safeParse>`), so the package builds
  against its declared `zod ^4.4.3`. Runtime validation behavior is unchanged — the
  safeParse result shape (`{ success, data | error }`) is identical; only the
  compile-time type alias changed because zod itself removed it.

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
