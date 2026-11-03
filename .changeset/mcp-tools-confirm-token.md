---
"@protocolwealthos/mcp-tools": minor
---

**Breaking.** Existing `confirmGate` callers must change. The gate now requires `authorization` (`secret`, `principalId`, `store`, and `ttlMs`). A call that omits it does not typecheck and does not run. `computeConfirmToken` and `CONFIRM_TOKEN_LENGTH` are removed. An unkeyed hash of the payload is not a token anymore, so code that minted a token with `computeConfirmToken(payload)` and passed it back will be rejected.

Replacement:

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

The token is an HMAC-SHA256 under that server secret, bound to the operation, principal, payload hash, expiry, and a single-use id. Preview records the id in `store`. Confirm consumes it once before `execute()`.

Rejection codes: `confirm_token_mismatch`, `confirm_token_expired`, `confirm_token_replayed`, `confirm_token_not_issued`. A signed token that the store did not issue is rejected. A changed payload, operation, or principal does not burn the token. Expiry and a successful consume do. If `execute()` throws, the token stays spent; put an idempotency key in the payload and dedupe inside `execute()`. The gate does not replay results.

This binds one server-issued preview to one execution. It does not, by itself, prove a human approved. Submit the token from the trusted approval step. `issueConfirmToken` mints a token without registering it; the caller must `store.issue` or go through `confirmGate`'s preview.

Refs #126
