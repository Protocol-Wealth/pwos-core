# HANDOFF — `pwos-core` (open-source repo)

Current as of 2026-07-16. This file tracks only active public/private boundary
work; historical session details belong in changelogs, not the current handoff.

## Current Local State

- Branch: `main`
- Workspace: 21 package manifests under `packages/*`, private `apps/evals/`,
  private `examples/rias-agent-substrate/`
- Removed: stale tracked `apps/api/src/services/pii/*` duplicate code. The
  maintained PII implementation is `@protocolwealthos/pii-guard`.
- CI: PR workflow runs `pnpm versions:check`, build, typecheck, tests, and lint.
  SPDX/license workflows still run separately; license scan now fails closed.
- Publish: Changesets workflow opens/updates the Version Packages PR only.
  Maintainer publish remains local via `pnpm changeset:publish` after `npm login`.

## Private Estate Wiring

These are consumer-side tasks for `pw-os-v2`, `pw-api`, and `pw-portal-v2`, not
additional code in this repo:

1. Wire `@protocolwealthos/shared/provenance` into the production AI audit-log
   chain so generated outputs can be replay-verified.
2. Consume `@protocolwealthos/disclosure-card` in the Compliance Center and the
   public `/disclosures` route; CCO-authored values remain private-estate data.
3. Register `@protocolwealthos/shared/hitl` in the production tool orchestrator
   and enforce the client-facing approval gate at write-tool boundaries.
4. Keep the private planning gateway aligned with
   `@protocolwealthos/planning-contract` contract version `1.1.0`; math remains
   in `nexus-core`.
5. Replace the private onchain-accounting ABI stopgap with
   `@protocolwealthos/onchain-accounting-contract` contract `0.2.0` after its
   first release. Retain the private value-level PII/canary guard, runtime
   version handshake, and client-linkage boundary. Bind every calculation
   response to its originating authenticated request and immutable audit record:
   wire `0.2.0` has no canonical request digest, so cost/PnL correlation is
   intentionally `unverifiable`. Treat
   `isNexusAccountingResultEligibleForComposition` only as an engine-output
   gate; client delivery still requires the private compatibility, advisor/CCO,
   records-retention, and release workflow.

Public contract feedback from this wiring is tracked in
[#76](https://github.com/Protocol-Wealth/pwos-core/issues/76). Do not put
private client data, credentials, firm settings, or deployed-route details in
that issue.

## Repo Boundary

`pwos-core` owns generic shapes, schemas, package APIs, hash-chain utilities,
tool definitions, and adopter-facing docs. It does not own production auth,
client data, firm-specific thresholds, vendor credentials, deployed app routes,
or the planning math engine.
