---
"@protocolwealthos/shared": patch
"@protocolwealthos/disclosure-card": patch
"@protocolwealthos/planning-contract": patch
---

Document the contract boundary for the primitives consumed by the private
estate. Each README gains a "Contract Boundary" section clarifying that the
package exposes a generic, adopter-facing public contract that must not depend
on private-estate data, credentials, production endpoint URLs, firm-specific
settings, or private-estate identifiers. Only reusable, non-private contract
improvements land here; feedback is tracked in #76.
