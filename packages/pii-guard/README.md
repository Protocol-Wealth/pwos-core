# @pwos/pii-guard

4-layer PII scanning pipeline for LLM-bound content.

**Protocol Wealth original work.** Patent Pending USPTO #64/034,215.

## Layers

1. **Regex** — 31 deterministic patterns (SSN, CC, email, phone, crypto keys, API keys)
2. **NER** — Named entity recognition for person names, addresses, contextual PII
3. **Financial Recognizers** — CUSIP, account references, policy numbers (context-boosted)
4. **Allow-List** — 60+ finance terms that should never be redacted

## Modes

- `off` — No scanning
- `warn` — Confirm with user before send
- `block` — Reject message until PII removed
- `redact` — Auto-mask with `<TYPE_N>` placeholders

## License

Apache 2.0. See [../../LICENSE](../../LICENSE).
