<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright 2026 Protocol Wealth, LLC and contributors. -->

# `@protocolwealthos/shared`

> Two governance primitives for AI-assisted compliance systems: a fail-closed
> HITL gate and SHA-256 hash-chained provenance records. Framework-agnostic;
> zero runtime dependencies beyond `zod`.

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Patent Pending](https://img.shields.io/badge/Patent-Pending-orange.svg)](https://patentcenter.uspto.gov/applications/64034215)
[![OIN Member](https://img.shields.io/badge/OIN-Member-green.svg)](https://openinventionnetwork.com)

Sibling to other `@protocolwealthos/*` packages; published from the
[`Protocol-Wealth/pwos-core`](https://github.com/Protocol-Wealth/pwos-core)
monorepo. **Status:** `0.x` — pre-1.0 API may break in minor versions
(see each sub-module's adoption guide for the back-compat discipline).

The **disclosure-card schema** that pairs with these primitives lives in
the focused sibling package
[`@protocolwealthos/disclosure-card`](https://github.com/Protocol-Wealth/pwos-core/tree/main/packages/disclosure-card#readme).

## Install

```bash
pnpm add @protocolwealthos/shared zod
```

## Two sub-modules

### `@protocolwealthos/shared/hitl` — fail-closed human-in-the-loop gate

Map an action's *class* to a required oversight level
(`"mandatory"` | `"optional"`); call the pure evaluator at the action
boundary; an unknown action class is treated as `"mandatory"` (fail
closed). Two-class default policy:
`client_facing_deliverable: "mandatory"`, `internal_research: "optional"`.

```ts
import { evaluateHitl, DEFAULT_POLICY } from "@protocolwealthos/shared/hitl";

const decision = evaluateHitl(
  { id: "act_1", class: "client_facing_deliverable" },
  DEFAULT_POLICY,
);
// → decision.requiresApproval === true
```

[Full adoption guide →](./src/hitl/README.md)

### `@protocolwealthos/shared/provenance` — SHA-256 hash-chained provenance

Append-only records linking each entry to its predecessor via a SHA-256
hash chain. Any post-hoc edit anywhere in the chain forces the recomputed
hash to differ from the stored hash; `verifyChain` returns the first
divergent record's index, id, and reason.

```ts
import {
  chainAll,
  verifyChain,
} from "@protocolwealthos/shared/provenance";

const sealed = await chainAll([record1, record2, record3]);
const result = await verifyChain(sealed);
// → { valid: true } if intact; { valid: false, badIndex, badId, reason } on tamper
```

## What this package does NOT do

- It does not ship a UI, a CLI, or a transport layer. It exposes typed
  primitives; consumers wire them into their own runtime.
- It does not persist anything. The HITL gate produces a decision; chained
  provenance records are returned to the caller, who is responsible for
  storing them.
- It does not authorize humans. The HITL gate produces a decision; your
  RBAC / auth layer decides *who* may approve.
- It does not provide legal advice or a disclosure schema. The
  machine-readable disclosure schema is the separate
  [`@protocolwealthos/disclosure-card`](https://github.com/Protocol-Wealth/pwos-core/tree/main/packages/disclosure-card#readme)
  package.

## Contract Boundary

This package exposes a generic, adopter-facing public contract (`hitl` and
`provenance`) and must not depend on private-estate data or wiring details.
Private estate integration can reveal reusable contract gaps, but only
non-private, generic improvements belong in this repository (tracked in
[#76](https://github.com/Protocol-Wealth/pwos-core/issues/76)).

Never commit private client/advisor data, credentials, API keys, production
endpoint URLs, firm-specific settings, or private-estate identifiers to this
package or its documentation.

## Apache 2.0 + defensive patent

License: **Apache 2.0**.
Patent: USPTO #64/034,215 (filed defensively; the patent grant flows
automatically under Apache 2.0; suing the licensor terminates your
license).
OIN: Protocol Wealth is a member of the Open Invention Network.

See [`PATENTS`](../../PATENTS) for the full non-assertion pledge.

## Contributing

PRs welcome. See [`CONTRIBUTING.md`](../../CONTRIBUTING.md). DCO sign-off
required (`git commit -s -m "feat: ..."`).
