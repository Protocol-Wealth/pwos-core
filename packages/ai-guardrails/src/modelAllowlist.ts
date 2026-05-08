// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Model-string allowlist.
 *
 * Why: hardcoding `"claude-opus-4-5"` (or any other vendor model id)
 * across an application makes upgrades brittle and correlation across
 * incidents painful. Worse, a dev who pastes a recent model id from a
 * blog post can introduce a model the firm hasn't approved for client
 * data. The allowlist pattern fixes both:
 *
 *   - Application code references *aliases* (FRONTIER / WORKHORSE / …),
 *     never literals.
 *   - Aliases resolve to ids via environment variables at boot —
 *     `CLAUDE_MODEL_FRONTIER=claude-opus-4-7` etc.
 *   - The resolver throws on an unknown alias, on an unset env var, or
 *     on an env value that doesn't match the configured prefix allowlist.
 *
 * Pair this with a CI lint (regex over source) to forbid model-id
 * literals outside the allowlist module.
 */

import type { ModelAlias } from "./types.js";

export class UnknownModelAliasError extends Error {
  readonly alias: string;
  constructor(alias: string, known: readonly string[]) {
    super(
      `Unknown model alias "${alias}". Known aliases: ${known.join(", ") || "<none configured>"}.`
    );
    this.name = "UnknownModelAliasError";
    this.alias = alias;
  }
}

export class ModelEnvUnsetError extends Error {
  readonly alias: string;
  readonly envVar: string;
  constructor(alias: string, envVar: string) {
    super(
      `Model alias "${alias}" requires env var ${envVar} to be set. Refusing to fall back to a literal.`
    );
    this.name = "ModelEnvUnsetError";
    this.alias = alias;
    this.envVar = envVar;
  }
}

export class ModelPrefixViolationError extends Error {
  readonly alias: string;
  readonly value: string;
  readonly allowedPrefixes: readonly string[];
  constructor(alias: string, value: string, allowedPrefixes: readonly string[]) {
    super(
      `Model alias "${alias}" resolved to "${value}" which does not match any allowed prefix (${allowedPrefixes.join(", ")}).`
    );
    this.name = "ModelPrefixViolationError";
    this.alias = alias;
    this.value = value;
    this.allowedPrefixes = allowedPrefixes;
  }
}

export interface ModelAllowlistConfig {
  /**
   * Map from alias to env-var name. Example:
   *   { FRONTIER: "CLAUDE_MODEL_FRONTIER", WORKHORSE: "CLAUDE_MODEL_WORKHORSE" }
   */
  aliases: Record<ModelAlias, string>;
  /**
   * Allowed prefixes for resolved model ids. Resolved values must match at
   * least one prefix. Example: `["claude-"]` to refuse non-Anthropic ids.
   * Empty array disables prefix checking.
   */
  allowedPrefixes?: readonly string[];
  /** Optional override env source for tests. Defaults to `process.env`. */
  envSource?: Record<string, string | undefined>;
}

export interface ModelResolver {
  /** Resolve an alias to its model id. Throws on unknown / unset / prefix-violating. */
  resolve(alias: ModelAlias): string;
  /** List configured aliases. */
  aliases(): readonly ModelAlias[];
  /** Inspect the resolved id without throwing; returns null if unresolved. */
  tryResolve(alias: ModelAlias): string | null;
}

export function createModelResolver(
  config: ModelAllowlistConfig
): ModelResolver {
  const env =
    config.envSource ??
    (typeof process !== "undefined" ? process.env : ({} as Record<string, string | undefined>));
  const allowedPrefixes = config.allowedPrefixes ?? [];

  function resolve(alias: ModelAlias): string {
    const envVar = config.aliases[alias];
    if (!envVar) {
      throw new UnknownModelAliasError(
        String(alias),
        Object.keys(config.aliases)
      );
    }
    const value = env[envVar];
    if (!value) {
      throw new ModelEnvUnsetError(String(alias), envVar);
    }
    if (
      allowedPrefixes.length > 0 &&
      !allowedPrefixes.some((p) => value.startsWith(p))
    ) {
      throw new ModelPrefixViolationError(String(alias), value, allowedPrefixes);
    }
    return value;
  }

  function tryResolve(alias: ModelAlias): string | null {
    try {
      return resolve(alias);
    } catch {
      return null;
    }
  }

  function aliases(): readonly ModelAlias[] {
    return Object.keys(config.aliases) as ModelAlias[];
  }

  return { resolve, aliases, tryResolve };
}
