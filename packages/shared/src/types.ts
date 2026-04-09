// ─── User ───
export type UserRole = 'admin' | 'partner' | 'user' | 'intern';
export type PIIGuardMode = 'off' | 'warn' | 'block' | 'redact';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: UserRole;
  piiGuardMode: PIIGuardMode;
  modelPreference: string;
  approved: boolean;
  createdAt: string;
}

export type ProjectVisibility = 'private' | 'team';
export type ProjectMemberRole = 'owner' | 'member' | 'viewer';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  systemPrompt: string | null;
  modelOverride: string | null;
  visibility: ProjectVisibility;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string;
  projectId: string | null;
  folderId: string | null;
  userId: string;
  title: string | null;
  model: string;
  forkedFrom: string | null;
  pinned: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  contentRedacted: string | null;
  model: string | null;
  toolCalls: unknown[] | null;
  tokensInput: number | null;
  tokensOutput: number | null;
  costUsd: number | null;
  createdAt: string;
}

export interface Agent {
  id: string;
  name: string;
  description: string | null;
  avatarEmoji: string;
  systemPrompt: string;
  model: string | null;
  toolsEnabled: string[];
  temperature: number;
  shared: boolean;
}

export type ApiResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface StreamChunk {
  type: 'text' | 'tool_use' | 'tool_result' | 'error' | 'done' | 'message_id';
  content?: string;
  id?: string;
  toolName?: string;
  toolInput?: unknown;
  durationMs?: number;
  usage?: { inputTokens: number; outputTokens: number };
  cost?: number;
}

export interface LLMModel {
  id: string;
  name: string;
  provider: 'local' | 'anthropic' | 'openai' | 'google';
  supportsTools: boolean;
  costPerMInput: number;
  costPerMOutput: number;
}
