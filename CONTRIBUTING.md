# Contributing to PWOS Core

Thank you for your interest in contributing to PWOS Core. This document outlines our process for welcoming new contributors.

## Developer Certificate of Origin

All commits to this repository must be signed off under the [Developer Certificate of Origin (DCO)](https://developercertificate.org/) version 1.1.

By signing off your commits, you certify that:

1. The contribution was created in whole or in part by you and you have the right to submit it under the open source license indicated in the file; or
2. The contribution is based upon previous work that, to the best of your knowledge, is covered under an appropriate open source license and you have the right under that license to submit that work with modifications; or
3. The contribution was provided directly to you by some other person who certified (1), (2), or (3) and you have not modified it.
4. You understand and agree that this project and the contribution are public and that a record of the contribution (including all personal information you submit with it, including your sign-off) is maintained indefinitely.

Sign off your commits using the `-s` flag:

```bash
git commit -s -m "feat: add CRM contact-aging helper"
```

This appends a `Signed-off-by: Your Name <your.email@example.com>` line to the commit message.

## How to Contribute

### Reporting Bugs

Open an issue describing:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Your Node.js version, OS, and pwos-core version (or the specific `@protocolwealthos/*` package versions)

### Suggesting Features

Open an issue with the `enhancement` label. Describe:
- The problem you're trying to solve
- Why existing functionality doesn't address it
- Your proposed solution (if you have one)

### Submitting Pull Requests

1. **Fork** the repository
2. **Create a branch** from `main`: `git checkout -b feat/your-feature`
3. **Write tests** for your changes (we use vitest)
4. **Run the test suite** locally: `pnpm -r test`
5. **Run the type checker**: `pnpm -r typecheck`
6. **Run the linter** (if the package has one): `pnpm -r lint`
7. **Sign off your commits**: `git commit -s -m "feat: your feature"`
8. **Add a changeset** if your change touches a published package: `pnpm changeset` (pick `patch` / `minor` / `major` and describe the change for end-users)
9. **Push** to your fork and open a PR

### PR Guidelines

- One logical change per PR
- Include tests for new functionality
- Update documentation if you change behavior
- Follow existing code style (Prettier / ESLint where wired)
- Keep PRs focused — small PRs merge faster than large ones

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/pwos-core.git
cd pwos-core

# Install dependencies (pnpm 9+ required; Node 22+ required)
pnpm install

# Build all packages
pnpm -r build

# Run all tests
pnpm -r test

# Typecheck all packages
pnpm -r typecheck

# Lint (only runs where a package defines a lint script)
pnpm -r lint
```

Per-package:

```bash
pnpm --filter @protocolwealthos/<name> test
pnpm --filter @protocolwealthos/<name> build
pnpm --filter @protocolwealthos/<name> typecheck
```

## Code Style

- **TypeScript:** strict mode, ESM-only. No `any` without an inline comment explaining why.
- **Formatting:** Prettier defaults (the editor's auto-format is fine).
- **Type hints:** Required for all public APIs. Re-exports happen from `src/index.ts`.
- **Zod:** Used for runtime validation at boundaries only — do not Zod-validate internal hot paths.
- **Conventional Commits** for type prefixes (`feat:`, `fix:`, `chore:`, `docs:`, `deps:`, `ci:`).
- **SPDX header on every new `.ts` / `.tsx` source file.** Two-line block, prepended above any imports or doc comment:
  ```ts
  // SPDX-License-Identifier: Apache-2.0
  // Copyright 2026 Protocol Wealth, LLC and contributors.
  ```

## Testing

We use [vitest](https://vitest.dev/) for unit and integration tests.

```bash
pnpm -r test                                  # All packages
pnpm --filter @protocolwealthos/pii-guard test  # Single package
```

Test files live under `packages/<pkg>/__tests__/` matching source file names (`scanner.ts` → `__tests__/scanner.test.ts`).

Tests must be **hermetic** — no network calls, no live API keys, no real client / advisor data, no real vendor credentials. Fixtures must use synthetic / placeholder values.

## Package Layout

PWOS Core is a pnpm 9 monorepo. The publishable surface lives under `packages/*`; `apps/evals/` and `examples/*` are private workspace projects for testing and integration examples.

```
pwos-core/
├── apps/
│   └── evals/              # Private deterministic eval harness
├── packages/
│   ├── ai-guardrails/      # ZDR workspace assert + model allowlist + cache markers + audit-row builder
│   ├── audit-log/          # Append-only log + SHA-256 hash chaining + anomaly detectors + approver-separation
│   ├── auth/               # HS256 JWT session + role guard + Workspace-domain assert + per-agent scoped tokens
│   ├── cache-keys/         # Namespace-enforced cache-key builder with PII pattern rejection
│   ├── compliance/         # SEC 204-2 retention, Books-and-Records bundler, calendar, incidents, vendor metadata
│   ├── crm/                # Contact / household / interaction / opportunity / task + HouseholdProfile/Goal/Note
│   ├── document-gen/       # Document block model + RFC-4180 CSV + plain-text renderer + DocumentRenderer interface
│   ├── email-archive/      # SEC Rule 17a-4 archive primitives (chain-of-custody hashing, retention enforcement)
│   ├── gcp-helpers/        # Cloud Logging + Cloud SQL IAM picker + Secret Manager loader + frontend error shape
│   ├── holdings/           # Account / Security / immutable HoldingEvent stream + materialized HoldingSnapshot
│   ├── ledger/             # Append-only double-entry + sum-to-zero invariant + bailment-mode shadow ledger
│   ├── mcp-tools/          # Tool registry + tier classification + response filters + confirm gate + audit builder
│   ├── onchain-sdk/        # Typed client for on-chain portfolio services (no internal URLs baked in)
│   ├── pii-guard/          # 4-layer PII scanner + streaming rehydrator + injection detector + account masker
│   ├── security-headers/   # HSTS / strict CSP / X-Frame / X-Content-Type / Referrer-Policy / Permissions-Policy
│   ├── shared/             # Published shared types + hitl/provenance governance primitives
│   ├── webhooks/           # HMAC-SHA256 verify + dual-layer path-token + Basic Auth + idempotency
│   └── workflow-engine/    # Storage-agnostic durable-job runtime + backoff strategies
└── examples/               # Runnable integration examples (no network credentials required)
```

When adding a new package, mirror an existing one's `package.json` shape — note the `publishConfig` block that swaps `src/` for `dist/` at publish time — and add a changeset describing the new exports.

## Attribution

When adding third-party code or ideas:
1. Add full copyright notice and license to [NOTICE](NOTICE)
2. Add full license text to [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) (if a new license type appears)
3. Add provenance details to [docs/attribution.md](docs/attribution.md)
4. Update [README.md](README.md) "Built on" section if appropriate

Reference-architecture-only (GPL / AGPL-3.0) projects may be **read for patterns**; bytes may not be copied. Clean-room re-derivation only. See [`docs/attribution.md`](docs/attribution.md) for the existing reference set.

## Upstream Contributions

If you find a bug or improvement in one of our dependencies (Hono, Drizzle, pdfme, Viem, etc.), we encourage you to contribute upstream first, then pin the new version here.

## License

By contributing, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).

## Code of Conduct

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

## Getting Help

- **Questions:** [GitHub Discussions](https://github.com/Protocol-Wealth/pwos-core/discussions)
- **Bugs:** [GitHub Issues](https://github.com/Protocol-Wealth/pwos-core/issues)
- **Security issues:** email security@protocolwealthllc.com (see [SECURITY.md](SECURITY.md))
