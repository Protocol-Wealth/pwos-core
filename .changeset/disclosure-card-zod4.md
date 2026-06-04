---
"@protocolwealthos/disclosure-card": minor
---

Support zod 4. Replace the removed `z.SafeParseReturnType` alias in
`safeParseDisclosureCard` with the schema-derived return type
(`ReturnType<typeof disclosureCardSchema.safeParse>`), so the package builds
against its declared `zod ^4.4.3`. Runtime validation behavior is unchanged — the
safeParse result shape (`{ success, data | error }`) is identical; only the
compile-time type alias changed because zod itself removed it.
