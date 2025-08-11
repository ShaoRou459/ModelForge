import { z } from 'zod';

export const ProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  adapter: z.string(),
  base_url: z.string(),
  default_model: z.string().nullish(),
  created_at: z.number(),
  last_checked: z.number().nullable().optional(),
});
export type Provider = z.infer<typeof ProviderSchema>;

export async function getProviders(): Promise<Provider[]> {
  const res = await fetch('/api/providers');
  if (!res.ok) throw new Error('Failed to fetch providers');
  const json = await res.json();
  return z.array(ProviderSchema).parse(json);
}

// Models API
export const ModelSchema = z.object({
  id: z.string(),
  provider_id: z.string(),
  label: z.string(),
  model_id: z.string(),
  settings: z.any().nullable().optional(),
});
export type Model = z.infer<typeof ModelSchema>;

export async function listModels(providerId?: string): Promise<Model[]> {
  const url = providerId ? `/api/models?providerId=${encodeURIComponent(providerId)}` : '/api/models';
  const res = await fetch(url, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
  if (!res.ok) throw new Error('Failed to fetch models');
  const json = await res.json();
  return z.array(ModelSchema).parse(json);
}

export async function createModel(input: {
  providerId: string;
  label: string;
  modelId: string;
  settings?: Record<string, unknown>;
}): Promise<{ id: string }> {
  const res = await fetch('/api/models', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteProvider(id: string): Promise<void> {
  const res = await fetch(`/api/providers/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText);
  }
}

export async function updateProvider(id: string, input: {
  name?: string;
  adapter?: string;
  baseUrl?: string;
  apiKey?: string;
  defaultModel?: string;
}): Promise<void> {
  const res = await fetch(`/api/providers/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText);
  }
}

export async function updateModel(id: string, input: {
  label?: string;
  modelId?: string;
  settings?: Record<string, unknown>;
}): Promise<void> {
  const res = await fetch(`/api/models/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText);
  }
}

export async function deleteModel(id: string, cascade: boolean = false): Promise<void> {
  const url = cascade
    ? `/api/models/${encodeURIComponent(id)}?cascade=true`
    : `/api/models/${encodeURIComponent(id)}`;

  const res = await fetch(url, {
    method: 'DELETE',
  });

  if (!res.ok) {
    const errorText = await res.text();
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      throw new Error(errorText);
    }

    // Create a detailed error for model deletion conflicts
    if (res.status === 400 && errorData.blockingRuns) {
      const error = new Error(errorData.message) as any;
      error.details = errorData;
      throw error;
    }

    throw new Error(errorData.message || errorText);
  }
}

// Problem Sets API
export const ProblemSetSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  created_at: z.number(),
});
export type ProblemSet = z.infer<typeof ProblemSetSchema>;

export async function listProblemSets(): Promise<ProblemSet[]> {
  const res = await fetch('/api/problem-sets');
  if (!res.ok) throw new Error('Failed to fetch problem sets');
  const json = await res.json();
  return z.array(ProblemSetSchema).parse(json);
}

export async function createProblemSet(input: { name: string; description?: string }) {
  const res = await fetch('/api/problem-sets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ id: string }>;
}

export async function updateProblemSet(id: string, input: { name?: string; description?: string }) {
  const res = await fetch(`/api/problem-sets/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ id: string }>;
}

export async function deleteProblemSet(id: string) {
  const res = await fetch(`/api/problem-sets/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) throw new Error(await res.text());
}

// Problems API
export const ProblemSchema = z.object({
  id: z.string(),
  problem_set_id: z.string(),
  type: z.string(),
  prompt: z.string(),
  expected_answer: z.string().nullable().optional(),
  html_assets: z.string().nullable().optional(),
  scoring: z.string().nullable().optional(),
  created_at: z.number(),
});
export type Problem = z.infer<typeof ProblemSchema>;

export async function listProblems(problemSetId?: string): Promise<Problem[]> {
  const url = problemSetId ? `/api/problems?problemSetId=${encodeURIComponent(problemSetId)}` : '/api/problems';
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  return z.array(ProblemSchema).parse(json);
}

export async function createProblem(input: {
  problemSetId: string;
  type: 'text' | 'html';
  prompt: string;
  expectedAnswer?: string;
  htmlAssets?: { html?: string; css?: string; js?: string };
  scoring?: Record<string, unknown>;
}) {
  const res = await fetch('/api/problems', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ id: string }>;
}

export async function updateProblem(id: string, input: {
  type?: 'text' | 'html';
  prompt?: string;
  expectedAnswer?: string;
  htmlAssets?: { html?: string; css?: string; js?: string } | null;
  scoring?: Record<string, unknown> | null;
  problemSetId?: string;
}) {
  const res = await fetch(`/api/problems/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ id: string }>;
}

export async function deleteProblem(id: string) {
  const res = await fetch(`/api/problems/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) throw new Error(await res.text());
}

export async function createProvider(input: {
  name: string;
  adapter: string;
  baseUrl: string;
  apiKey?: string;
  defaultModel?: string;
}) {
  const res = await fetch('/api/providers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as { id: string };
}

/**
 * Test a provider connection by hitting the server-side /api/providers/:id/test endpoint.
 * Returns the parsed JSON response from the server which will contain { ok: true } on success.
 */
export async function testProvider(id: string): Promise<{ ok: boolean; status?: number; message?: string }> {
  const res = await fetch(`/api/providers/${encodeURIComponent(id)}/test`, {
    method: 'POST',
  });
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const json = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(json));
    return json;
  }
  const txt = await res.text().catch(() => '');
  if (!res.ok) throw new Error(txt || 'Provider test failed');
  try {
    return JSON.parse(txt);
  } catch {
    return { ok: true, status: res.status };
  }
}

// Runs API
export const RunSchema = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  problem_set_id: z.string(),
  model_ids: z.string(), // JSON string on server
  judge_model_id: z.string(),
  status: z.string(),
  created_at: z.number(),
  stream: z.number().optional(),
  cancelled_at: z.number().nullable().optional(),
  cancelled_by: z.string().nullable().optional(),
});
export type Run = z.infer<typeof RunSchema>;

export async function createRun(input: {
  name?: string;
  problemSetId: string;
  modelIds: string[];
  judgeModelId: string;
  stream?: boolean;
}): Promise<{ id: string }> {
  const res = await fetch('/api/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listRuns(params?: { status?: string; limit?: number; problemSetId?: string }): Promise<Run[]> {
  const q = new URLSearchParams();
  if (params?.status) q.set('status', params.status);
  if (params?.limit) q.set('limit', String(params.limit));
  if (params?.problemSetId) q.set('problemSetId', params.problemSetId);
  const res = await fetch(`/api/runs${q.toString() ? `?${q.toString()}` : ''}`);
  if (!res.ok) throw new Error('Failed to fetch runs');
  const json = await res.json();
  return z.array(RunSchema).parse(json);
}

export async function deleteRunsByProblemSet(problemSetId: string): Promise<{ deleted: number }> {
  const res = await fetch(`/api/runs?problemSetId=${encodeURIComponent(problemSetId)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function executeRun(id: string) {
  const res = await fetch(`/api/runs/${id}/execute`, { method: 'POST' });
  if (!res.ok && res.status !== 202) throw new Error(await res.text());
  return res.json().catch(() => ({}));
}

export async function cancelRun(id: string): Promise<{ id: string; status: string; cancelled: boolean }> {
  const res = await fetch(`/api/runs/${id}/cancel`, { method: 'POST' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function cancelModel(runId: string, modelId: string): Promise<{ runId: string; modelId: string; status: string; cancelled: boolean }> {
  const res = await fetch(`/api/runs/${runId}/models/${modelId}/cancel`, { method: 'POST' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const RunResultSchema = z.object({
  id: z.string(),
  run_id: z.string(),
  problem_id: z.string(),
  model_id: z.string(),
  output: z.string().nullable(),
  score: z.number().nullable(),
  status: z.string(),
  judged_by: z.string().nullable(),
  judge_reasoning: z.string().nullable(),
  created_at: z.number(),
  problem_type: z.string(),
  problem_prompt: z.string(),
});
export type RunResult = z.infer<typeof RunResultSchema>;

export async function getRunResults(id: string): Promise<RunResult[]> {
  const res = await fetch(`/api/runs/${id}/results`);
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  return z.array(RunResultSchema).parse(json);
}

// Review API - Problem Set Results
export const ProblemSetWithLatestRunSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  created_at: z.number(),
  latest_run_id: z.string().nullable(),
  latest_run_date: z.number().nullable(),
});
export type ProblemSetWithLatestRun = z.infer<typeof ProblemSetWithLatestRunSchema>;

export async function getProblemSetsWithLatestResults(): Promise<ProblemSetWithLatestRun[]> {
  const res = await fetch('/api/problem-sets/latest-results');
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  return z.array(ProblemSetWithLatestRunSchema).parse(json);
}

export const ModelPerformanceSchema = z.object({
  model_id: z.string(),
  model_name: z.string(),
  total_problems: z.number(),
  correct_answers: z.number(),
  accuracy_percentage: z.number(),
});
export type ModelPerformance = z.infer<typeof ModelPerformanceSchema>;

export const ProblemSetPerformanceSchema = z.object({
  run_id: z.string(),
  models: z.array(ModelPerformanceSchema),
});
export type ProblemSetPerformance = z.infer<typeof ProblemSetPerformanceSchema>;

export async function getProblemSetLatestPerformance(problemSetId: string): Promise<ProblemSetPerformance> {
  const res = await fetch(`/api/problem-sets/${encodeURIComponent(problemSetId)}/latest-performance`);
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  return ProblemSetPerformanceSchema.parse(json);
}

export const ModelDetailedResultSchema = z.object({
  id: z.string(),
  problem_id: z.string(),
  output: z.string().nullable(),
  score: z.number().nullable(),
  status: z.string(),
  judge_reasoning: z.string().nullable(),
  problem_prompt: z.string(),
  problem_type: z.string(),
  expected_answer: z.string().nullable(),
});
export type ModelDetailedResult = z.infer<typeof ModelDetailedResultSchema>;

export async function getModelDetailedResults(runId: string, modelId: string): Promise<ModelDetailedResult[]> {
  const res = await fetch(`/api/runs/${encodeURIComponent(runId)}/models/${encodeURIComponent(modelId)}/results`);
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  return z.array(ModelDetailedResultSchema).parse(json);
}

// Manual Review API
export const ManualReviewSchema = z.object({
  id: z.string(),
  run_id: z.string(),
  problem_id: z.string(),
  model_id: z.string(),
  output: z.string().nullable(),
  created_at: z.number(),
  problem_prompt: z.string(),
  problem_type: z.string(),
  expected_answer: z.string().nullable(),
  html_assets: z.string().nullable(),
  model_name: z.string(),
  run_name: z.string().nullable(),
  problem_set_name: z.string(),
  judge_reasoning: z.string().nullable(),
});
export type ManualReview = z.infer<typeof ManualReviewSchema>;

export async function getPendingManualReviews(limit?: number): Promise<ManualReview[]> {
  const url = limit ? `/api/manual-reviews?limit=${limit}` : '/api/manual-reviews';
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  return z.array(ManualReviewSchema).parse(json);
}
export async function submitManualReview(resultId: string, decision: 'pass' | 'fail', notes?: string): Promise<{ id: string; status: string }> {
  const res = await fetch(`/api/run-results/${encodeURIComponent(resultId)}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision, notes }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Leaderboard API
export const LeaderboardEntrySchema = z.object({
  model_id: z.string(),
  model_name: z.string(),
  provider_name: z.string(),
  final_score: z.number(),
  average_accuracy: z.number(),
  consistency_factor: z.number(),
  recency_weight: z.number(),
  problem_sets_completed: z.number(),
  total_problem_sets: z.number(),
  last_run_date: z.number(),
  problem_set_scores: z.array(z.object({
    problem_set_id: z.string(),
    problem_set_name: z.string(),
    accuracy: z.number(),
    run_date: z.number(),
  })),
});
export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const res = await fetch('/api/leaderboard');
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  return z.array(LeaderboardEntrySchema).parse(json);
}

