/**
 * Prompt injection detection — 23 patterns across 6 categories.
 * Apache 2.0 — Protocol Wealth LLC
 */

interface InjectionPattern { regex: RegExp; weight: number; category: string; }

const INJECTION_THRESHOLD = 0.7;

const INJECTION_PATTERNS: InjectionPattern[] = [
  { regex: /ignore\s+(?:all\s+)?(?:previous|prior|above|earlier)\s+instructions?/i, weight: 0.95, category: 'override' },
  { regex: /ignore\s+your\s+instructions?/i, weight: 0.95, category: 'override' },
  { regex: /disregard\s+(?:all\s+)?(?:previous|prior|above|your)\s+(?:instructions?|rules?|guidelines?)/i, weight: 0.90, category: 'override' },
  { regex: /(?:forget|drop|dismiss)\s+(?:all\s+)?(?:previous|prior|your)\s+(?:instructions?|context|rules?)/i, weight: 0.90, category: 'override' },
  { regex: /do\s+not\s+follow\s+(?:any\s+)?(?:previous|prior|your)\s+(?:instructions?|rules?)/i, weight: 0.90, category: 'override' },
  { regex: /(?:act|behave|respond)\s+as\s+if\s+you/i, weight: 0.80, category: 'identity' },
  { regex: /(?:pretend|imagine|suppose)\s+(?:that\s+)?you\s+are/i, weight: 0.80, category: 'identity' },
  { regex: /you\s+are\s+now\s+(?:a\s+)?(?:new|different|unrestricted)/i, weight: 0.85, category: 'identity' },
  { regex: /\bDAN\b/, weight: 0.60, category: 'identity' },
  { regex: /do\s+anything\s+now/i, weight: 0.85, category: 'identity' },
  { regex: /(?:reveal|show|display|print|output|repeat)\s+(?:your|the|my)\s+(?:system\s+)?(?:prompt|instructions?|rules?)/i, weight: 0.85, category: 'extraction' },
  { regex: /what\s+(?:are|were)\s+your\s+(?:original\s+)?(?:instructions?|rules?|guidelines?)/i, weight: 0.80, category: 'extraction' },
  { regex: /(?:show|give|tell)\s+me\s+your\s+(?:system\s+)?(?:prompt|instructions?|rules?)/i, weight: 0.85, category: 'extraction' },
  { regex: /\b(?:system\s*prompt|override|bypass|jailbreak)\b/i, weight: 0.50, category: 'keywords' },
  { regex: /\b(?:injection|exploit|payload)\s*(?:test|attempt|attack)\b/i, weight: 0.40, category: 'keywords' },
  { regex: /i\s+g\s+n\s+o\s+r\s+e/i, weight: 0.75, category: 'obfuscated' },
  { regex: /(?:1gn0r3|ign0re|1gnore)\s+(?:previous|prior|your|all)/i, weight: 0.80, category: 'obfuscated' },
  { regex: /new\s+(?:session|conversation|chat|context)\s*[:\-]/i, weight: 0.70, category: 'roleplay' },
  { regex: /(?:###|===)\s*(?:system|instruction|new\s+prompt)/i, weight: 0.85, category: 'roleplay' },
  { regex: /\[(?:system|instruction|INST)\]/i, weight: 0.80, category: 'roleplay' },
  { regex: /<\|(?:im_start|im_end|system|endoftext)\|>/, weight: 0.90, category: 'delimiter' },
  { regex: /```\s*system\b/i, weight: 0.70, category: 'delimiter' },
];

export interface InjectionResult {
  isSuspicious: boolean;
  injectionScore: number;
  detectedPatterns: { pattern: string; weight: number; category: string }[];
}

export function detectInjection(text: string): InjectionResult {
  const detectedPatterns: InjectionResult['detectedPatterns'] = [];
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.regex.test(text)) {
      detectedPatterns.push({ pattern: pattern.regex.source, weight: pattern.weight, category: pattern.category });
    }
  }
  const injectionScore = detectedPatterns.length > 0 ? Math.max(...detectedPatterns.map(p => p.weight)) : 0;
  return { isSuspicious: injectionScore >= INJECTION_THRESHOLD, injectionScore, detectedPatterns };
}
