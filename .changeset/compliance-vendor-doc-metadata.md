---
"@protocolwealthos/compliance": minor
---

Add a vendor-document advisory metadata schema for SOC 1 / SOC 2 / ISO / DPA / pen-test / insurance / privacy-policy records.

The `VendorDocMetadata` type captures the structured facts compliance teams want to surface in dashboards and search:

- **Identity** — `kind`, `title`, `sourceRef`, `sourceSha256` (chain-of-custody anchor), `issuedAt`, `expiresAt`
- **Attestation** — `auditPeriodStart` / `End`, `opinion` (unqualified / qualified / adverse / disclaimer / unknown), `trustServicesCriteria[]` for SOC 2, `exceptionCount`, `findingSummaries[]`
- **DPA / privacy** — `subprocessors[]` (with `region` and `hasDpa`), `retentionWindowDays`, `breachNotificationWindowDays`
- **Pen-test** — `highestOpenSeverity`, `findingsByStatus`
- **Provenance** — `human` vs `ai_advisory`. Documents are framed as **advisory metadata**: the source PDF remains the system of record; if AI extraction disagrees with the PDF, the PDF wins.

Plus two helpers:
- `isVendorDocCurrent(doc, nowIso)` — within validity window
- `vendorDocsExpiringSoon(docs, nowIso, daysAhead)` — for nightly "re-up your SOC 2" reminders
