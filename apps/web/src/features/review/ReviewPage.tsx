import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getProblemSetsWithLatestResults,
  getProblemSetLatestPerformance,
  getModelDetailedResults,
  type ProblemSetWithLatestRun,
  type ModelPerformance
} from '../../lib/api';
import { ArrowLeft, Trophy, Target, CheckCircle, XCircle, Clock, ChevronDown, ChevronRight, FileText, Code, MessageSquare } from 'lucide-react';
import { FadeIn, LoadingSpinner, LoadingPulse, AnimatedList, AnimatedListItem, AnimatedCard } from '../../components/animations';

type ViewState =
  | { type: 'problem-sets' }
  | { type: 'performance'; problemSet: ProblemSetWithLatestRun }
  | { type: 'model-details'; problemSet: ProblemSetWithLatestRun; model: ModelPerformance; runId: string };

export default function ReviewPage() {
  const [viewState, setViewState] = useState<ViewState>({ type: 'problem-sets' });

  const handleBack = () => {
    if (viewState.type === 'model-details') {
      setViewState({ type: 'performance', problemSet: viewState.problemSet });
    } else if (viewState.type === 'performance') {
      setViewState({ type: 'problem-sets' });
    }
  };

  return (
    <div className="h-full flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4 animate-slide-in-down">
        {viewState.type !== 'problem-sets' && (
          <button
            onClick={handleBack}
            className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-[var(--surface-1)] transition-all duration-200 hover:scale-105"
          >
            <ArrowLeft size={16} />
            <span className="text-sm">Back</span>
          </button>
        )}
        <div>
          <h1 className="text-xl font-semibold">
            {viewState.type === 'problem-sets' && 'Review Results'}
            {viewState.type === 'performance' && `${viewState.problemSet.name} - Model Performance`}
            {viewState.type === 'model-details' && `${viewState.model.model_name} - Detailed Results`}
          </h1>
          {viewState.type === 'problem-sets' && (
            <p className="text-sm text-textDim mt-1">View benchmark results organized by problem sets</p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 animate-fade-in">
        {viewState.type === 'problem-sets' && (
          <ProblemSetsView onSelectProblemSet={(ps) => setViewState({ type: 'performance', problemSet: ps })} />
        )}
        {viewState.type === 'performance' && (
          <PerformanceView
            problemSet={viewState.problemSet}
            onSelectModel={(model, runId) => setViewState({
              type: 'model-details',
              problemSet: viewState.problemSet,
              model,
              runId
            })}
          />
        )}
        {viewState.type === 'model-details' && (
          <ModelDetailsView
            model={viewState.model}
            runId={viewState.runId}
          />
        )}
      </div>
    </div>
  );
}

function ProblemSetsView({ onSelectProblemSet }: { onSelectProblemSet: (ps: ProblemSetWithLatestRun) => void }) {
  const { data: problemSets, isLoading, error } = useQuery({
    queryKey: ['problem-sets-with-results'],
    queryFn: getProblemSetsWithLatestResults,
  });

  if (isLoading) {
    return (
      <FadeIn className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3">
          <LoadingSpinner className="text-textDim" />
          <LoadingPulse className="text-textDim">Loading problem sets...</LoadingPulse>
        </div>
      </FadeIn>
    );
  }

  if (error) {
    return (
      <FadeIn className="flex items-center justify-center h-64">
        <div className="text-red-400">Error loading problem sets: {String(error)}</div>
      </FadeIn>
    );
  }

  if (!problemSets?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-textDim animate-fade-in">
        <p>No problem sets found.</p>
        <p className="text-xs mt-2">Create some problem sets and run benchmarks to see results here.</p>
      </div>
    );
  }

  return (
    <AnimatedList className="grid gap-4">
      {problemSets.map((ps, index) => (
        <AnimatedListItem key={ps.id}>
          <AnimatedCard
            className="card p-6 cursor-pointer"
            onClick={() => onSelectProblemSet(ps)}
          >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-medium">{ps.name}</h3>
              {ps.description && (
                <p className="text-sm text-textDim mt-1">{ps.description}</p>
              )}
              <div className="flex items-center gap-4 mt-3 text-xs text-textDim">
                <span>Created {new Date(ps.created_at).toLocaleDateString()}</span>
                {ps.latest_run_date && (
                  <span>Latest run: {new Date(ps.latest_run_date).toLocaleDateString()}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {ps.latest_run_id ? (
                <div className="flex items-center gap-1 text-green-400 animate-scale-in">
                  <CheckCircle size={16} />
                  <span className="text-xs">Results Available</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-textDim">
                  <Clock size={16} />
                  <span className="text-xs">No Results</span>
                </div>
              )}
            </div>
          </div>
          </AnimatedCard>
        </AnimatedListItem>
      ))}
    </AnimatedList>
  );
}

function PerformanceView({
  problemSet,
  onSelectModel
}: {
  problemSet: ProblemSetWithLatestRun;
  onSelectModel: (model: ModelPerformance, runId: string) => void;
}) {
  const { data: performance, isLoading, error } = useQuery({
    queryKey: ['problem-set-performance', problemSet.id],
    queryFn: () => getProblemSetLatestPerformance(problemSet.id),
    enabled: !!problemSet.latest_run_id,
  });

  if (!problemSet.latest_run_id) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-textDim animate-fade-in">
        <p>No completed runs found for this problem set.</p>
        <p className="text-xs mt-2">Run a benchmark to see model performance results.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <FadeIn className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3">
          <LoadingSpinner className="text-textDim" />
          <LoadingPulse className="text-textDim">Loading performance data...</LoadingPulse>
        </div>
      </FadeIn>
    );
  }

  if (error) {
    return (
      <FadeIn className="flex items-center justify-center h-64">
        <div className="text-red-400">Error loading performance: {String(error)}</div>
      </FadeIn>
    );
  }

  if (!performance?.models?.length) {
    return (
      <FadeIn className="flex flex-col items-center justify-center h-64 text-textDim">
        <p>No model results found.</p>
      </FadeIn>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="card p-6 animate-slide-in-down">
        <div className="flex items-center gap-3 mb-4">
          <Target className="text-[var(--accent)]" size={20} />
          <h2 className="text-lg font-medium">Model Rankings</h2>
        </div>
        <p className="text-sm text-textDim">
          Results from latest run on {problemSet.latest_run_date ? new Date(problemSet.latest_run_date).toLocaleDateString() : 'unknown date'}
        </p>
      </div>

      {/* Model Rankings */}
      <AnimatedList className="space-y-3">
        {performance.models.map((model, index) => (
          <AnimatedListItem key={model.model_id}>
            <AnimatedCard
              className="card p-6 cursor-pointer"
              onClick={() => onSelectModel(model, performance.run_id)}
            >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  {index === 0 && <Trophy className="text-yellow-400 animate-bounce-in" size={20} />}
                  <span className="text-2xl font-bold text-textDim">#{index + 1}</span>
                </div>
                <div>
                  <h3 className="text-lg font-medium">{model.model_name}</h3>
                  <p className="text-sm text-textDim">
                    {model.correct_answers} of {model.total_problems} problems correct
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-[var(--accent)] animate-scale-in" style={{ animationDelay: `${index * 0.1 + 0.2}s` }}>
                  {model.accuracy_percentage}%
                </div>
                <div className="text-xs text-textDim">Accuracy</div>
              </div>
            </div>
            </AnimatedCard>
          </AnimatedListItem>
        ))}
      </AnimatedList>
    </div>
  );
}

function ModelDetailsView({
  model,
  runId
}: {
  model: ModelPerformance;
  runId: string;
}) {
  const [selectedProblemId, setSelectedProblemId] = useState<string | null>(null);
  const [problemDetailsExpanded, setProblemDetailsExpanded] = useState(false);
  const [judgeCommentsOpen, setJudgeCommentsOpen] = useState(false);
  const [responseFormat, setResponseFormat] = useState<'markdown' | 'plain'>('plain');

  // Handle escape key to close judge comments modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && judgeCommentsOpen) {
        setJudgeCommentsOpen(false);
      }
    };

    if (judgeCommentsOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [judgeCommentsOpen]);

  const { data: results, isLoading, error } = useQuery({
    queryKey: ['model-detailed-results', runId, model.model_id],
    queryFn: () => getModelDetailedResults(runId, model.model_id),
  });

  if (isLoading) {
    return (
      <FadeIn className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3">
          <LoadingSpinner className="text-textDim" />
          <LoadingPulse className="text-textDim">Loading detailed results...</LoadingPulse>
        </div>
      </FadeIn>
    );
  }

  if (error) {
    return (
      <FadeIn className="flex items-center justify-center h-64">
        <div className="text-red-400">Error loading results: {String(error)}</div>
      </FadeIn>
    );
  }

  if (!results?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-textDim animate-fade-in">
        <p>No detailed results found.</p>
      </div>
    );
  }

  const selectedResult = selectedProblemId ? results.find(r => r.problem_id === selectedProblemId) : results[0];

  return (
    <div className="h-full flex gap-6 animate-fade-in">
      {/* Left Sidebar - Problem List */}
      <div className="w-52 flex flex-col gap-4 animate-slide-in-up">
        <div className="card p-4">
          <div className="flex items-center gap-3 mb-3">
            <Trophy className="text-[var(--accent)] animate-scale-in" size={18} />
            <h3 className="font-medium">{model.model_name}</h3>
          </div>
          <div className="text-sm text-textDim">
            <div>Accuracy: <span className="text-[var(--accent)] font-medium animate-scale-in">{model.accuracy_percentage}%</span></div>
            <div>Correct: {model.correct_answers}/{model.total_problems}</div>
          </div>
        </div>

        <div className="card flex-1 min-h-0 flex flex-col">
          <div className="p-4 border-b border-[var(--border)] flex-shrink-0">
            <h4 className="font-medium">Problems</h4>
            <p className="text-xs text-textDim mt-1">Click to view details</p>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
            {results.map((result, index) => (
              <div
                key={result.problem_id}
                className={`p-3 border-b border-[var(--border)] cursor-pointer transition-all duration-200 animate-slide-in-up ${
                  selectedProblemId === result.problem_id || (!selectedProblemId && index === 0)
                    ? 'bg-[var(--surface-1)]'
                    : 'hover:bg-[var(--surface-1)] hover:scale-[1.02]'
                }`}
                style={{ animationDelay: `${index * 0.05}s` }}
                onClick={() => setSelectedProblemId(result.problem_id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Problem {index + 1}</span>
                  <div className="flex items-center gap-1">
                    {result.score != null ? (
                      result.score >= 50 ? (
                        <CheckCircle size={16} className="text-green-400 animate-scale-in" />
                      ) : (
                        <XCircle size={16} className="text-red-400 animate-scale-in" />
                      )
                    ) : (
                      <Clock size={16} className="text-textDim" />
                    )}
                  </div>
                </div>
                <p className="text-xs text-textDim line-clamp-2 break-words">
                  {result.problem_prompt.slice(0, 60)}...
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Content - Problem Details */}
      <div className="flex-1 min-h-0 animate-slide-in-up" style={{ animationDelay: '0.2s' }}>
        {selectedResult && (
          <div className="h-full flex flex-col gap-4">
            {/* Problem Header with Evaluation */}
            <div className="card animate-scale-in">
              <div className="p-6 border-b border-[var(--border)]">
                <div className="flex items-start justify-between">
                  <h3 className="text-lg font-medium">
                    Problem {results.findIndex(r => r.problem_id === selectedResult.problem_id) + 1}
                  </h3>

                  {/* Evaluation Section - Horizontal Layout */}
                  {selectedResult.score != null && (
                    <div className="bg-[var(--surface-1)] rounded-lg p-4 border border-[var(--border)] min-w-[300px]">
                      <div className="flex items-center justify-between">
                        {/* Score Display - Horizontal */}
                        <div className="flex items-center gap-4">
                          <div className="text-2xl font-bold text-[var(--accent)]">
                            {selectedResult.score}/100
                          </div>
                          <div className="flex items-center gap-2">
                            {selectedResult.score >= 50 ? (
                              <>
                                <CheckCircle size={18} className="text-green-400" />
                                <span className="text-green-400 font-medium">Passed</span>
                              </>
                            ) : (
                              <>
                                <XCircle size={18} className="text-red-400" />
                                <span className="text-red-400 font-medium">Failed</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Judge Comments Button */}
                        {selectedResult.judge_reasoning && (
                          <button
                            onClick={() => setJudgeCommentsOpen(true)}
                            className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--surface-2)] rounded transition-colors text-textDim hover:text-text"
                          >
                            <MessageSquare size={16} />
                            <span className="text-sm font-medium">Judge Comments</span>
                            <ChevronRight size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Combined Problem Details */}
              <div className="border-t border-[var(--border)]">
                <button
                  onClick={() => setProblemDetailsExpanded(!problemDetailsExpanded)}
                  className="w-full p-4 flex items-center justify-between hover:bg-[var(--surface-1)] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-textDim" />
                    <h4 className="text-sm font-medium text-textDim">Problem Details</h4>
                    {problemDetailsExpanded ? (
                      <ChevronDown size={16} className="text-textDim" />
                    ) : (
                      <ChevronRight size={16} className="text-textDim" />
                    )}
                  </div>
                  <div className="text-xs text-textDim">
                    {problemDetailsExpanded ? 'Collapse' : 'View problem & expected answer'}
                  </div>
                </button>
                {problemDetailsExpanded && (
                  <div className="px-4 pb-4 space-y-4">
                    {/* Problem Prompt */}
                    <div>
                      <h5 className="text-xs font-medium text-textDim mb-2 flex items-center gap-2">
                        <FileText size={14} />
                        Problem Prompt
                      </h5>
                      <div className="p-4 bg-[var(--surface-1)] rounded-md">
                        <p className="text-sm whitespace-pre-wrap">{selectedResult.problem_prompt}</p>
                      </div>
                    </div>

                    {/* Expected Answer */}
                    {selectedResult.expected_answer && (
                      <div>
                        <h5 className="text-xs font-medium text-textDim mb-2 flex items-center gap-2">
                          <Target size={14} />
                          Expected Answer
                        </h5>
                        <div className="p-4 bg-[var(--surface-1)] rounded-md">
                          <p className="text-sm whitespace-pre-wrap">{selectedResult.expected_answer}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Model Response */}
            <div className="card flex-1 min-h-0 flex flex-col animate-scale-in" style={{ animationDelay: '0.3s' }}>
              <div className="p-4 border-b border-[var(--border)] flex items-center justify-between flex-shrink-0">
                <h4 className="text-sm font-medium text-textDim">Model Response</h4>

                {/* Format Toggle for Text Problems */}
                {selectedResult.problem_type === 'text' && selectedResult.output && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-textDim">Format:</span>
                    <div className="flex rounded-md border border-[var(--border)] overflow-hidden">
                      <button
                        onClick={() => setResponseFormat('plain')}
                        className={`px-3 py-1 text-xs transition-colors ${
                          responseFormat === 'plain'
                            ? 'bg-[var(--accent)] text-black'
                            : 'bg-[var(--surface-1)] text-textDim hover:text-text'
                        }`}
                      >
                        <FileText size={12} className="inline mr-1" />
                        Plain Text
                      </button>
                      <button
                        onClick={() => setResponseFormat('markdown')}
                        className={`px-3 py-1 text-xs transition-colors ${
                          responseFormat === 'markdown'
                            ? 'bg-[var(--accent)] text-black'
                            : 'bg-[var(--surface-1)] text-textDim hover:text-text'
                        }`}
                      >
                        <Code size={12} className="inline mr-1" />
                        Markdown
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex-1 min-h-0 p-4">
                {selectedResult.output ? (
                  <div className="h-full bg-[var(--surface-1)] rounded-md overflow-hidden flex flex-col">
                    <div className="flex-1 min-h-0 p-4 overflow-y-auto">
                      {selectedResult.problem_type === 'html' ? (
                        // HTML problems: show rendered output (existing behavior)
                        <pre className="text-sm whitespace-pre-wrap font-mono break-words">{selectedResult.output}</pre>
                      ) : (
                        // Text problems: show with format toggle
                        <>
                          {responseFormat === 'markdown' ? (
                            <div className="prose prose-sm max-w-none text-sm">
                              {/* Simple markdown rendering - you could use a proper markdown library here */}
                              <div dangerouslySetInnerHTML={{
                                __html: selectedResult.output
                                  .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                  .replace(/\*(.*?)\*/g, '<em>$1</em>')
                                  .replace(/`(.*?)`/g, '<code>$1</code>')
                                  .replace(/\n/g, '<br>')
                              }} />
                            </div>
                          ) : (
                            <pre className="text-sm whitespace-pre-wrap font-mono break-words">{selectedResult.output}</pre>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-32 text-textDim animate-fade-in">
                    <p>No response available</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Judge Comments Modal */}
      {judgeCommentsOpen && selectedResult?.judge_reasoning && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in"
          onClick={() => setJudgeCommentsOpen(false)}
        >
          <div
            className="bg-[var(--surface-1)] rounded-lg border border-[var(--border)] max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare size={18} className="text-[var(--accent)]" />
                <h3 className="font-medium">Judge Comments</h3>
              </div>
              <button
                onClick={() => setJudgeCommentsOpen(false)}
                className="p-1 hover:bg-[var(--surface-2)] rounded transition-colors"
              >
                <XCircle size={18} className="text-textDim hover:text-text" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="p-4 bg-[var(--surface-2)] rounded-md">
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{selectedResult.judge_reasoning}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


