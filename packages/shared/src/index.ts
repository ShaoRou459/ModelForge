// Shared types and utilities for ModelForge

export type UUID = string;

export type ProviderAdapterType = 'openai_compat' | 'anthropic' | 'gemini' | 'custom_http';

export interface Provider {
  id: UUID;
  name: string;
  adapter: ProviderAdapterType;
  baseUrl: string;
  defaultModel?: string;
  createdAt: number; // epoch ms
}

export interface ModelConfig {
  id: UUID;
  providerId: UUID;
  label: string;
  modelId: string;
  settings?: Record<string, unknown>;
}

export type ProblemType = 'text' | 'html';

export interface ProblemSet {
  id: UUID;
  name: string;
  description?: string;
  createdAt: number;
}

export interface Problem {
  id: UUID;
  problemSetId: UUID;
  type: ProblemType;
  prompt: string;
  expectedAnswer?: string;
  htmlAssets?: {
    html?: string;
    css?: string;
    js?: string;
  };
  scoring?: Record<string, unknown>;
}

export interface Run {
  id: UUID;
  problemSetId: UUID;
  judgeModelId: UUID;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: number;
}

export interface RunModel {
  id: UUID;
  runId: UUID;
  modelId: UUID;
}

export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  [k: string]: unknown;
}

export interface Submission {
  id: UUID;
  runId: UUID;
  problemId: UUID;
  modelId: UUID;
  request: unknown;
  response: unknown;
  latencyMs?: number;
  tokenUsage?: TokenUsage | null;
  cost?: number | null;
  createdAt: number;
}

export type Verdict = 'pass' | 'fail' | 'unknown';

export interface Judgment {
  id: UUID;
  submissionId: UUID;
  judgeModelId: UUID;
  verdict: Verdict;
  confidence?: number;
  rationale?: string;
  createdAt: number;
}

export interface ManualOverride {
  id: UUID;
  submissionId: UUID;
  verdict: Verdict;
  notes?: string;
  reviewer?: string;
  createdAt: number;
}

// Utility: simple UUID v4 placeholder for local generation (non-crypto for MVP)
export function genId(): UUID {
  // Not cryptographically secure; replace with crypto.randomUUID() when available on server.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    // eslint-disable-next-line no-mixed-operators
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}