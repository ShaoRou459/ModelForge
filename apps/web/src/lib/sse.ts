export type RunSSEEvent =
  | { event: 'run_status'; data: { run_id: string; status: string } }
  | { event: 'model_started'; data: { run_id: string; problem_id: string; model_id: string; model_name: string; attempt: number; streaming: boolean } }
  | { event: 'model_streaming_started'; data: { run_id: string; problem_id: string; model_id: string; model_name: string } }
  | { event: 'candidate_token'; data: { run_id: string; problem_id: string; model_id: string; model_name?: string; delta: string; kind: 'text' | 'html' } }
  | { event: 'candidate_done'; data: { run_id: string; problem_id: string; model_id: string; model_name?: string; text: string } }
  | { event: 'html_candidate_done'; data: { run_id: string; problem_id: string; model_id: string; model_name?: string; html: string } }
  | { event: 'judge_done'; data: { run_id: string; problem_id: string; model_id: string; verdict: string; reasoning?: string; score?: number } }
  | { event: 'model_error'; data: { run_id: string; problem_id: string; model_id: string; model_name?: string; error: string; streaming?: boolean } }
  | { event: 'model_cancelled'; data: { run_id: string; problem_id: string; model_id: string; model_name?: string } }
  | { event: 'run_cancelled'; data: { run_id: string; cancelled_by: string } };

export function subscribeRun(runId: string, onEvent: (e: RunSSEEvent) => void) {
  const es = new EventSource(`/api/runs/${runId}/stream`);
  const names: Array<RunSSEEvent['event']> = [
    'run_status',
    'model_started',
    'model_streaming_started',
    'candidate_token',
    'candidate_done',
    'html_candidate_done',
    'judge_done',
    'model_error',
    'model_cancelled',
    'run_cancelled',
  ];
  for (const n of names) {
    es.addEventListener(n, (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data);
        onEvent({ event: n, data } as RunSSEEvent);
      } catch {}
    });
  }
  return () => es.close();
}


