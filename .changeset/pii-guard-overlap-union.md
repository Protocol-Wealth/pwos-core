---
"@protocolwealthos/pii-guard": patch
---

Merge overlapping PII detections to the union of their spans so a shorter or higher-scoring match cannot leave the rest of a longer match unmasked. The allow-list is applied before that merge, so an allow-listed wrapper cannot suppress an overlapping detection. Score and source choose the placeholder label only. Adjacent spans stay separate.

`sanitizedText` is the egress string. Manifest originals stay on the trusted side. No detections is not proof the input had no sensitive data.

Coverage matches pw-redact-core `_merge_entities` (pw-redact-core#3). This package still does not rewrite look-alike Unicode or copy a value onto later occurrences.

Refs #125
