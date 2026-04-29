// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * Streaming PII rehydrator. Wraps a downstream callback so each
 * streamed chunk has `<TYPE_N>` placeholders swapped back to the
 * original values from a {@link RedactionManifest} before the chunk
 * reaches the consumer.
 *
 * Problem this solves:
 *   A placeholder may arrive split across two chunks. If a naive
 *   replace runs per-chunk, the consumer sees garbled output like
 *   `"The <NA"` then `"ME_1> is important"` instead of the rehydrated
 *   name. We have to buffer the tail of each chunk until we're sure
 *   it doesn't contain a partial placeholder, emit the safe prefix,
 *   and keep the uncertain tail for the next chunk.
 *
 * Algorithm:
 *   1. Append the incoming chunk to the pending buffer.
 *   2. Find the index of the last `<` in the buffer.
 *   3. If no `<`, or if the `<` is followed by a complete `>` within
 *      the max-placeholder body length, everything is safe to emit.
 *   4. Otherwise, emit everything up to (but not including) the
 *      last `<`, and buffer from `<` onward for the next chunk.
 *   5. If the body since `<` already exceeds the max placeholder
 *      length, the `<` wasn't a placeholder opener after all — emit
 *      everything.
 *   6. On stream end (`flush`), emit whatever is in pending as-is —
 *      a truncated stream showing `"<NA"` is less wrong than silently
 *      dropping trailing output.
 */

import { rehydrate, type RedactionManifest } from "./scanner.js";

/**
 * Max placeholder body length we ever expect from {@link scan}.
 * Format is `<TYPE_NNN>` — 40 chars is generous: a 20+ char type
 * string + triple-digit index + brackets.
 */
const MAX_PLACEHOLDER_BODY_LENGTH = 40;

export interface StreamRehydrator {
  /**
   * Feed a chunk. May invoke the downstream callback synchronously
   * zero or more times.
   */
  push(chunk: string): void;
  /**
   * Flush any remaining buffered content. Call on stream end. May
   * invoke the downstream callback once with the pending tail. After
   * `flush()`, the rehydrator should not be used again.
   */
  flush(): void;
}

/**
 * Create a stream rehydrator. `downstream` receives rehydrated,
 * placeholder-free text. When `manifest` is null or empty, chunks
 * pass through unchanged with zero buffering — useful when the scan
 * found no PII or the manifest couldn't be loaded (degraded mode).
 *
 * @example
 * const rehydrator = createStreamRehydrator(manifest, (chunk) => {
 *   sseClient.send(chunk);
 * });
 *
 * for await (const chunk of llmStream) rehydrator.push(chunk);
 * rehydrator.flush();
 */
export function createStreamRehydrator(
  manifest: RedactionManifest | null,
  downstream: (text: string) => void,
): StreamRehydrator {
  // Short-circuit: no manifest → no-op wrapper. Still buffer-free.
  if (!manifest || manifest.placeholders.length === 0) {
    return {
      push: (chunk: string) => downstream(chunk),
      flush: () => {},
    };
  }

  let pending = "";

  return {
    push(chunk: string): void {
      pending += chunk;
      // Locate the last `<` in the buffer. If everything after it
      // already has a `>` AND the shape is plausible, emit all. If
      // not, we might be mid-placeholder — hold from the last `<`.
      const lastOpen = pending.lastIndexOf("<");
      let emitUpTo: number;
      if (lastOpen === -1) {
        emitUpTo = pending.length;
      } else {
        const closeAfterOpen = pending.indexOf(">", lastOpen);
        if (closeAfterOpen !== -1) {
          const bodyLen = closeAfterOpen - lastOpen;
          if (bodyLen <= MAX_PLACEHOLDER_BODY_LENGTH) {
            emitUpTo = closeAfterOpen + 1;
          } else {
            // `<` followed by `>` way too far out → not a placeholder.
            emitUpTo = pending.length;
          }
        } else {
          // `<` with no `>` yet — might be a partial placeholder. Hold.
          // Guard: if the body since `<` already exceeds the max, the
          // `<` wasn't an opener. Emit everything.
          const sinceOpen = pending.length - lastOpen;
          if (sinceOpen > MAX_PLACEHOLDER_BODY_LENGTH) {
            emitUpTo = pending.length;
          } else {
            emitUpTo = lastOpen;
          }
        }
      }
      if (emitUpTo > 0) {
        const safe = pending.slice(0, emitUpTo);
        pending = pending.slice(emitUpTo);
        downstream(applyManifest(safe, manifest));
      }
    },
    flush(): void {
      if (pending.length > 0) {
        // Apply manifest one last time in case `pending` does contain
        // a complete placeholder we were holding.
        downstream(applyManifest(pending, manifest));
        pending = "";
      }
    },
  };
}

/**
 * Apply manifest to a chunk. Wraps {@link rehydrate} with a defensive
 * try/catch so a malformed manifest entry never crashes the stream.
 * On error the original (placeholder-bearing) text is returned —
 * better than dropping content silently mid-stream.
 */
function applyManifest(text: string, manifest: RedactionManifest): string {
  try {
    return rehydrate(text, manifest);
  } catch {
    return text;
  }
}
