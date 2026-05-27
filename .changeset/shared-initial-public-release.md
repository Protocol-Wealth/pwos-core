---
"@protocolwealthos/shared": minor
---

Initial public npm release (0.1.0).

`@protocolwealthos/shared` was previously an internal-only workspace package
carrying cross-package types. This release flips it to `private: false`,
adds the publish-time `publishConfig` (subpath exports → `dist/`), and
publishes three governance primitives under their own subpath imports:

- **`@protocolwealthos/shared/hitl`** — fail-closed human-in-the-loop
  gate. Two-class default policy (`client_facing_deliverable: mandatory`,
  `internal_research: optional`); pure `evaluateHitl(action, policy) ->
  HitlDecision`; unknown action class → `requiresApproval: true`. Zod
  schemas for both policy and action.
- **`@protocolwealthos/shared/disclosure`** — machine-readable
  disclosure-card schema for AI-assisted advisory systems. Zod schema +
  hand-rolled JSON Schema (Draft 2020-12, zero extra deps) + validator
  (`parseDisclosureCard`, `safeParseDisclosureCard`,
  `assertNoVerifyMarkers` pre-publish CI gate) + a synthetic example.
- **`@protocolwealthos/shared/provenance`** — SHA-256 hash-chained
  provenance records. `chainAll(records)` to seal a sequence,
  `verifyChain(records)` to detect tampering (returns the first
  divergent record's index + id + a plain-English reason).

API surface is intentionally `0.x` to signal a pre-1.0 contract — minor
breaking changes are possible until `1.0.0`. Adopter-facing usage docs
ship in `packages/shared/src/disclosure/README.md` and
`packages/shared/src/hitl/README.md`.

Apache 2.0; defensive-patent posture (USPTO #64/034,215; OIN member).
