# @protocolwealthos/pii-guard

4-layer PII scanning pipeline for LLM-bound content.

**Protocol Wealth original work.** Patent Pending USPTO #64/034,215.

## Layers

1. **Regex** — 31 deterministic patterns (SSN, CC, email, phone, crypto keys, API keys)
2. **NER** — Named entity recognition for person names, addresses, contextual PII
3. **Financial Recognizers** — CUSIP, account references, policy numbers (context-boosted)
4. **Allow-List** — 60+ finance terms that should never be redacted

## Overlapping detections

Detections that survive the allow-list are merged to the union of their spans before masking. Score and source (regex, then financial, then ner) choose the placeholder label. They do not drop coverage. Spans that only touch at an edge stay separate. An allow-listed span is removed before that merge, so it cannot swallow an overlapping detection.

The same coverage rule is implemented in [pw-redact-core](https://github.com/Protocol-Wealth/pw-redact-core) (`_merge_entities`, coordinated with pwos-core#125 and pw-redact-core#3). Intentional differences: this package does not rewrite look-alike Unicode before matching, and it does not copy a detected value onto later occurrences. pw-redact-core folds financial recognizers into its NLP bucket; this package keeps them as their own source.

`sanitizedText` is the egress string. Manifest `original` values are for trusted-side rehydration — do not send the manifest to a hosted model. No detections does not mean the input had no sensitive data.

## Modes

- `off` — No scanning
- `warn` — Confirm with user before send
- `block` — Reject message until PII removed
- `redact` — Auto-mask with `<TYPE_N>` placeholders

## License

Licensed under MIT-0 OR Apache-2.0, at your option. See [../../LICENSE-MIT-0](../../LICENSE-MIT-0) and [../../LICENSE-APACHE](../../LICENSE-APACHE).
