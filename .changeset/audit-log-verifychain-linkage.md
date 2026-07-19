---
"@protocolwealthos/audit-log": patch
---

fix(audit-log): `verifyChain` now verifies each entry against the running predecessor hash and asserts the stored `previousHash` link matches it.

Previously `verifyChain` recomputed each entry's hash from that entry's OWN stored `previousHash` and never checked the link against the actual predecessor. As a result a deleted middle entry, a front-truncated genesis, or an edited row whose own hash was recomputed all passed as "intact" — defeating the tamper-evidence the package promises for SEC 204-2 / 17a-4 chains. The chain is now walked with a running predecessor hash (genesis anchor `""`, matching the write side), and both the stored link and the recomputed hash must hold. Adds tamper tests covering delete-middle, edit-and-rehash, and genesis-truncation.
