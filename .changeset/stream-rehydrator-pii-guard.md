---
"@protocolwealthos/pii-guard": minor
---

Add the **streaming rehydrator** — `createStreamRehydrator()` — for SSE / chunked LLM output.

The existing `rehydrate()` works on a complete string. Streaming consumers face a harder problem: a placeholder like `<NAME_1>` may arrive split across two chunks (`<NA` then `ME_1>`). A naive per-chunk replace would emit garbled output. The streaming rehydrator buffers any tail starting with `<` until either the placeholder closes, the body exceeds the max placeholder length (so it can't be a placeholder), or the stream ends.

```ts
import { createStreamRehydrator, scan } from "@protocolwealthos/pii-guard";

const { manifest } = await scan(prompt);

const rehydrator = createStreamRehydrator(manifest, (chunk) => {
  sseClient.send(chunk);
});

for await (const chunk of llmStream) rehydrator.push(chunk);
rehydrator.flush();
```

New exports: `createStreamRehydrator`, type `StreamRehydrator`. Defensive: a `null` or empty manifest is a zero-buffer passthrough; a malformed manifest entry that would throw in `rehydrate()` is caught so the stream never aborts mid-flight.
