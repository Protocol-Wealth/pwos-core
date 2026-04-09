import type { LLMModel } from './types.js';

export const MODELS: LLMModel[] = [
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', provider: 'anthropic', supportsTools: true, costPerMInput: 3, costPerMOutput: 15 },
  { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', provider: 'anthropic', supportsTools: true, costPerMInput: 5, costPerMOutput: 25 },
  { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', provider: 'anthropic', supportsTools: true, costPerMInput: 0.8, costPerMOutput: 4 },
  { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'openai', supportsTools: true, costPerMInput: 2, costPerMOutput: 8 },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google', supportsTools: true, costPerMInput: 1.25, costPerMOutput: 10 },
];

export const DEFAULT_MODEL = 'claude-sonnet-4-6';
export const USER_ROLES = ['admin', 'partner', 'user', 'intern'] as const;
export const PII_MODES = ['off', 'warn', 'block', 'redact'] as const;
