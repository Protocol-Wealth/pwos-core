# Agent Instructions

`CLAUDE.md` is the canonical agent/developer guide for this repository. Follow it
for repo boundaries, package layout, conventions, validation commands, and
release process.

Current quick checks:

```bash
pnpm versions:check
pnpm -r build
pnpm -r typecheck
pnpm -r test
pnpm -r lint
```

Do not add consumer-app code, firm-specific settings, real client data, vendor
credentials, or production thresholds to this repo. Those belong in the private
PW estate; `pwos-core` owns reusable package shapes and generic primitives.
