// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * Prompt-injection detection.
 *
 * Scans input text for the common patterns of LLM prompt-injection attacks:
 * override instructions ("ignore previous"), identity manipulation ("pretend
 * you are"), prompt extraction ("reveal your system prompt"), encoded or
 * obfuscated variants, and delimiter/context markers.
 *
 * The score returned is the *max* weight of any matched pattern — a single
 * strong signal is enough to raise suspicion. Tune the threshold downstream
 * based on your false-positive tolerance.
 */

interface InjectionPattern {
  regex: RegExp;
  weight: number;
  category: string;
}

/** Score >= threshold → treat input as suspicious. */
export const DEFAULT_INJECTION_THRESHOLD = 0.7;

const INJECTION_PATTERNS: InjectionPattern[] = [
  // Instruction override
  { regex: /ignore\s+(?:all\s+)?(?:previous|prior|above|earlier)\s+instructions?/i, weight: 0.95, category: "override" },
  { regex: /ignore\s+your\s+instructions?/i, weight: 0.95, category: "override" },
  {
    regex: /disregard\s+(?:all\s+)?(?:previous|prior|above|your)\s+(?:instructions?|rules?|guidelines?)/i,
    weight: 0.9,
    category: "override",
  },
  {
    regex: /(?:forget|drop|dismiss)\s+(?:all\s+)?(?:previous|prior|your)\s+(?:instructions?|context|rules?)/i,
    weight: 0.9,
    category: "override",
  },
  {
    regex: /do\s+not\s+follow\s+(?:any\s+)?(?:previous|prior|your)\s+(?:instructions?|rules?)/i,
    weight: 0.9,
    category: "override",
  },

  // Identity manipulation
  { regex: /(?:act|behave|respond)\s+as\s+if\s+you/i, weight: 0.8, category: "identity" },
  { regex: /(?:pretend|imagine|suppose)\s+(?:that\s+)?you\s+are/i, weight: 0.8, category: "identity" },
  { regex: /you\s+are\s+now\s+(?:a\s+)?(?:new|different|unrestricted)/i, weight: 0.85, category: "identity" },
  { regex: /\bDAN\b/, weight: 0.6, category: "identity" },
  { regex: /do\s+anything\s+now/i, weight: 0.85, category: "identity" },

  // Prompt extraction
  {
    regex: /(?:reveal|show|display|print|output|repeat)\s+(?:your|the|my)\s+(?:system\s+)?(?:prompt|instructions?|rules?)/i,
    weight: 0.85,
    category: "extraction",
  },
  {
    regex: /what\s+(?:are|were)\s+your\s+(?:original\s+)?(?:instructions?|rules?|guidelines?)/i,
    weight: 0.8,
    category: "extraction",
  },
  {
    regex: /(?:show|give|tell)\s+me\s+your\s+(?:system\s+)?(?:prompt|instructions?|rules?)/i,
    weight: 0.85,
    category: "extraction",
  },

  // Keyword markers
  { regex: /\b(?:system\s*prompt|override|bypass|jailbreak)\b/i, weight: 0.5, category: "keywords" },
  { regex: /\b(?:injection|exploit|payload)\s*(?:test|attempt|attack)\b/i, weight: 0.4, category: "keywords" },

  // Encoded / obfuscated
  { regex: /i\s+g\s+n\s+o\s+r\s+e/i, weight: 0.75, category: "obfuscated" },
  { regex: /(?:1gn0r3|ign0re|1gnore)\s+(?:previous|prior|your|all)/i, weight: 0.8, category: "obfuscated" },

  // Role-play / persona
  { regex: /new\s+(?:session|conversation|chat|context)\s*[:\-]/i, weight: 0.7, category: "roleplay" },
  { regex: /(?:###|===)\s*(?:system|instruction|new\s+prompt)/i, weight: 0.85, category: "roleplay" },
  { regex: /\[(?:system|instruction|INST)\]/i, weight: 0.8, category: "roleplay" },

  // Delimiter / context manipulation
  { regex: /<\|(?:im_start|im_end|system|endoftext)\|>/, weight: 0.9, category: "delimiter" },
  { regex: /```\s*system\b/i, weight: 0.7, category: "delimiter" },
];

export interface InjectionDetection {
  pattern: string;
  weight: number;
  category: string;
}

export interface InjectionResult {
  isSuspicious: boolean;
  injectionScore: number;
  detectedPatterns: InjectionDetection[];
}

export interface DetectInjectionOptions {
  threshold?: number;
  additionalPatterns?: Iterable<{ regex: RegExp; weight: number; category: string }>;
}

/** Scan text for prompt-injection patterns. */
export function detectInjection(text: string, opts: DetectInjectionOptions = {}): InjectionResult {
  const threshold = opts.threshold ?? DEFAULT_INJECTION_THRESHOLD;
  const patterns = [...INJECTION_PATTERNS, ...(opts.additionalPatterns ?? [])];

  const detectedPatterns: InjectionDetection[] = [];

  for (const pattern of patterns) {
    if (pattern.regex.test(text)) {
      detectedPatterns.push({
        pattern: pattern.regex.source,
        weight: pattern.weight,
        category: pattern.category,
      });
    }
  }

  // Max weight — one strong signal is enough.
  const injectionScore =
    detectedPatterns.length > 0 ? Math.max(...detectedPatterns.map((p) => p.weight)) : 0;

  return {
    isSuspicious: injectionScore >= threshold,
    injectionScore,
    detectedPatterns,
  };
}
