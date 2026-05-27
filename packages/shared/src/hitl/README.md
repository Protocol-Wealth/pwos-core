<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright 2026 Protocol Wealth, LLC and contributors. -->

# HITL gate — adoption guide

> Fail-closed human-in-the-loop gate. Map an action's *class* to a required
> oversight level; the pure evaluator says whether the action needs a human
> sign-off before it can proceed.

Companion to [`@protocolwealthos/disclosure-card`](https://github.com/Protocol-Wealth/pwos-core/tree/main/packages/disclosure-card#readme) —
the disclosure card describes a system's oversight posture; this module
enforces it at the tool boundary.

---

## Install

```bash
pnpm add @protocolwealthos/shared zod
```

```ts
import {
  evaluateHitl,
  DEFAULT_POLICY,
  hitlPolicySchema,
  parseHitlPolicy,
  type HitlAction,
  type HitlDecision,
  type HitlPolicy,
  type OversightLevel,
} from "@protocolwealthos/shared/hitl";
```

---

## The minimum viable adoption

1. Define a policy mapping action-class strings to `"mandatory"` or `"optional"`.
2. Call `evaluateHitl(action, policy)` at the boundary where the action would
   execute.
3. If `decision.requiresApproval === true`, route the action to your
   confirmation / review flow instead of executing.

```ts
import { evaluateHitl, DEFAULT_POLICY } from "@protocolwealthos/shared/hitl";

const action = {
  id: "act_2026_05_27_001",
  class: "client_facing_deliverable",   // <- maps into the policy
  label: "send quarterly report email to client #842",
};

const decision = evaluateHitl(action, DEFAULT_POLICY);

if (decision.requiresApproval) {
  // Don't execute; queue for human approval.
  await queueForReview(action, decision);
} else {
  await execute(action);
}
```

`decision.reason` is a plain-English string suitable for the audit-log
entry that records the approval requirement.

---

## The default policy

```ts
DEFAULT_POLICY = {
  client_facing_deliverable: "mandatory",  // approval REQUIRED
  internal_research:         "optional",   // proceed; log
}
```

That's deliberately minimal. The canonical taxonomy is two-class because
those are the two distinctions that matter at the boundary: *does this
output touch a client, or does it stay in the advisor's IDE?*

---

## Adding your own classes

The policy is an open record: any string key is allowed. Add more classes
to express finer-grained governance:

```ts
import type { HitlPolicy } from "@protocolwealthos/shared/hitl";

const policy: HitlPolicy = {
  ...DEFAULT_POLICY,
  send_email_to_client:        "mandatory",
  execute_trade:               "mandatory",
  modify_client_record:        "mandatory",
  generate_what_if_scenario:   "optional",
  draft_internal_memo:         "optional",
};
```

Any action whose `class` does not appear in the policy is treated as
`"mandatory"` (see "Fail-closed" below).

If your policy lives in a config file or database, validate it at
load time:

```ts
import { parseHitlPolicy } from "@protocolwealthos/shared/hitl";
const policy = parseHitlPolicy(JSON.parse(fs.readFileSync("policy.json", "utf8")));
```

`parseHitlPolicy` throws ZodError on any value that is not `"mandatory"` or
`"optional"`.

---

## Fail-closed — the load-bearing property

The evaluator's single load-bearing invariant:

> If `action.class` is not a key of the policy, the decision is
> `requiresApproval: true` and `oversight: "unknown"`.

That means:

- An empty policy gates *every* action.
- A typo in an action class falls into the gated branch.
- A new action class an engineer added without updating the policy falls
  into the gated branch.
- A policy fetched from a config source that came back malformed (and
  parsed by your code to `{}` or similar) gates everything.

The evaluator is also pure: no I/O, no clock, no globals. Same input always
produces the same output. Use it inside hot paths without performance
concerns; use it inside unit tests without mocking.

---

## Wiring into an existing dispatcher (sketch)

```ts
// in your tool / route / action dispatcher
import { evaluateHitl } from "@protocolwealthos/shared/hitl";
import { POLICY } from "./policy.js";

export async function dispatch(action: HitlAction, payload: unknown) {
  const decision = evaluateHitl(action, POLICY);
  await audit({ action, decision }); // log the gate decision either way
  if (decision.requiresApproval) {
    return enqueueForApproval(action, payload, decision);
  }
  return executeNow(action, payload);
}
```

For a richer pattern that pairs HITL with a separate "confirmation gate" (a
two-turn primitive that binds the previewed payload to the executed one)
see the sibling `@protocolwealthos/mcp-tools` package's `confirmGate`.

---

## What this package does NOT do

- It does not *authorize* the human approver. Use your existing auth /
  RBAC layer for that.
- It does not *persist* the approval decision. Use your existing audit
  log (`@protocolwealthos/audit-log` is one option). The
  `HitlDecision.reason` string is meant to land in that audit row.
- It does not *time-bound* the approval. If you need "approval expires
  after N seconds", layer that on top — the gate is a pure function, not
  a state machine.
- It does not *cascade*. Each action is evaluated independently against
  the policy. If you want bulk-approval semantics, group your actions
  before evaluating.

---

## Disclosure-card alignment

If your published disclosure card says
`humanOversight.clientFacingRequiresApproval: true`, your runtime should
gate the `client_facing_deliverable` class via HITL (or an equivalent
enforcement primitive). The two MUST agree. The disclosure card is the
publicly-readable claim; the HITL gate is the runtime substrate that
makes the claim true. Publishing one without the other is a worse
posture than publishing neither.

License: Apache 2.0. Defensive-patent posture (USPTO #64/034,215; OIN
member); the patent grant flows automatically under Apache 2.0.
