import { useMemo, useState, useEffect } from 'react';
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import { listRuns, getRunResults, listModels, listProblemSets, Model, ProblemSet } from '../../lib/api';
import { useNavigate } from 'react-router-dom';
import { subscribeRun, RunSSEEvent } from '../../lib/sse';
import { LoadingPulse, AnimatedList, AnimatedListItem, AnimatedCard } from '../../components/animations';

export default function DashboardPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [rollingCount, setRollingCount] = useState<number>(10);
  const [showWorstModels, setShowWorstModels] = useState<boolean>(false);
  const runs = useQuery({ queryKey: ['runs', 'dash'], queryFn: () => listRuns({ limit: 50 }) });
  const modelsQ = useQuery({ queryKey: ['models', 'dash'], queryFn: () => listModels() });
  const problemSetsQ = useQuery({ queryKey: ['problemSets', 'dash'], queryFn: () => listProblemSets() });
  const recentRuns = (runs.data ?? []).slice(0, rollingCount);
  const resultQueries = useQueries({
    queries: recentRuns.map((r) => ({
      queryKey: ['runResults', r.id],
      queryFn: () => getRunResults(r.id),
      enabled: recentRuns.length > 0,
    })),
  });
  const anyLoading = resultQueries.some((q) => q.isLoading);

  // Subscribe to SSE events for running runs to keep dashboard in sync
  useEffect(() => {
    if (!runs.data || runs.data.length === 0) return;

    const unsubscribeFunctions: (() => void)[] = [];

    // Subscribe to each running run's SSE stream to detect status changes
    runs.data.forEach(run => {
      if (run.status === 'running' || run.status === 'queued') {
        const unsubscribe = subscribeRun(run.id, (e: RunSSEEvent) => {
          if (e.event === 'run_status') {
            // Invalidate dashboard queries when any run status changes
            qc.invalidateQueries({ queryKey: ['runs', 'dash'] });
            // Also invalidate run results to refresh charts
            qc.invalidateQueries({ queryKey: ['runResults'] });
          }
        });
        unsubscribeFunctions.push(unsubscribe);
      }
    });

    return () => {
      unsubscribeFunctions.forEach(fn => fn());
    };
  }, [runs.data, qc]);

  const { kpis, accuracyByModel, benchmarkScores, problemDifficulty } = useMemo(() => {
    const empty = {
      kpis: { successRate: null as number | null, activeModels: 0, recentRuns: 0, failureRate: null as number | null, durationMs: null as number | null },
      accuracyByModel: { labels: [] as string[], values: [] as number[], ids: [] as string[] },
      benchmarkScores: { labels: [] as string[], values: [] as number[], ids: [] as string[] },
      problemDifficulty: { labels: [] as string[], values: [] as number[], ids: [] as string[], fullPrompts: [] as string[] },
    };
    if (!runs.data || runs.data.length === 0) return empty;

    const runIdToRows = new Map<string, NonNullable<Awaited<ReturnType<typeof getRunResults>>>>();
    for (let i = 0; i < recentRuns.length; i++) {
      const r = recentRuns[i];
      const q = resultQueries[i];
      if (r && q && q.data) runIdToRows.set(r.id, q.data);
    }
    const rows = Array.from(runIdToRows.values()).flat();
    if (rows.length === 0) return empty;

    const total = rows.length;
    const completed = rows.filter((r) => r.status === 'completed');
    // Use score >= 50 as pass threshold for 0-100 scale
    const pass = completed.filter((r) => (r.score ?? 0) >= 50).length;
    const problemsSet = new Set(rows.map((r) => r.problem_id));
    const modelsSet = new Set(rows.map((r) => r.model_id));
    // Average per-run duration using completed results only
    const perRunDurations: number[] = [];
    for (const r of recentRuns) {
      const rr = runIdToRows.get(r.id) ?? [];
      const comp = rr.filter((x) => x.status === 'completed');
      if (comp.length === 0) continue;
      const minT = Math.min(...comp.map((x) => x.created_at));
      const maxT = Math.max(...comp.map((x) => x.created_at));
      if (Number.isFinite(minT) && Number.isFinite(maxT) && maxT >= minT) {
        perRunDurations.push(maxT - minT);
      }
    }
    const avgDuration = perRunDurations.length ? Math.round(perRunDurations.reduce((a, b) => a + b, 0) / perRunDurations.length) : null;

    // Calculate more useful metrics
    const activeModels = new Set(rows.filter(r => r.status === 'completed').map(r => r.model_id)).size;
    const successRate = completed.length ? Math.round((pass / completed.length) * 100) : null;
    const recentRunsCount = recentRuns.length;
    const failureRate = completed.length ? Math.round(((completed.length - pass) / completed.length) * 100) : null;

    const kpis = {
      successRate: successRate,
      activeModels: activeModels,
      recentRuns: recentRunsCount,
      failureRate: failureRate,
      durationMs: avgDuration,
    };

    // Accuracy by model (using average scores)
    const byModel = new Map<string, { scoreSum: number; count: number }>();
    for (const r of rows) {
      const m = byModel.get(r.model_id) || { scoreSum: 0, count: 0 };
      if (r.score != null) {
        m.scoreSum += r.score;
        m.count += 1;
      }
      byModel.set(r.model_id, m);
    }
    const modelLabel = new Map<string, string>();
    (modelsQ.data ?? []).forEach((m: Model) => modelLabel.set(m.id, m.label));

    // Sort models by performance (highest average score first)
    const modelIdsOrdered = Array.from(byModel.keys()).sort((a, b) => {
      const avgA = byModel.get(a)!.count ? byModel.get(a)!.scoreSum / byModel.get(a)!.count : 0;
      const avgB = byModel.get(b)!.count ? byModel.get(b)!.scoreSum / byModel.get(b)!.count : 0;
      return avgB - avgA; // Descending order (best first)
    });

    // Get the desired models based on toggle (top 3 or worst 3)
    const selectedModelIds = showWorstModels ? 
      modelIdsOrdered.slice(-3).reverse() : // Get worst 3 and reverse to show worst first
      modelIdsOrdered.slice(0, 3); // Get top 3

    const accuracyByModel = {
      labels: selectedModelIds.map((id) => {
        const lab = (modelLabel.get(id) || '').toString().trim();
        return lab.length > 0 ? lab : id.slice(0, 6);
      }),
      values: selectedModelIds.map((id) => {
        const v = byModel.get(id)!;
        return v.count ? Math.round(v.scoreSum / v.count) : 0;
      }),
      ids: selectedModelIds,
    };

    // Average scores by benchmark/problem set
    const problemSetLabel = new Map<string, string>();
    (problemSetsQ.data ?? []).forEach((ps: ProblemSet) => problemSetLabel.set(ps.id, ps.name));

    const byProblemSet = new Map<string, { scoreSum: number; count: number }>();
    for (const r of rows) {
      // Get problem set ID from run data
      const run = recentRuns.find(run => run.id === r.run_id);
      if (run?.problem_set_id) {
        const m = byProblemSet.get(run.problem_set_id) || { scoreSum: 0, count: 0 };
        if (r.score != null) {
          m.scoreSum += r.score;
          m.count += 1;
        }
        byProblemSet.set(run.problem_set_id, m);
      }
    }

    // Sort by average score (lowest first to show hardest benchmarks)
    const problemSetIdsOrdered = Array.from(byProblemSet.keys()).sort((a, b) => {
      const avgA = byProblemSet.get(a)!.count ? byProblemSet.get(a)!.scoreSum / byProblemSet.get(a)!.count : 0;
      const avgB = byProblemSet.get(b)!.count ? byProblemSet.get(b)!.scoreSum / byProblemSet.get(b)!.count : 0;
      return avgA - avgB; // Ascending order (hardest first)
    });

    const benchmarkScores = {
      labels: problemSetIdsOrdered.map((id) => {
        const name = problemSetLabel.get(id) || id.slice(0, 10);
        return name.length > 15 ? name.slice(0, 15) + '...' : name;
      }),
      values: problemSetIdsOrdered.map((id) => {
        const v = byProblemSet.get(id)!;
        return v.count ? Math.round(v.scoreSum / v.count) : 0;
      }),
      ids: problemSetIdsOrdered,
    };

    // Problem difficulty analysis (individual problems ranked by difficulty)
    const byProblem = new Map<string, { scoreSum: number; count: number; failCount: number; prompt: string }>();
    for (const r of rows) {
      const m = byProblem.get(r.problem_id) || { scoreSum: 0, count: 0, failCount: 0, prompt: '' };
      if (r.score != null) {
        m.scoreSum += r.score;
        m.count += 1;
        if (r.score < 50) m.failCount += 1;
      }
      // Store the problem prompt for labeling (from run results data)
      if (r.problem_prompt && !m.prompt) {
        m.prompt = r.problem_prompt;
      }
      byProblem.set(r.problem_id, m);
    }

    // Sort by average score (lowest first = hardest problems)
    const problemIdsOrdered = Array.from(byProblem.keys())
      .filter(id => byProblem.get(id)!.count >= 2) // Only include problems with at least 2 attempts
      .sort((a, b) => {
        const avgA = byProblem.get(a)!.count ? byProblem.get(a)!.scoreSum / byProblem.get(a)!.count : 0;
        const avgB = byProblem.get(b)!.count ? byProblem.get(b)!.scoreSum / byProblem.get(b)!.count : 0;
        return avgA - avgB; // Ascending order (hardest first)
      })
      .slice(0, 10); // Top 10 hardest problems

    const problemDifficulty = {
      labels: problemIdsOrdered.map((id) => {
        const problemData = byProblem.get(id)!;
        const prompt = problemData.prompt || id;
        // Use first 7 characters, but scale dynamically based on available space
        return prompt.length > 7 ? prompt.slice(0, 7) + '...' : prompt;
      }),
      values: problemIdsOrdered.map((id) => {
        const v = byProblem.get(id)!;
        return v.count ? Math.round(v.scoreSum / v.count) : 0;
      }),
      ids: problemIdsOrdered,
      fullPrompts: problemIdsOrdered.map((id) => {
        const problemData = byProblem.get(id)!;
        return problemData.prompt || 'Problem text not available';
      }),
    };

    // Dependency safety: compute a simple key from result sizes
    return { kpis, accuracyByModel, benchmarkScores, problemDifficulty };
  }, [runs.data, resultQueries.map((q) => (q.data ? (q.data as unknown[]).length : -1)).join(','), modelsQ.data, problemSetsQ.data, showWorstModels]);

  return (
    <div className="grid gap-6 animate-fade-in">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <div className="animate-slide-in-up" style={{ animationDelay: '0s' }}>
          <KpiCard label="Success Rate" value={kpis.successRate != null ? `${kpis.successRate}%` : '—'} hint={runs.data?.length ? `Last ${Math.min(runs.data.length, rollingCount)} runs` : 'Waiting for data'} accent />
        </div>
        <div className="animate-slide-in-up" style={{ animationDelay: '0.1s' }}>
          <KpiCard label="Active Models" value={kpis.activeModels ? String(kpis.activeModels) : '—'} hint="Models used in recent runs" />
        </div>
        <div className="animate-slide-in-up" style={{ animationDelay: '0.2s' }}>
          <KpiCard label="Recent Runs" value={kpis.recentRuns ? String(kpis.recentRuns) : '—'} hint="Runs analyzed" />
        </div>
        <div className="animate-slide-in-up" style={{ animationDelay: '0.3s' }}>
          <KpiCard label="Failure Rate" value={kpis.failureRate != null ? `${kpis.failureRate}%` : '—'} hint="Failed evaluations" />
        </div>
        <div className="animate-slide-in-up" style={{ animationDelay: '0.4s' }}>
          <KpiCard label="Avg Duration" value={kpis.durationMs != null ? `${Math.round(kpis.durationMs / 1000)}s` : '—'} hint="Per run execution time" />
        </div>
      </div>

      {/* Range selector for aggregation window */}
      <div className="flex items-center gap-3 text-xs text-textDim animate-slide-in-down">
        <span>Aggregation window:</span>
        <div className="flex items-center gap-2">
          {[5, 10, 20].map((n, index) => (
            <button
              key={n}
              className={`px-2 py-1 rounded-md border transition-all duration-200 hover:scale-105 animate-scale-in ${rollingCount === n ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--border)] text-textDim hover:border-[var(--accent)] hover:text-[var(--accent)]'}`}
              style={{ animationDelay: `${index * 0.1}s` }}
              onClick={() => setRollingCount(n)}
            >
              Last {n}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Average Score by Model */}
        <div className="card h-80 p-4 xl:col-span-1 animate-scale-in hover-lift" style={{ animationDelay: '0.5s' }}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-textDim">Models ({showWorstModels ? 'Worst' : 'Best'})</div>
            <div className="flex items-center gap-2">
              <button 
                className="text-xs px-2 py-1 rounded border transition-all duration-200 hover:scale-105"
                style={{ 
                  borderColor: showWorstModels ? 'var(--accent)' : 'var(--border)',
                  color: showWorstModels ? 'var(--accent)' : 'var(--textDim)' 
                }}
                onClick={() => setShowWorstModels(!showWorstModels)}
              >
                {showWorstModels ? 'Best' : 'Worst'}
              </button>
              <button className="text-xs text-textDim hover:text-text transition-all duration-200 hover:scale-105" onClick={() => navigate('/runs')}>View Runs</button>
            </div>
          </div>
          <ReactECharts
            style={{ height: '100%' }}
            option={{
              backgroundColor: 'transparent',
              color: ['#66d0ff', '#4cc2ff', '#3fb5f2', '#2aa4df', '#1c8ccc'],
              grid: { left: 40, right: 20, top: 20, bottom: 70 }, // Increased bottom margin even more for slanted labels
              xAxis: { 
                type: 'category', 
                data: accuracyByModel.labels, 
                axisLine: { lineStyle: { color: '#344556' } }, 
                axisLabel: { 
                  color: '#9fb1c1',
                  rotate: -25, // Less aggressive tilt
                  interval: 0, // Show all labels
                  fontSize: 11
                } 
              },
              yAxis: { type: 'value', max: 100, axisLine: { lineStyle: { color: '#344556' } }, splitLine: { lineStyle: { color: '#1e2630' } }, axisLabel: { color: '#9fb1c1' } },
              series: [
                {
                  type: 'bar', data: accuracyByModel.values,
                  itemStyle: { color: showWorstModels ? '#ff6b6b' : '#4cc2ff' }, // Different color for worst models
                  emphasis: { itemStyle: { color: showWorstModels ? '#ff8a8a' : '#66d0ff' } },
                },
              ],
              tooltip: { 
                trigger: 'axis',
                formatter: (params: any) => {
                  const value = params[0]?.value;
                  const name = params[0]?.name;
                  const rank = showWorstModels ? 'Worst performing' : 'Top performing';
                  return `${name}<br/>${rank}<br/>Average Score: ${value}%`;
                }
              },
            }}
            onEvents={{
              click: (params: any) => {
                if (params?.componentType === 'xAxis') {
                  const idx = params.value != null ? accuracyByModel.labels.indexOf(String(params.value)) : -1;
                  const id = idx >= 0 ? accuracyByModel.ids[idx] : null;
                  if (id) navigate('/runs');
                }
              },
            }}
          />
        </div>

        {/* Benchmark Difficulty Analysis */}
        <div className="card h-80 p-4 xl:col-span-1 animate-scale-in hover-lift" style={{ animationDelay: '0.6s' }}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-textDim">Benchmark Difficulty (Average Scores)</div>
            <button className="text-xs text-textDim hover:text-text transition-all duration-200 hover:scale-105" onClick={() => navigate('/review')}>View Details</button>
          </div>
          <ReactECharts
            style={{ height: '100%' }}
            option={{
              backgroundColor: 'transparent',
              grid: { left: 40, right: 20, top: 20, bottom: 50 },
              color: ['#ff6b6b', '#ffd166', '#3fb5f2'],
              xAxis: {
                type: 'category',
                data: benchmarkScores.labels,
                axisLine: { lineStyle: { color: '#344556' } },
                axisLabel: { color: '#9fb1c1', rotate: 45 }
              },
              yAxis: { type: 'value', max: 100, axisLine: { lineStyle: { color: '#344556' } }, splitLine: { lineStyle: { color: '#1e2630' } }, axisLabel: { color: '#9fb1c1' } },
              series: [
                {
                  type: 'bar',
                  data: benchmarkScores.values.map((value, index) => ({
                    value,
                    itemStyle: {
                      color: value < 30 ? '#ff6b6b' : value < 70 ? '#ffd166' : '#3ddc97'
                    }
                  })),
                  emphasis: { itemStyle: { opacity: 0.8 } },
                },
              ],
              tooltip: {
                trigger: 'axis',
                formatter: (params: any) => {
                  const score = params[0]?.value?.value || params[0]?.value;
                  const name = params[0]?.name;
                  const difficulty = score < 30 ? 'Very Hard' : score < 50 ? 'Hard' : score < 70 ? 'Medium' : 'Easy';
                  return `${name}<br/>Average Score: ${score}%<br/>Difficulty: ${difficulty}`;
                }
              },
            }}
            onEvents={{
              click: (params: any) => {
                navigate('/review');
              },
            }}
          />
        </div>

        {/* Problem Difficulty Analysis */}
        <div className="card h-80 p-4 xl:col-span-1 animate-scale-in hover-lift" style={{ animationDelay: '0.7s' }}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-textDim">Hardest Problems</div>
            <button className="text-xs text-textDim hover:text-text transition-all duration-200 hover:scale-105" onClick={() => navigate('/problem-sets')}>View All</button>
          </div>
          <ReactECharts
            style={{ height: '100%' }}
            option={{
              backgroundColor: 'transparent',
              grid: { left: '25%', right: 20, top: 20, bottom: 30 },
              color: ['#ff6b6b'],
              xAxis: { type: 'value', max: 100, axisLine: { lineStyle: { color: '#344556' } }, splitLine: { lineStyle: { color: '#1e2630' } }, axisLabel: { color: '#9fb1c1' } },
              yAxis: {
                type: 'category',
                data: problemDifficulty.labels,
                axisLine: { lineStyle: { color: '#344556' } },
                axisLabel: {
                  color: '#9fb1c1',
                  fontSize: 11,
                  overflow: 'truncate'
                }
              },
              series: [
                {
                  type: 'bar',
                  data: problemDifficulty.values.map((value, index) => ({
                    value,
                    itemStyle: {
                      color: value < 20 ? '#ff4757' : value < 40 ? '#ff6b6b' : value < 60 ? '#ffa726' : '#66bb6a'
                    }
                  })),
                  emphasis: { itemStyle: { opacity: 0.8 } },
                },
              ],
              tooltip: {
                trigger: 'axis',
                formatter: (params: any) => {
                  const score = params[0]?.value?.value || params[0]?.value;
                  const dataIndex = params[0]?.dataIndex;
                  const difficulty = score < 20 ? 'Extremely Hard' : score < 40 ? 'Very Hard' : score < 60 ? 'Hard' : 'Moderate';

                  if (dataIndex != null && problemDifficulty.fullPrompts[dataIndex]) {
                    const fullPrompt = problemDifficulty.fullPrompts[dataIndex];
                    const truncatedPrompt = fullPrompt.length > 100 ? fullPrompt.slice(0, 100) + '...' : fullPrompt;

                    return `${truncatedPrompt}<br/>Average Score: ${score}%<br/>Difficulty: ${difficulty}`;
                  }

                  return `Average Score: ${score}%<br/>Difficulty: ${difficulty}`;
                }
              },
            }}
            onEvents={{
              click: (params: any) => {
                navigate('/problem-sets');
              },
            }}
          />
        </div>
      </div>

      {/* Removed large problems chart to prioritize Recent Runs */}

      {/* Recent Runs */}
      <div className="card p-0 overflow-hidden animate-scale-in hover-lift" style={{ animationDelay: '0.8s' }}>
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
          <div className="text-sm text-textDim">Recent Runs</div>
          <button className="text-xs text-textDim hover:text-text transition-all duration-200 hover:scale-105" onClick={() => navigate('/runs')}>Open Runs</button>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {runs.isLoading || anyLoading ? (
            <LoadingPulse className="p-4 text-textDim">Loading…</LoadingPulse>
          ) : runs.isError ? (
            <div className="p-4 text-[var(--danger)]">Failed to load runs</div>
          ) : (
            <AnimatedList>
              {(runs.data ?? []).slice(0, 8).map((r, index) => (
                <AnimatedListItem key={r.id} className="px-4 py-3 flex items-center justify-between hover:bg-[rgba(255,255,255,0.03)] transition-all duration-200">
                  <div className="text-sm">{r.name || r.id.slice(0,8)}</div>
                  <div className="flex items-center gap-3 text-xs text-textDim">
                    <span className={`pill transition-all duration-200 ${r.status === 'completed' ? 'text-[var(--success)]' : r.status === 'running' ? 'text-[var(--warn)]' : r.status === 'error' ? 'text-[var(--danger)]' : 'text-textDim'}`}>
                      {r.status === 'running' ? <LoadingPulse className="inline">{r.status.toUpperCase()}</LoadingPulse> : r.status.toUpperCase()}
                    </span>
                    <span>{new Date(r.created_at).toLocaleString()}</span>
                  </div>
                </AnimatedListItem>
              ))}
            </AnimatedList>
          )}
          {(runs.data?.length || 0) === 0 && !runs.isLoading && !runs.isError && (
            <div className="p-4 text-textDim animate-fade-in">No runs yet</div>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, hint, accent = false }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <AnimatedCard className="card p-4 h-24 flex flex-col justify-between" style={accent ? { background: 'radial-gradient(120% 120% at 0% 0%, rgba(102,208,255,0.06), rgba(0,0,0,0) 40%), var(--surface-2)' } : undefined}>
      <div className="text-xs text-textDim">{label}</div>
      <div className="text-2xl">{value}</div>
      <div className="text-xs text-textDim min-h-[1rem]">{hint || ''}</div>
    </AnimatedCard>
  );
}

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return `${m}m ${rs}s`;
}


