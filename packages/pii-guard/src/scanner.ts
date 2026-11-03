// SPDX-License-Identifier: MIT-0 OR Apache-2.0
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
 *
 * Overlapping detections are merged to the union of their spans after the
 * allow-list filter. A higher score (then a longer span, then regex over
 * financial over ner) chooses the label only — it must not leave a
 * detected character unmasked. Adjacent spans stay separate.
 *
 * `sanitizedText` is the string safe to hand to a hosted model. Manifest
 * `original` values stay on the trusted side for rehydration. No detected
 * entities is not evidence that the input contained no sensitive data;
 * this scanner only masks what a configured detector flagged.
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

const SOURCE_RANK = { regex: 0, financial: 1, ner: 2 } as const;

function sourceRank(source: DetectedEntity["source"]): number {
  return SOURCE_RANK[source] ?? SOURCE_RANK.ner;
}

/**
 * Clamp a detector span onto `text`. Offsets are authoritative; the
 * returned text is always `text.slice(start, end)`. Non-finite or empty
 * spans are dropped. A fractional offset expands outward so a detector
 * cannot shed a partial character by using a non-integer bound.
 */
function clampEntity(entity: DetectedEntity, text: string): DetectedEntity | null {
  if (!Number.isFinite(entity.start) || !Number.isFinite(entity.end)) return null;
  const start = Math.max(0, Math.min(Math.floor(entity.start), text.length));
  const end = Math.max(start, Math.min(Math.ceil(entity.end), text.length));
  if (end <= start) return null;
  return { ...entity, start, end, text: text.slice(start, end) };
}

/**
 * Merge already allow-listed-filtered detections so the union of their
 * spans stays covered.
 *
 * Overlap is `start < currentEnd` (a shared edge is adjacency, not
 * overlap). The surviving label is the higher score, then the longer
 * original span. Equal score and equal length keep the earlier span in
 * start / score / source order, which prefers regex over financial over
 * ner when they start together.
 *
 * Coverage matches pw-redact-core `_merge_entities` (pw-redact-core#3,
 * pwos-core#125). This package does not copy a detection onto later
 * look-alike occurrences, and it keeps financial recognizers as their
 * own source instead of folding them into NER.
 */
function mergeEntities(entities: DetectedEntity[], text: string): DetectedEntity[] {
  const sorted = entities
    .map((entity) => clampEntity(entity, text))
    .filter((entity): entity is DetectedEntity => entity !== null)
    .sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      if (a.score !== b.score) return b.score - a.score;
      const bySource = sourceRank(a.source) - sourceRank(b.source);
      if (bySource !== 0) return bySource;
      return b.end - b.start - (a.end - a.start);
    });

  type Group = { start: number; end: number; best: DetectedEntity };
  const groups: Group[] = [];
  for (const entity of sorted) {
    const last = groups[groups.length - 1];
    if (last && entity.start < last.end) {
      const longer = entity.end - entity.start > last.best.end - last.best.start;
      if (entity.score > last.best.score || (entity.score === last.best.score && longer)) {
        last.best = entity;
      }
      if (entity.end > last.end) last.end = entity.end;
    } else {
      groups.push({ start: entity.start, end: entity.end, best: entity });
    }
  }

  return groups.map((group) => ({
    entityType: group.best.entityType,
    text: text.slice(group.start, group.end),
    start: group.start,
    end: group.end,
    score: group.best.score,
    source: group.best.source,
  }));
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
 *
 * The result masks the union of detections that survived the allow-list.
 * It is a best-effort detector, not a proof that `input` was free of
 * sensitive data. Do not send `manifest` (it holds original values) to
 * a hosted model; send `sanitizedText`.
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

  // Layer 4 runs before the merge. An allow-listed span must not absorb
  // or suppress a real detection that overlaps it, and it must not be
  // pulled into a neighboring mask just because the spans touch.
  const allowFn = allow ? (t: string) => allow.isAllowed(t) : defaultIsAllowed;
  const protectedEntities = [...regexEntities, ...nerEntities, ...financialEntities].filter(
    (entity) => !allowFn(entity.text),
  );
  const filtered = mergeEntities(protectedEntities, text);

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
