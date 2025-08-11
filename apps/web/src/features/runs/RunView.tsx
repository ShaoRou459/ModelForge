import { useEffect, useMemo, useRef, useState } from 'react';
import { useDisplaySettings, useExportSettings } from '../../stores/settings';
import { Run, getRunResults, listProblems, listModels, cancelModel } from '../../lib/api';
import SandboxPreview from '../problems/SandboxPreview';
import { ExternalLink, AlertCircle, Clock } from 'lucide-react';
import { subscribeRun, RunSSEEvent } from '../../lib/sse';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useQuery, useMutation } from '@tanstack/react-query';
import { LoadingBounce, FadeIn, SlideIn } from '../../components/animations';

type Props = { run: Run; onClose: () => void };

type Message = {
  id: string;
  who: 'problem' | 'model' | 'judge';
  problemId: string;
  modelId?: string;
  text: string;
  score?: number | null;
  reasoning?: string;
};

export default function RunView({ run, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState(run.status);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef<boolean>(true);
  const displaySettings = useDisplaySettings();
  const exportSettings = useExportSettings();
  const [tab, setTab] = useState<'chat'|'matrix'>(displaySettings.defaultResultView);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [problemTypes, setProblemTypes] = useState<Record<string, 'text'|'html'>>({});
  const [problemPrompts, setProblemPrompts] = useState<Record<string, string>>({});
  // Track the original problem order from the database
  const [problemOrder, setProblemOrder] = useState<string[]>([]);
  // Track streaming status for each model
  const [streamingModels, setStreamingModels] = useState<Record<string, { modelName: string; problemId: string; streaming: boolean }>>({});
  // Track completed models for each problem-model combination
  const [completedModels, setCompletedModels] = useState<Record<string, boolean>>({});
  // Load all models to map id -> label
  const modelsQuery = useQuery({ queryKey: ['models', 'all'], queryFn: () => listModels() });
  const modelNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of modelsQuery.data ?? []) map[m.id] = m.label;
    return map;
  }, [modelsQuery.data]);

  const cancelModelMut = useMutation({
    mutationFn: ({ runId, modelId }: { runId: string; modelId: string }) => cancelModel(runId, modelId),
  });
  // Buffer streamed tokens until prompts are seeded
  const streamBufferRef = useRef<Record<string, { problemId: string; modelId: string; text: string }>>({});
  // Maps of problem meta from listProblems
  const promptMapRef = useRef<Record<string, string>>({});
  const typeMapRef = useRef<Record<string, 'text'|'html'>>({});

  useEffect(() => {
    const stop = subscribeRun(run.id, (e: RunSSEEvent) => {
      if (e.event === 'run_status') {
        setStatus(e.data.status);
      }
      if (e.event === 'model_started') {
        const key = `${e.data.problem_id}-${e.data.model_id}`;
        setStreamingModels(prev => ({
          ...prev,
          [key]: {
            modelName: e.data.model_name,
            problemId: e.data.problem_id,
            streaming: e.data.streaming
          }
        }));
      }
      if (e.event === 'model_streaming_started') {
        const key = `${e.data.problem_id}-${e.data.model_id}`;
        setStreamingModels(prev => ({
          ...prev,
          [key]: {
            ...prev[key],
            modelName: e.data.model_name,
            problemId: e.data.problem_id,
            streaming: true
          }
        }));
      }
      if (e.event === 'model_error') {
        const key = `${e.data.problem_id}-${e.data.model_id}`;
        setStreamingModels(prev => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        // Add error message
        const id = `error-${e.data.problem_id}-${e.data.model_id}`;
        setMessages((prev) => {
          const next = [...prev];
          next.push({
            id,
            who: 'model',
            problemId: e.data.problem_id,
            modelId: e.data.model_id,
            text: `❌ Error: ${e.data.error}`
          });
          return next;
        });
      }
      if (e.event === 'candidate_token') {
        const id = `model-${e.data.problem_id}-${e.data.model_id}`;

        // Ensure problemTypes is populated for this problem during streaming
        const problemType = typeMapRef.current[e.data.problem_id];
        if (problemType) {
          setProblemTypes(prev => ({
            ...prev,
            [e.data.problem_id]: problemType
          }));
        }

        setMessages((prev) => {
          const next = [...prev];
          const hasPromptMsg = next.some(m => m.problemId === e.data.problem_id && m.who === 'problem');
          if (!hasPromptMsg) {
            const prompt = promptMapRef.current[e.data.problem_id];
            if (typeof prompt === 'string') {
              next.push({ id: `problem-${e.data.problem_id}`, who: 'problem', problemId: e.data.problem_id, text: prompt });
            } else {
              // Buffer until prompts are seeded.
              const current = streamBufferRef.current[id];
              streamBufferRef.current[id] = {
                problemId: e.data.problem_id,
                modelId: e.data.model_id,
                text: (current?.text || '') + e.data.delta,
              };
              return prev;
            }
          }
          const idx = next.findIndex((m) => m.id === id && m.who === 'model');
          if (idx >= 0) {
            const current = next[idx] as Message | undefined;
            const currentText = current ? current.text : '';
            next[idx] = { ...(current as Message), text: currentText + e.data.delta } as Message;
            return next;
          }
          next.push({ id, who: 'model', problemId: e.data.problem_id, modelId: e.data.model_id, text: e.data.delta });
          return next;
        });
      }
      if (e.event === 'html_candidate_done') {
        const id = `model-${e.data.problem_id}-${e.data.model_id}`;
        const key = `${e.data.problem_id}-${e.data.model_id}`;

        // Ensure problemTypes is populated for this HTML problem during streaming
        const problemType = typeMapRef.current[e.data.problem_id];
        if (problemType) {
          setProblemTypes(prev => ({
            ...prev,
            [e.data.problem_id]: problemType
          }));
        }

        // Remove from streaming models and mark as completed
        setStreamingModels(prev => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        setCompletedModels(prev => ({
          ...prev,
          [key]: true
        }));

        setMessages((prev) => {
          const next = [...prev];
          const hasPromptMsg = next.some(m => m.problemId === e.data.problem_id && m.who === 'problem');
          if (!hasPromptMsg) {
            const prompt = promptMapRef.current[e.data.problem_id];
            if (typeof prompt === 'string') {
              next.push({ id: `problem-${e.data.problem_id}`, who: 'problem', problemId: e.data.problem_id, text: prompt });
            } else {
              // Buffer full html until prompts are seeded (overrides partial tokens).
              streamBufferRef.current[id] = {
                problemId: e.data.problem_id,
                modelId: e.data.model_id,
                text: e.data.html,
              };
              return prev;
            }
          }
          const idx = next.findIndex((m) => m.id === id && m.who === 'model');
          if (idx >= 0) {
            const current = next[idx];
            next[idx] = { ...current, text: e.data.html } as Message;
            return next;
          }
          next.push({ id, who: 'model', problemId: e.data.problem_id, modelId: e.data.model_id, text: e.data.html });
          return next;
        });
      }
      if (e.event === 'candidate_done') {
        // Remove from streaming models when text completion is done and mark as completed
        const key = `${e.data.problem_id}-${e.data.model_id}`;
        setStreamingModels(prev => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        setCompletedModels(prev => ({
          ...prev,
          [key]: true
        }));
      }
      if (e.event === 'judge_done') {
        const id = `judge-${e.data.problem_id}-${e.data.model_id}`;
        const modelMessageId = `model-${e.data.problem_id}-${e.data.model_id}`;

        setMessages((prev) => {
          const next = [...prev];
          const hasPromptMsg = next.some(m => m.problemId === e.data.problem_id && m.who === 'problem');
          if (!hasPromptMsg) {
            const prompt = promptMapRef.current[e.data.problem_id];
            if (typeof prompt === 'string') {
              next.push({ id: `problem-${e.data.problem_id}`, who: 'problem', problemId: e.data.problem_id, text: prompt });
            } else {
              return prev;
            }
          }

          // Update the model message with the score and reasoning for status indicators
          const modelMsgIndex = next.findIndex(m => m.id === modelMessageId && m.who === 'model');
          if (modelMsgIndex >= 0) {
            const score = e.data.score ?? (e.data.verdict === 'PASS' ? 100 : 0); // Use actual score or fallback
            const currentMsg = next[modelMsgIndex];
            if (currentMsg) {
              next[modelMsgIndex] = {
                id: currentMsg.id,
                who: currentMsg.who,
                problemId: currentMsg.problemId,
                modelId: currentMsg.modelId,
                text: currentMsg.text,
                score: score,
                reasoning: e.data.reasoning
              };
            }
          }

          // Add the judge message
          next.push({
            id,
            who: 'judge',
            problemId: e.data.problem_id,
            modelId: e.data.model_id,
            text: `Verdict: ${e.data.verdict}`,
            reasoning: e.data.reasoning
          });
          return next;
        });
      }
      if (e.event === 'model_cancelled') {
        const key = `${e.data.problem_id}-${e.data.model_id}`;
        setStreamingModels(prev => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        // Add cancelled message
        const id = `cancelled-${e.data.problem_id}-${e.data.model_id}`;
        setMessages((prev) => {
          const next = [...prev];
          next.push({
            id,
            who: 'model',
            problemId: e.data.problem_id,
            modelId: e.data.model_id,
            text: `🚫 Model cancelled by user`
          });
          return next;
        });
      }
    });
    return () => stop();
  }, [run.id]);

  useEffect(() => {
    if (!scrollRef.current) return;
    if (stickToBottomRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Auto-download results when run completes if enabled in settings
  useEffect(() => {
    if (status !== 'completed' || !exportSettings.autoDownload) return;
    const format = exportSettings.defaultFormat;
    const url = format === 'csv' ? `/api/runs/${run.id}/results.csv` : `/api/runs/${run.id}/results.json`;
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = `run-${run.id}.${format}`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {}
  }, [status, exportSettings.autoDownload, exportSettings.defaultFormat, run.id]);

  // Pre-seed problem prompts and persisted outputs as chat messages
  useEffect(() => {
    let mounted = true;
    setMessages([]); // Clear previous messages when run changes
    setProblemTypes({});
    setProblemPrompts({});
    setProblemOrder([]);
    setCompletedModels({});

    Promise.all([listProblems(run.problem_set_id), getRunResults(run.id)])
      .then(([problems, rows]) => {
        if (!mounted) return;
        // Store the original problem order from the database (already sorted by created_at ASC)
        const problemIds = problems.map(p => p.id);
        setProblemOrder(problemIds);

        // Build maps from problem list for later use by SSE
        const prompts: Record<string, string> = {};
        const types: Record<string, 'text'|'html'> = {};
        for (const p of problems) {
          prompts[p.id] = p.prompt;
          types[p.id] = p.type === 'html' ? 'html' : 'text';
        }
        promptMapRef.current = prompts;
        typeMapRef.current = types;

        // Pre-seed ONLY problems that actually appear in this run's results
        const runProblemIds = Array.from(new Set(rows.map(r => r.problem_id)));
        const seeds: Message[] = [];
        for (const problemId of runProblemIds) {
          const ptxt = prompts[problemId] || '';
          seeds.push({ id: `problem-${problemId}`, who: 'problem', problemId, text: ptxt });
        }

        // Add any persisted outputs/verdicts
        for (const r of rows) {
          if (r.output) {
            seeds.push({ id: `model-${r.problem_id}-${r.model_id}`, who: 'model', problemId: r.problem_id, modelId: r.model_id, text: r.output, score: r.score });
          }
          if (r.score != null) {
            seeds.push({
              id: `judge-${r.problem_id}-${r.model_id}`,
              who: 'judge',
              problemId: r.problem_id,
              modelId: r.model_id,
              text: `Verdict: ${(r.score ?? 0) >= 50 ? 'PASS' : 'FAIL'}`,
              score: r.score,
              reasoning: r.judge_reasoning || undefined
            });
          }
        }

        // Merge any buffered stream text captured before prompts were seeded
        for (const buf of Object.values(streamBufferRef.current)) {
          const id = `model-${buf.problemId}-${buf.modelId}`;
          const existingIndex = seeds.findIndex(m => m.id === id && m.who === 'model');
          if (existingIndex >= 0) {
            const existingCandidate = seeds[existingIndex];
            const existingText = existingCandidate && typeof (existingCandidate as any).text === 'string' ? (existingCandidate as any).text : '';
            seeds[existingIndex] = { ...(existingCandidate as Message), text: existingText + buf.text } as Message;
          } else if (runProblemIds.includes(buf.problemId)) {
            seeds.push({ id, who: 'model', problemId: buf.problemId, modelId: buf.modelId, text: buf.text });
          }
        }
        // Clear buffer after applying
        streamBufferRef.current = {};

        // Dedupe by id to avoid duplicates from rows + buffer
        const deduped = Array.from(new Map(seeds.map(m => [m.id, m])).values());

        // Update view state
        const subsetTypes: Record<string, 'text'|'html'> = {};
        const subsetPrompts: Record<string, string> = {};
        for (const id of runProblemIds) {
          if (types[id]) subsetTypes[id] = types[id];
          if (typeof prompts[id] === 'string') subsetPrompts[id] = prompts[id] as string;
        }
        setProblemTypes(subsetTypes);
        setProblemPrompts(subsetPrompts);
        setMessages(deduped);
      })
      .catch((err) => {
        console.error('Failed to load initial run data:', err);
      });

    return () => { mounted = false; };
  }, [run.id, run.problem_set_id]);

  const groups = useMemo(() => groupByProblem(messages), [messages, problemOrder]);
  // Sort groups by the original problem order from the database instead of alphabetically
  groups.sort((a, b) => {
    const indexA = problemOrder.indexOf(a.problemId);
    const indexB = problemOrder.indexOf(b.problemId);
    // If both problems are in the order array, sort by their position
    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB;
    }
    // If only one is in the order array, prioritize it
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    // If neither is in the order array, fall back to alphabetical sort
    return a.problemId.localeCompare(b.problemId);
  });

  // Debug logging to verify the fix
  console.log('Problem order from DB:', problemOrder);
  console.log('Groups after sorting:', groups.map(g => ({ problemId: g.problemId, prompt: g.prompt.slice(0, 50) + '...' })));
  // Ensure scroll sticks to bottom as messages stream
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [groups.length]);

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50 m-0 md:m-4 lg:m-8 bg-[var(--surface-1)] border border-[var(--border)] rounded-lg shadow-elev2' : ''} flex flex-col h-full`}>
      <div className="px-4 h-12 border-b border-[var(--border)] flex items-center justify-between">
        <div className="text-sm text-textDim">Run {run.id.slice(0, 8)} · <span className="uppercase">{status}</span></div>
        <div className="flex items-center gap-2">
          <a className="text-xs text-textDim hover:text-text" href={`/api/runs/${run.id}/results.csv`} target="_blank" rel="noreferrer">Export CSV</a>
          <a className="text-xs text-textDim hover:text-text" href={`/api/runs/${run.id}/results.json`} target="_blank" rel="noreferrer">Export JSON</a>
          <button className={`text-xs px-2 py-1 rounded-md border ${isFullscreen?'border-[var(--accent)] text-[var(--accent)]':'border-[var(--border)] text-textDim'}`} onClick={()=>setIsFullscreen(v=>!v)}>{isFullscreen ? 'Standard' : 'Maximize'}</button>
          <button className={`text-xs px-2 py-1 rounded-md border ${tab==='chat'?'border-[var(--accent)] text-[var(--accent)]':'border-[var(--border)] text-textDim'}`} onClick={()=>setTab('chat')}>Chat</button>
          <button className={`text-xs px-2 py-1 rounded-md border ${tab==='matrix'?'border-[var(--accent)] text-[var(--accent)]':'border-[var(--border)] text-textDim'}`} onClick={()=>setTab('matrix')}>Matrix</button>
          <button className="text-textDim hover:text-text" onClick={onClose}>Close</button>
        </div>

      </div>
      {tab === 'chat' ? (
        <div
          ref={scrollRef}
          className="flex-1 overflow-auto p-4 flex flex-col gap-6"
          aria-live="polite"
          role="log"
          onScroll={(e) => {
            const el = e.currentTarget;
            const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            stickToBottomRef.current = nearBottom;
          }}
        >


          {groups.length === 0 ? (
            <div className="text-center text-textDim py-8">
              {messages.length === 0 ? 'Loading run data...' : 'No problems found in this run'}
            </div>
          ) : groups.map((g, idx) => {
            const promptText = g.prompt || problemPrompts[g.problemId] || `Problem ${g.problemId.slice(0, 8)}`;
            // Debug: log when prompt is empty
            if (!g.prompt && !problemPrompts[g.problemId]) {
              console.log('Empty prompt for problem:', g.problemId, 'Available prompts:', Object.keys(problemPrompts));
            }
            return (
            <SlideIn key={`g-${g.problemId}-${idx}`} direction="up" className="grid gap-3">
              <FadeIn className="flex">
                <div className="bubble bubble-user inline-block">{promptText}</div>
              </FadeIn>
              {g.answers.length === 0 ? (
                <div className="text-xs text-textDim">Waiting for model output…</div>
              ) : (
                g.answers.map((a, jdx) => {
                  const streamingKey = `${g.problemId}-${a.modelId}`;
                  const isStreaming = streamingModels[streamingKey]?.streaming;
                  const isCompleted = completedModels[streamingKey];
                  const hasJudgment = typeof a.score !== 'undefined';
                  return (
                  <SlideIn key={`a-${g.problemId}-${a.modelId}-${jdx}`} direction="left" className="flex justify-end">
                    <div className="bubble bubble-assistant inline-block">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <div className="text-[11px] opacity-70">{modelNameById[a.modelId || ''] || `Model ${a.modelId?.slice(0, 6)}`}</div>
                          {isStreaming && (
                            <div className="flex items-center gap-1">
                              <LoadingBounce className="w-1.5 h-1.5 bg-blue-400 rounded-full">
                                <div />
                              </LoadingBounce>
                              <span className="text-[10px] text-blue-400">generating</span>
                            </div>
                          )}
                          {!isStreaming && isCompleted && !hasJudgment && (
                            <div className="flex items-center gap-1">
                              <Clock size={12} className="text-yellow-400" />
                              <span className="text-[10px] text-yellow-400">
                                {(problemTypes[g.problemId] === 'html' || isHtmlContent(a.text)) ? 'waiting to be judged' : 'judging'}
                              </span>
                            </div>
                          )}
                          {!isStreaming && !isCompleted && !hasJudgment && !(problemTypes[g.problemId] === 'html' || isHtmlContent(a.text)) && (
                            <div className="flex items-center gap-1">
                              <Clock size={12} className="text-yellow-400" />
                              <span className="text-[10px] text-yellow-400">judging</span>
                            </div>
                          )}
                        </div>
                        {hasJudgment && displaySettings.showScores && (
                          <span
                            className={`pill ${(a.score ?? 0) >= 50 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}
                            title={`Score: ${a.score}/100${a.reasoning ? ` | ${a.reasoning}` : ''}`}
                          >
                            {(a.score ?? 0) >= 50 ? 'PASS' : 'FAIL'} ({a.score})
                          </span>
                        )}
                      </div>
                      {(problemTypes[g.problemId] === 'html' || isHtmlContent(a.text)) ? (
                        <div className="grid gap-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-textDim">HTML Preview</span>
                            <button className="icon-btn" title="Open in new tab" onClick={() => openHtmlFullscreen(a.text)}>
                              <ExternalLink size={14} />
                            </button>
                          </div>
                          <SandboxPreview html={extractHtml(a.text)} css={extractCss(a.text)} js={extractJs(a.text)} bare height={isFullscreen ? 600 : 450} />
                        </div>
                      ) : (
                        <div className="content">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              a: ({ node, ...props }) => (
                                <a {...props} target="_blank" rel="noreferrer" className="underline text-[var(--accent)] hover:opacity-90" />
                              ),
                            }}
                          >
                            {displaySettings.showReasoning ? a.text : a.text.replace(/Reasoning:[\s\S]*/i, '')}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </SlideIn>
                  );
                })
              )}
              {g.verdicts.length > 0 && (
                <div className="flex justify-end">
                  <div className="text-xs text-textDim">{g.verdicts.map(v => v.text).join(' · ')}</div>
                </div>
              )}
              {/* Show manual review status for HTML problems */}
              {(problemTypes[g.problemId] === 'html' || (g.answers.length > 0 && g.answers.some(a => isHtmlContent(a.text)))) && g.answers.length > 0 && g.verdicts.length === 0 && (
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 text-orange-400 text-xs">
                    <AlertCircle size={12} />
                    <span>Pending manual review</span>
                  </div>
                  <a
                    href="/manual-review"
                    className="text-xs px-2 py-1 rounded-md bg-orange-100 text-orange-800 hover:bg-orange-200 transition-colors"
                  >
                    Review Now
                  </a>
                </div>
              )}
            </SlideIn>
            );
          })}
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-4">
          <MatrixView groups={groups} modelNameById={modelNameById} />
        </div>
      )}
    </div>
  );
}

function groupByProblem(messages: Message[]) {
  console.log('Grouping messages:', messages.length, 'total messages');
  const byId = new Map<string, { problemId: string; prompt: string; answers: Message[]; verdicts: Message[] }>();

  // First pass: collect all problem prompts
  const problemPrompts = new Set<string>();
  for (const m of messages) {
    if (m.who === 'problem') {
      problemPrompts.add(m.problemId);
    }
  }

  for (const m of messages) {
    let g = byId.get(m.problemId);
    if (!g) {
      g = { problemId: m.problemId, prompt: '', answers: [], verdicts: [] };
      byId.set(m.problemId, g);
    }
    if (m.who === 'problem') {
      g.prompt = m.text;
      console.log('Setting prompt for', m.problemId, ':', m.text.slice(0, 50) + '...');
    }
    if (m.who === 'model') g.answers.push(m);
    if (m.who === 'judge') g.verdicts.push(m);
  }

  // Only return groups that have a problem prompt message
  const result = Array.from(byId.values()).filter(g => problemPrompts.has(g.problemId));
  console.log('Grouped into', result.length, 'groups (filtered for prompts):', result.map(g => ({ id: g.problemId, promptLength: g.prompt.length, answers: g.answers.length })));
  return result;
}

function MatrixView({ groups, modelNameById }: { groups: Array<{ problemId: string; prompt: string; answers: Message[]; verdicts: Message[] }>; modelNameById: Record<string, string> }) {
  const modelIds = useMemo(
    () => Array.from(new Set(groups.flatMap(g => g.answers.map(a => a.modelId || '')))).filter(Boolean),
    [groups]
  );
  return (
    <div className="h-full flex flex-col">
      {/* Fixed header row */}
      <div className="flex-shrink-0 min-w-[720px] overflow-x-auto">
        <div className="grid" style={{ gridTemplateColumns: `240px repeat(${modelIds.length}, minmax(220px, 1fr))` }}>
          <div className="text-xs text-textDim p-2 border-b border-[var(--border)] bg-[var(--surface-1)] font-medium h-10 flex items-center">Problem</div>
          {modelIds.map(mid => {
            const label = modelNameById[mid] || String(mid).slice(0, 6);
            return (
              <div key={mid} className="text-xs text-textDim p-2 border-b border-[var(--border)] bg-[var(--surface-1)] font-medium h-10 flex items-center">{label}</div>
            );
          })}
        </div>
      </div>

      {/* Scrollable content rows */}
      <div className="flex-1 overflow-auto min-w-[720px]">
        <div className="grid" style={{ gridTemplateColumns: `240px repeat(${modelIds.length}, minmax(220px, 1fr))` }}>
          {groups.map((g, gi) => (
            <div key={`row-${g.problemId}-${gi}`} className="contents">
              <div className="p-3 sticky left-0 bg-[var(--surface-1)] border-b border-[var(--border)] min-h-[80px] flex items-start">
                <div className="text-sm whitespace-pre-wrap leading-relaxed">{g.prompt}</div>
              </div>
              {modelIds.map((mid, mi) => {
                const msg = g.answers.find(a => a.modelId === mid);
                const verdict = g.verdicts.find(v => v.modelId === mid);
                const pass = verdict?.text?.includes('PASS') || (typeof msg?.score !== 'undefined' && msg.score !== null ? msg.score >= 50 : undefined);
                return (
                  <div key={`cell-${gi}-${mi}`} className="p-3 border-b border-l border-[var(--border)] min-h-[80px] flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-textDim">{verdict?.text || '—'}</span>
                      {typeof pass !== 'undefined' && (
                        <span className={`pill ${pass ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>{pass ? 'PASS' : 'FAIL'}</span>
                      )}
                    </div>
                    <div className="text-xs whitespace-pre-wrap flex-1 overflow-auto">
                      {msg?.text || 'Waiting…'}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function isHtmlContent(text: string): boolean {
  // Check if text contains HTML-like content patterns
  return !!(
    text.match(/```html\n[\s\S]*?\n```/) ||
    text.match(/<html[\s\S]*?<\/html>/i) ||
    text.match(/<(!DOCTYPE|html|head|body|div|canvas|script|style)/i)
  );
}

function extractHtml(text: string): string {
  // First try to extract from markdown code blocks (```html...```)
  const markdownHtmlMatch = text.match(/```html\n([\s\S]*?)\n```/);
  if (markdownHtmlMatch && markdownHtmlMatch[1]) return markdownHtmlMatch[1];

  // Then try to extract <html>...</html> tags
  const htmlMatch = text.match(/<html[\s\S]*?<\/html>/i);
  if (htmlMatch) return htmlMatch[0];

  // If no html tag, return text as-is (might be body content)
  return text;
}
function extractCss(text: string): string | undefined {
  // First try to extract from markdown code blocks (```css...```)
  const markdownCssMatch = text.match(/```css\n([\s\S]*?)\n```/);
  if (markdownCssMatch) return markdownCssMatch[1];

  // Then try to extract from <style> tags
  const cssMatch = text.match(/<style[^>]*>([\s\s]*?)<\/style>/i);
  return cssMatch ? cssMatch[1] : undefined;
}
function extractJs(text: string): string | undefined {
  // First try to extract from markdown code blocks (```js...``` or ```javascript...```)
  const markdownJsMatch = text.match(/```(?:js|javascript)\n([\s\S]*?)\n```/);
  if (markdownJsMatch) return markdownJsMatch[1];

  // Then try to extract from <script> tags
  const jsMatch = text.match(/<script[^>]*>([\s\s]*?)<\/script>/i);
  return jsMatch ? jsMatch[1] : undefined;
}

function openHtmlFullscreen(source: string) {
  const html = extractHtml(source);
  const css = extractCss(source);
  const js = extractJs(source);
  const data = new Blob([buildStandaloneDoc(html, css, js)], { type: 'text/html' });
  const url = URL.createObjectURL(data);
  window.open(url, '_blank', 'noopener,noreferrer');
}

function buildStandaloneDoc(html?: string, css?: string, js?: string): string {
  const safeHtml = String(html || '');
  const safeCss = String(css || '');
  const safeJs = String(js || '');
  return `<!doctype html><html><head><meta charset="utf-8"/><style>${safeCss}</style></head><body>${safeHtml}<script>${safeJs}<\/script></body></html>`;
}


