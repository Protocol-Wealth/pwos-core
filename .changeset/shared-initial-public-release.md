---
"@protocolwealthos/shared": minor
---

Initial public npm release (0.1.0).

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

Apache 2.0; defensive-patent posture (USPTO #64/034,215; OIN member).
