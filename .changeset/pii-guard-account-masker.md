---
"@protocolwealthos/pii-guard": minor
---

Add account-number masker — the "show last 4" pattern for tool outputs and structured-log redaction.

`maskAccountNumber("1234567890123456")` → `"•••• 3456"`. Strips internal hyphens / spaces before measuring; rejects non-digit input. Configurable `reveal` count, `maskChar`, `maskLength`, and `separator`.

`maskAccountNumbersInText(text)` walks free text, finds account-number-shaped runs (8–20 contiguous digits, optionally with internal hyphens or single spaces), and replaces them with the masked form. Preserves surrounding text verbatim.

Use as a lightweight first-line defense for tool outputs; for richer detection (CUSIP / IBAN / SSN), the existing `scan()` pipeline + financial recognizers remain the canonical path.

New exports: `maskAccountNumber`, `maskAccountNumbersInText`, type `MaskOptions`.
