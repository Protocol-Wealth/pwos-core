// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * PII scanner — orchestrates the 4-layer pipeline:
 *
 *   1. Regex (deterministic)
 *   2. Optional NER provider (caller-supplied; Protocol supports local
 *      models like Gemma, hosted models, or cloud PII services)
 *   3. Financial recognizers (context-aware)
 *   4. Allow-list filter
 *
 * The scan produces sanitized text plus a manifest. The manifest can be
 * stored alongside the sanitized output; feeding the manifest back through
 * `rehydrate()` restores the original content for advisor-side display.
 */

import { AllowList, isAllowed as defaultIsAllowed } from "./allowList.js";
import { detectFinancial, type DocumentContext } from "./financialRecognizers.js";
import { detectRegex, type DetectedEntity } from "./regexPatterns.js";

// ─── Manifest types ─────────────────────────────────────────────────

export interface PlaceholderEntry {
  placeholder: string;
  original: string;
  entityType: string;
  start: number;
  end: number;
  score: number;
}

export interface RedactionManifest {
  version: string;
  redactionId: string;
  placeholders: PlaceholderEntry[];
  stats: {
    entitiesFound: number;
    entitiesByType: Record<string, number>;
    textLengthOriginal: number;
    textLengthSanitized: number;
  };
}

export interface ScanResult {
  hasPII: boolean;
  entities: DetectedEntity[];
  categories: string[];
  sanitizedText: string;
  manifest: RedactionManifest;
}

// ─── NER provider ────────────────────────────────────────────────────

/** Optional Layer 2: named entity recognition. Pass in a model of your choice. */
export type NerDetector = (text: string) => DetectedEntity[] | Promise<DetectedEntity[]>;

// ─── Scanner options ────────────────────────────────────────────────

export interface ScanOptions {
  context?: DocumentContext;
  /** Optional NER detector. When omitted, Layer 2 is skipped. */
  ner?: NerDetector;
  /** Override the default allow-list. */
  allowList?: AllowList;
}

// ─── Entity merge ───────────────────────────────────────────────────

function mergeEntities(entities: DetectedEntity[]): DetectedEntity[] {
  if (entities.length === 0) return [];

  // Sort by start, then by descending score, then prefer regex > financial > ner.
  const sorted = [...entities].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    if (a.score !== b.score) return b.score - a.score;
    const order = { regex: 0, financial: 1, ner: 2 } as const;
    return (order[a.source] ?? 2) - (order[b.source] ?? 2);
  });

  const result: DetectedEntity[] = [];
  let lastEnd = -1;
  for (const entity of sorted) {
    if (entity.start >= lastEnd) {
      result.push(entity);
      lastEnd = entity.end;
    } else if (entity.score > (result[result.length - 1]?.score ?? 0)) {
      result[result.length - 1] = entity;
      lastEnd = entity.end;
    }
  }
  return result;
}

// ─── Random ID helper (Web Crypto first, Node fallback) ─────────────

function shortId(): string {
  // `crypto` is globalThis in modern Node (>=19) and browsers.
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID().slice(0, 8);
  // Fallback — not cryptographically strong but OK for non-security IDs.
  return Math.random().toString(36).slice(2, 10);
}

// ─── Public scan ────────────────────────────────────────────────────

/**
 * Scan text and return sanitized output + rehydration manifest.
 *
 * Returns a Promise because the NER provider may be async. When no NER
 * provider is configured, the promise resolves synchronously on next tick.
 */
export async function scan(input: string, opts: ScanOptions = {}): Promise<ScanResult> {
  const context = opts.context ?? "general";
  const allow = opts.allowList;

  // Normalize Unicode — prevents bypass via decomposed forms.
  const text = input.normalize("NFC");

  // Layer 1: deterministic regex
  const regexEntities = detectRegex(text);

  // Layer 2: optional NER
  const nerEntities = opts.ner ? await Promise.resolve(opts.ner(text)) : [];

  // Layer 3: context-aware financial recognizers
  const financialEntities = detectFinancial(text, context);

  const allEntities = mergeEntities([...regexEntities, ...nerEntities, ...financialEntities]);

  // Layer 4: allow-list filter
  const allowFn = allow ? (t: string) => allow.isAllowed(t) : defaultIsAllowed;
  const filtered = allEntities.filter((e) => !allowFn(e.text));

  // Build placeholders
  const typeCounters = new Map<string, number>();
  const placeholderMap = new Map<string, string>();
  const entries: PlaceholderEntry[] = [];

  for (const entity of filtered) {
    let placeholder = placeholderMap.get(entity.text);
    if (!placeholder) {
      const count = (typeCounters.get(entity.entityType) ?? 0) + 1;
      typeCounters.set(entity.entityType, count);
      placeholder = `<${entity.entityType}_${count}>`;
      placeholderMap.set(entity.text, placeholder);
    }
    entries.push({
      placeholder,
      original: entity.text,
      entityType: entity.entityType,
      start: entity.start,
      end: entity.end,
      score: entity.score,
    });
  }

  // Build sanitized text — replace end-to-start to preserve positions.
  let sanitized = text;
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    sanitized = sanitized.slice(0, entry.start) + entry.placeholder + sanitized.slice(entry.end);
  }

  const entitiesByType: Record<string, number> = {};
  for (const entry of entries) {
    entitiesByType[entry.entityType] = (entitiesByType[entry.entityType] ?? 0) + 1;
  }

  const manifest: RedactionManifest = {
    version: "1.0",
    redactionId: `red_${shortId()}`,
    placeholders: entries,
    stats: {
      entitiesFound: entries.length,
      entitiesByType,
      textLengthOriginal: text.length,
      textLengthSanitized: sanitized.length,
    },
  };

  const categories = [...new Set(entries.map((e) => e.entityType))];

  return {
    hasPII: entries.length > 0,
    entities: filtered,
    categories,
    sanitizedText: sanitized,
    manifest,
  };
}

// ─── Rehydrate ──────────────────────────────────────────────────────

const VALID_PLACEHOLDER = /^<[A-Z][A-Z_]*_\d+>$/;
const MAX_ORIGINAL_LENGTH = 1_000;

/**
 * Replace placeholders in sanitized text with their original values.
 *
 * Validates every entry before substitution — throws if a placeholder was
 * tampered with or an original exceeds the max length guard.
 */
export function rehydrate(text: string, manifest: RedactionManifest): string {
  let result = text;
  for (const entry of manifest.placeholders) {
    if (!VALID_PLACEHOLDER.test(entry.placeholder)) {
      throw new Error(`Invalid placeholder format: ${entry.placeholder}`);
    }
    if (entry.original.length > MAX_ORIGINAL_LENGTH) {
      throw new Error("Original value exceeds maximum length");
    }
    result = result.replaceAll(entry.placeholder, entry.original);
  }
  return result;
}
