// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * Tool registry — central catalog of available MCP tools.
 *
 * The registry enforces uniqueness of tool names, supports tag filtering,
 * and produces filtered views by tier or tag. It does not invoke tools —
 * that's the caller's job once they pick a definition from the registry.
 */

import { isAuthorizedFor } from "./tier.js";
import type { ToolDefinition } from "./types.js";
import { ToolTier } from "./types.js";

/** Error raised when two tools share a name — names must be unique. */
export class ToolNameConflictError extends Error {
  constructor(public readonly name: string) {
    super(`Duplicate tool name: "${name}"`);
    this.name = "ToolNameConflictError";
  }
}

/** Error raised when looking up a tool that isn't registered. */
export class ToolNotFoundError extends Error {
  constructor(public readonly toolName: string) {
    super(`Tool not registered: "${toolName}"`);
    this.name = "ToolNotFoundError";
  }
}

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();

  /** Register a tool. Throws on name conflict. */
  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new ToolNameConflictError(tool.name);
    }
    this.tools.set(tool.name, { ...tool });
  }

  /** Register many tools at once. Stops on first conflict. */
  registerAll(tools: Iterable<ToolDefinition>): void {
    for (const t of tools) this.register(t);
  }

  /** Replace an existing registration (same name) or add a new one. */
  upsert(tool: ToolDefinition): void {
    this.tools.set(tool.name, { ...tool });
  }

  /** True iff a tool with the given name is registered. */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /** Look up a tool by name. Throws if not found. */
  get(name: string): ToolDefinition {
    const tool = this.tools.get(name);
    if (!tool) throw new ToolNotFoundError(name);
    return tool;
  }

  /** Look up a tool by name. Returns undefined if not found. */
  find(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /** Remove a tool. Returns whether it existed. */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /** Snapshot of all tools in registration order. */
  list(): ToolDefinition[] {
    return [...this.tools.values()];
  }

  /** Tools visible to the given access tier (respects privilege hierarchy). */
  listForTier(grantedTier: ToolTier): ToolDefinition[] {
    return this.list().filter((t) =>
      isAuthorizedFor(grantedTier, t.tier ?? ToolTier.PUBLIC),
    );
  }

  /** Tools matching *all* of the given tags (logical AND). */
  listByTags(requiredTags: Iterable<string>): ToolDefinition[] {
    const required = new Set(requiredTags);
    if (required.size === 0) return this.list();
    return this.list().filter((t) => {
      const tags = new Set(t.tags ?? []);
      for (const tag of required) if (!tags.has(tag)) return false;
      return true;
    });
  }

  /** How many tools are registered. */
  get size(): number {
    return this.tools.size;
  }
}
