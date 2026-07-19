---
"@protocolwealthos/ai-guardrails": patch
"@protocolwealthos/audit-log": patch
"@protocolwealthos/auth": patch
"@protocolwealthos/cache-keys": patch
"@protocolwealthos/compliance": patch
"@protocolwealthos/crm": patch
"@protocolwealthos/disclosure-card": patch
"@protocolwealthos/document-gen": patch
"@protocolwealthos/email-archive": patch
"@protocolwealthos/gcp-helpers": patch
"@protocolwealthos/holdings": patch
"@protocolwealthos/ledger": patch
"@protocolwealthos/mcp-tools": patch
"@protocolwealthos/onchain-accounting-contract": patch
"@protocolwealthos/onchain-sdk": patch
"@protocolwealthos/pii-guard": patch
"@protocolwealthos/planning-contract": patch
"@protocolwealthos/security-headers": patch
"@protocolwealthos/shared": patch
"@protocolwealthos/webhooks": patch
"@protocolwealthos/workflow-engine": patch
---

Ship LICENSE and NOTICE in every published tarball, and guard the compiled publish shape.

- Each package's `prepack` now copies the repository-root `LICENSE` and `NOTICE` into the package before packing, so every tarball carries the full Apache-2.0 license text and the NOTICE (Apache-2.0 §4(d) NOTICE propagation + the USPTO defensive-patent notice and third-party attributions). Previously `NOTICE` never reached npm and `LICENSE` shipped only via pnpm auto-hoisting.
- Added `"LICENSE"` and `"NOTICE"` to the `files` array of the four packages that omitted them (`disclosure-card`, `onchain-accounting-contract`, `planning-contract`, `shared`) and resolved the dangling `files` references in the rest.
- Added `pnpm lint:publish` (`scripts/check-publish-shape.mjs`), run in CI and as a publish preflight, which fails if any published `main`/`types`/`exports` entry would resolve to raw `./src/*.ts` instead of a compiled `./dist` artifact.

No library source or runtime behavior changes.
