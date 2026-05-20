// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * LLMClient interface — injection point so the demo can run hermetically
 * in tests (mocked client) and demonstrably against real infrastructure
 * (AnthropicLLMClient wrapping the official SDK).
 *
 * The interface is intentionally narrow — request a single non-streaming
 * completion against a system + user prompt; receive a structured response
 * with content blocks + token usage. Production agent runtimes layer
 * additional concerns on top (streaming, tool use, retries, prompt
 * caching); those layers are out of scope for the reference example.
 */

import type { ResponseLike } from "@protocolwealthos/ai-guardrails";

export interface LLMCallRequest {
  /** Model identifier — e.g., "claude-haiku-4-5-20251001". */
  readonly model: string;
  /** System prompt composed from the three-tier agent context. */
  readonly system: string;
  /** Single user message (advisor's prompt to the agent). */
  readonly userMessage: string;
  /** Hard cap on response length. */
  readonly maxTokens: number;
}

export interface LLMCallResult {
  /** Plain-text response body extracted from the content blocks. */
  readonly text: string;
  /** Full response shape (used downstream for hash-based audit-row construction). */
  readonly raw: ResponseLike;
  /** Latency in milliseconds from request-start to response-complete. */
  readonly latencyMs: number;
}

export interface LLMClient {
  call(request: LLMCallRequest): Promise<LLMCallResult>;
}

/**
 * Production LLMClient wrapping the official @anthropic-ai/sdk.
 *
 * Configuration: the SDK reads ANTHROPIC_API_KEY from the environment by
 * default; pass an explicit apiKey via options for ergonomics-by-injection
 * in non-environment-variable contexts. The workspace assertion lives in
 * `@protocolwealthos/ai-guardrails/assertWorkspaceFromEnv` — production
 * consumers MUST call it at boot before instantiating the client.
 */
export class AnthropicLLMClient implements LLMClient {
  private readonly anthropic: AnthropicLike;

  constructor(opts?: AnthropicLLMClientOptions) {
    const Ctor = opts?.AnthropicCtor;
    if (Ctor) {
      this.anthropic = new Ctor(opts?.clientOpts);
      return;
    }
    // Lazy-import the SDK so callers without @anthropic-ai/sdk installed
    // can still consume the interface (tests, mocks). When the SDK isn't
    // present and AnthropicCtor isn't provided, instantiation throws.
    throw new Error(
      "AnthropicLLMClient requires the @anthropic-ai/sdk Anthropic class via opts.AnthropicCtor. " +
        "Install @anthropic-ai/sdk and pass `new AnthropicLLMClient({ AnthropicCtor: Anthropic })`.",
    );
  }

  async call(request: LLMCallRequest): Promise<LLMCallResult> {
    const start = Date.now();
    const response = (await this.anthropic.messages.create({
      model: request.model,
      max_tokens: request.maxTokens,
      system: request.system,
      messages: [{ role: "user", content: request.userMessage }],
    })) as ResponseLike;
    const latencyMs = Date.now() - start;
    const text = extractText(response);
    return { text, raw: response, latencyMs };
  }
}

/**
 * Structural type for the Anthropic SDK's client — captures only the
 * shape this example needs. Avoids a hard dependency on the SDK at the
 * type level while keeping the constructor + .messages.create surface
 * type-checked at the call site.
 */
export interface AnthropicLike {
  messages: {
    create(args: {
      model: string;
      max_tokens: number;
      system: string;
      messages: ReadonlyArray<{ role: "user" | "assistant"; content: string }>;
    }): Promise<unknown>;
  };
}

interface AnthropicConstructable {
  new (opts?: unknown): AnthropicLike;
}

export interface AnthropicLLMClientOptions {
  /** Inject the Anthropic class — typically `new AnthropicLLMClient({ AnthropicCtor: Anthropic })`. */
  readonly AnthropicCtor?: AnthropicConstructable;
  /** Options passed to the Anthropic constructor (e.g., `{ apiKey: ... }`). */
  readonly clientOpts?: unknown;
}

function extractText(response: ResponseLike): string {
  if (!Array.isArray(response.content)) return "";
  const parts: string[] = [];
  for (const block of response.content) {
    if (
      block &&
      typeof block === "object" &&
      (block as { type?: unknown }).type === "text" &&
      typeof (block as { text?: unknown }).text === "string"
    ) {
      parts.push((block as { text: string }).text);
    }
  }
  return parts.join("\n");
}
