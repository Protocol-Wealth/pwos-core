---
"@protocolwealthos/ai-guardrails": patch
---

`assertWorkspace` / `assertWorkspaceFromEnv` are configuration checks, not proof of provider retention or of which credential signs a request. Results now include `assurance` (`"configuration"` or `"configuration-and-credential"`), `credentialFingerprint`, and `retentionVerified: false`.

Pass `credential` (a source label plus `fingerprintCredential(signingKey)`) and `allowedCredentialFingerprints` to fail when the signing key changes even though the workspace id did not. The fingerprint is not logged. A workspace-id match with no allowlist stays successful and is reported as `credentialFingerprint: "unchecked"`.

`assertWorkspaceFromEnv` takes an optional fourth argument `{ credential, allowedCredentialFingerprints }`.

Refs #127
