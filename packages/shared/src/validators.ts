import { z } from 'zod';

export const chatRequestSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().min(1).max(100_000),
  model: z.string().optional(),
  systemPrompt: z.string().max(50_000).optional(),
  projectId: z.string().uuid().optional(),
});

export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  systemPrompt: z.string().max(50_000).optional(),
  modelOverride: z.string().optional(),
  visibility: z.enum(['private', 'team']).default('private'),
});

export const updateSettingsSchema = z.object({
  piiGuardMode: z.enum(['off', 'warn', 'block', 'redact']).optional(),
  modelPreference: z.string().optional(),
  name: z.string().min(1).max(200).optional(),
});
