# @protocolwealthos/shared

## 0.2.2

### Patch Changes

- [#87](https://github.com/Protocol-Wealth/pwos-core/pull/87) [`dce504c`](https://github.com/Protocol-Wealth/pwos-core/commit/dce504c6801da7efb720fc5429170050b7acadde) Thanks [@rivendale](https://github.com/rivendale)! - Ship LICENSE and NOTICE in every published tarball, and guard the compiled publish shape.

  - Each package's `prepack` now copies the repository-root `LICENSE` and `NOTICE` into the package before packing, so every tarball carries the full Apache-2.0 license text and the NOTICE (Apache-2.0 §4(d) NOTICE propagation + the USPTO defensive-patent notice and third-party attributions). Previously `NOTICE` never reached npm and `LICENSE` shipped only via pnpm auto-hoisting.
  - Added `"LICENSE"` and `"NOTICE"` to the `files` array of the four packages that omitted them (`disclosure-card`, `onchain-accounting-contract`, `planning-contract`, `shared`) and resolved the dangling `files` references in the rest.
  - Added `pnpm lint:publish` (`scripts/check-publish-shape.mjs`), run in CI and as a publish preflight, which fails if any published `main`/`types`/`exports` entry would resolve to raw `./src/*.ts` instead of a compiled `./dist` artifact.

  No library source or runtime behavior changes.

## 0.2.1

### Patch Changes

- [#78](https://github.com/Protocol-Wealth/pwos-core/pull/78) [`0e3b777`](https://github.com/Protocol-Wealth/pwos-core/commit/0e3b777b918ed69b6d7ca7e36c4932b06428cb7c) Thanks [@lifrmn](https://github.com/lifrmn)! - Document the contract boundary for the primitives consumed by the private
  estate. Each README gains a "Contract Boundary" section clarifying that the
  package exposes a generic, adopter-facing public contract that must not depend
  on private-estate data, credentials, production endpoint URLs, firm-specific
  settings, or private-estate identifiers. Only reusable, non-private contract
  improvements land here; feedback is tracked in [#76](https://github.com/Protocol-Wealth/pwos-core/issues/76).

## 0.2.0

### Minor Changes

- [#43](https://github.com/Protocol-Wealth/pwos-core/pull/43) [`4ae4ae1`](https://github.com/Protocol-Wealth/pwos-core/commit/4ae4ae1f43ed87d1263993ea605c9792eacb6ed8) Thanks [@rivendale](https://github.com/rivendale)! - Initial public npm release (0.1.0).

  `@protocolwealthos/shared` ships two governance primitives under their own
  sub-path imports:

  - **`@protocolwealthos/shared/hitl`** — fail-closed human-in-the-loop gate.
    Two-class default policy (`client_facing_deliverable: mandatory`,
    `internal_research: optional`); pure `evaluateHitl(action, policy) ->
HitlDecision`; unknown action class → `requiresApproval: true`. Zod
    schemas for both policy and action.
  - **`@protocolwealthos/shared/provenance`** — SHA-256 hash-chained
    provenance records. `chainAll(records)` to seal a sequence,
    `verifyChain(records)` to detect tampering (returns the first divergent
    record's index + id + a plain-English reason). Web Crypto with
    `node:crypto` fallback for Node < 19.

  Note: the disclosure-card schema, previously developed under
  `@protocolwealthos/shared/disclosure`, was promoted to its own focused
  package before first publish — see `@protocolwealthos/disclosure-card`.
  There is no back-compat re-export shim from this package; nothing has
  been published yet, so there are no downstream importers to preserve.

  API surface is intentionally `0.x` to signal a pre-1.0 contract — minor
  breaking changes are possible until `1.0.0`. Adopter-facing usage docs
  ship in `packages/shared/src/hitl/README.md`.

  Apache 2.0; defensive-patent posture (USPTO [#64](https://github.com/Protocol-Wealth/pwos-core/issues/64)/034,215; OIN member).
