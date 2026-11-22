# @protocolwealthos/compliance

> SEC Rule 204-2 compliance primitives: retention calculator, books-and-records export bundler, AI inventory, PII incident classifier, compliance calendar, and policy/vendor review status.

MIT-0 OR Apache-2.0 · part of [pwos-core](https://github.com/Protocol-Wealth/pwos-core).

## Why

The package is storage-agnostic — no database or HTTP framework is assumed. Downstream projects assemble data from their stores and pass arrays into these helpers.

## What ships

| Helper | Role |
|---|---|
| `RetentionCalculator` | Retention math for books-and-records categories |
| `BooksAndRecordsBundle` / `verifyBundle` | Export bundler with chain-of-custody hashes |
| `evaluateCalendar` / `upcomingOrOverdue` / `nextOccurrence` | Compliance calendar evaluator |
| `classifySeverity` / `notifiableIncidents` / `summarize` | PII incident classifier |
| `policyStatus` / `policiesNeedingReview` / `vendorStatus` / `vendorsNeedingReview` | Policy and vendor review status |
| `wrapWithCompliance` | Envelope helper for attaching compliance metadata |

Defensive patent: [USPTO #64/034,215](https://patentcenter.uspto.gov/applications/64034215).

## License

Licensed under MIT-0 OR Apache-2.0, at your option.
