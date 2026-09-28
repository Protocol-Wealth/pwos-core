// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Optional HTTP adapter for a chat-completions-compatible endpoint.
 * Nothing calls the endpoint until an adopter explicitly runs live evals.
 * The endpoint, model, and credential are supplied by the caller.
 */

import type { ModelInvoke } from "./types.js";

/** Connection settings for an adopter-owned chat completions endpoint. */
export interface HttpChatCompletionsOptions {
  readonly endpoint: string;
  readonly model: string;
  readonly apiKey?: string;
  /** Injection point for hermetic tests or custom HTTP clients. */
  readonly fetchImpl?: typeof fetch;
}

/** Create a model callback compatible with `runEvals({ live: true })`. */
export function createHttpChatCompletionsInvoke(options: HttpChatCompletionsOptions): ModelInvoke {
  if (!options.endpoint || !options.model) {
    throw new Error("HTTP eval adapter requires an endpoint and model.");
  }
  const endpoint = new URL(options.endpoint);
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password) {
    throw new Error("HTTP eval adapter requires an HTTPS endpoint without URL credentials.");
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  return async ({ prompt, system }) => {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      redirect: "error",
      headers: {
        "content-type": "application/json",
        ...(options.apiKey ? { authorization: `Bearer ${options.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: options.model,
        messages: [
          ...(system ? [{ role: "system", content: system }] : []),
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });

    // Do not include response bodies in errors: providers may echo prompts.
    if (!response.ok) throw new Error(`HTTP eval adapter request failed (${response.status}).`);

    const payload: unknown = await response.json();
    const first = isRecord(payload) && Array.isArray(payload.choices) ? payload.choices[0] : undefined;
    const message = isRecord(first) ? first.message : undefined;
    const content = isRecord(message) ? message.content : undefined;
    if (typeof content !== "string") {
      throw new Error("HTTP eval adapter expected choices[0].message.content to be a string.");
    }
    return content;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
