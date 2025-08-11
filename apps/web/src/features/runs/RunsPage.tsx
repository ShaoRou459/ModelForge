import { useRef, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { listRuns, createRun, executeRun, cancelRun, Run } from '../../lib/api';
import RunView from './RunView';
import NewRunForm from './NewRunForm';
import { useLocation } from 'react-router-dom';
import { subscribeRun, RunSSEEvent } from '../../lib/sse';
import { FadeIn, LoadingSpinner, LoadingPulse, AnimatedList, AnimatedListItem, AnimatedCard } from '../../components/animations';
import { useBenchmarkSettings, useDisplaySettings, useNotificationSettings } from '../../stores/settings';

type CreateValues = {
  name?: string;
  problemSetId: string;
  judgeModelId: string;
  modelIds: string[];
  stream: boolean;
};

export default function RunsPage() {
  const [activeRun, setActiveRun] = useState<Run | null>(null);
  const qc = useQueryClient();
  const location = useLocation();
  const runs = useQuery({ queryKey: ['runs'], queryFn: () => listRuns({ limit: 50 }) });
  const benchmarkSettings = useBenchmarkSettings();
  const displaySettings = useDisplaySettings();
  const notificationSettings = useNotificationSettings();

  const createMut = useMutation({
    mutationFn: (v: CreateValues) => createRun(v),
    onSuccess: async (res, variables) => {
      await qc.invalidateQueries({ queryKey: ['runs'] });
      setActiveRun({
        id: res.id,
        name: variables.name ?? null,
        problem_set_id: variables.problemSetId,
        model_ids: JSON.stringify(variables.modelIds),
        judge_model_id: variables.judgeModelId,
        status: 'queued',
        created_at: Date.now(),
        stream: variables.stream ? 1 : 0,
      } as Run);
      if (variables && variables.stream !== undefined) {
        // no-op, already set above
      }
      // Respect Auto-start from settings
      if (benchmarkSettings.autoStartRuns) {
        try { await executeRun(res.id); } catch {}
      }
    },
  });

  const cancelMut = useMutation({
    mutationFn: (runId: string) => cancelRun(runId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['runs'] });
    },
  });

  const rightRef = useRef<HTMLDivElement>(null);
  const [resultsHeight] = useState<number>(880);

  const scrollToForm = () => {
    requestAnimationFrame(() => {
      rightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  // If ?new=1 is present, show the New Run panel
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('new') === '1') {
      setActiveRun(null);
      scrollToForm();
    }
  }, [location.search]);

  // Subscribe to SSE events for all runs to keep status in sync
  useEffect(() => {
    if (!runs.data || runs.data.length === 0) return;

    const unsubscribeFunctions: (() => void)[] = [];

    // Subscribe to each run's SSE stream to detect status changes
    runs.data.forEach(run => {
      if (run.status === 'running' || run.status === 'queued') {
        const unsubscribe = subscribeRun(run.id, (e: RunSSEEvent) => {
          if (e.event === 'run_status') {
            // Invalidate runs query when any run status changes
            qc.invalidateQueries({ queryKey: ['runs'] });
            // Optional browser notification on completion
            if (
              e.data.status === 'completed' &&
              notificationSettings.runCompletion &&
              notificationSettings.browserNotifications &&
              'Notification' in window &&
              Notification.permission === 'granted'
            ) {
              try {
                new Notification('Run completed', { body: `Run ${e.data.run_id.slice(0, 8)} finished` });
              } catch {}
            }
          }
        });
        unsubscribeFunctions.push(unsubscribe);
      }
    });

    return () => {
      unsubscribeFunctions.forEach(fn => fn());
    };
  }, [runs.data, qc]);

  return (
    <div className="h-full grid gap-2">
      <div className="min-h-0 grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-4">
        <div className="card p-0 overflow-hidden min-h-[70vh]">
          <div className="section-header">
            <div className="section-title">Recent Runs</div>
            <button
              className="btn-ghost"
              onClick={() => { setActiveRun(null); scrollToForm(); }}
              title="Create a new run"
            >New Run</button>
          </div>
          <div className="divide-y divide-[var(--border)] max-h-[calc(100%-48px)] overflow-auto">
            {runs.isLoading ? (
              <FadeIn className="p-4 flex items-center gap-3">
                <LoadingSpinner className="text-textDim" size={16} />
                <LoadingPulse className="text-textDim">Loading…</LoadingPulse>
              </FadeIn>
            ) : runs.isError ? (
              <FadeIn className="p-4 text-[var(--danger)]">Failed to load runs</FadeIn>
            ) : (runs.data?.length || 0) === 0 ? (
              <FadeIn className="p-4 text-textDim">No runs yet</FadeIn>
            ) : (
              <AnimatedList>
                {(runs.data ?? []).map((r) => (
                  <AnimatedListItem key={r.id}>
                    <AnimatedCard className="w-full px-4 py-3">
                  <div className="flex items-center justify-between">
                    <button className="text-left" onClick={() => setActiveRun(r)}>
                      <div className="text-sm">{r.name || r.id.slice(0, 8)}</div>
                      <div className="text-xs text-textDim flex items-center gap-2">
                        <span className={`pill transition-all duration-200 ${r.status === 'completed' ? 'text-[var(--success)]' : r.status === 'running' ? 'text-[var(--warn)] loading-pulse' : r.status === 'error' ? 'text-[var(--danger)]' : 'text-textDim'}`}>{r.status.toUpperCase()}</span>
                        {displaySettings.showTimestamps && (
                          <span>{new Date(r.created_at).toLocaleString()}</span>
                        )}
                      </div>
                    </button>
                    <div className="flex gap-1">
                      {(r.status === 'queued' || r.status === 'error') && (
                        <button
                          className="px-2 py-1 rounded-md border border-[var(--border)] text-xs text-textDim hover:text-text transition-all duration-200 hover:scale-105"
                          onClick={async (e) => { e.stopPropagation(); try { await executeRun(r.id); } catch {} }}
                          title={r.status === 'queued' ? 'Start' : 'Retry'}
                        >{r.status === 'queued' ? 'Start' : 'Retry'}</button>
                      )}
                      {(r.status === 'running' || r.status === 'queued') && (
                        <button
                          className="px-2 py-1 rounded-md border border-red-300 text-xs text-red-600 hover:text-red-700 hover:border-red-400 transition-all duration-200 hover:scale-105"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (confirm('Are you sure you want to cancel this run?')) {
                              try {
                                await cancelMut.mutateAsync(r.id);
                              } catch (error) {
                                console.error('Failed to cancel run:', error);
                              }
                            }
                          }}
                          title="Cancel run"
                          disabled={cancelMut.isPending}
                        >
                          {cancelMut.isPending ? 'Cancelling...' : 'Cancel'}
                        </button>
                      )}
                    </div>
                  </div>
                    </AnimatedCard>
                  </AnimatedListItem>
                ))}
              </AnimatedList>
            )}
          </div>
        </div>

        <div ref={rightRef} className="min-h-[70vh] flex flex-col gap-4">
          {!activeRun && (
            <NewRunForm
              onSubmit={(values) => createMut.mutate(values)}
              isSubmitting={createMut.isPending}
              error={createMut.isError ? String(createMut.error) : null}
              onReset={() => {
                setActiveRun(null);
                scrollToForm();
              }}
            />
          )}


          {activeRun && (
            <div className="card p-0 overflow-hidden animate-scale-in" style={{ height: `${resultsHeight}px` }}>
              <RunView run={activeRun} onClose={() => { setActiveRun(null); scrollToForm(); }} />
            </div>
          )}
        </div>
      </div>
      
    </div>
  );
}


