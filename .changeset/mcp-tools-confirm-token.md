---
"@protocolwealthos/mcp-tools": patch
---

`confirmGate` no longer accepts an unkeyed hash of the payload. A confirmation token is an HMAC-SHA256 under a server secret, bound to the operation, principal, payload hash, expiry, and a single-use id. The id is recorded in a caller-supplied store at preview and consumed once before `execute()`.

**Breaking for existing callers.** `computeConfirmToken` and `CONFIRM_TOKEN_LENGTH` are removed. `confirmGate` now requires `authorization`:

```ts
await confirmGate({
  payload,
  confirmToken: input.confirm_token,
  operationLabel: "create record", // server-side tool name, not model input
  authorization: {
    secret, // non-empty server secret; string or Buffer
    principalId: session.sub, // server session, not model input
    store, // shared ConfirmTokenStore; InMemoryConfirmTokenStore is single-process only
    ttlMs, // positive millisecond lifetime chosen by the caller
  },
  renderPreview,
  execute,
});
```

Rejection codes: `confirm_token_mismatch`, `confirm_token_expired`, `confirm_token_replayed`, `confirm_token_not_issued`. A signed token that the store did not issue is rejected. A changed payload, operation, or principal does not burn the token. Expiry and a successful consume do. If `execute()` throws, the token stays spent; put an idempotency key in the payload and dedupe inside `execute()`. The gate does not replay results.

This binds one server-issued preview to one execution. It does not, by itself, prove a human approved. Submit the token from the trusted approval step. `issueConfirmToken` mints a token without registering it; the caller must `store.issue` or go through `confirmGate`'s preview.

Refs #126
