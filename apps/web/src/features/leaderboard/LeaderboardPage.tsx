import { useQuery } from '@tanstack/react-query';
import { Trophy, Medal, Award, TrendingUp, TrendingDown, Calendar, Target, BarChart3, Info } from 'lucide-react';
import { getLeaderboard, type LeaderboardEntry } from '../../lib/api';
import { FadeIn, LoadingSpinner, AnimatedCard, AnimatedList, AnimatedListItem } from '../../components/animations';

function getRankIcon(rank: number) {
  switch (rank) {
    case 1:
      return <Trophy className="text-yellow-500" size={24} />;
    case 2:
      return <Medal className="text-gray-400" size={24} />;
    case 3:
      return <Award className="text-amber-600" size={24} />;
    default:
      return <div className="w-6 h-6 rounded-full bg-[var(--surface-1)] flex items-center justify-center text-sm font-medium text-textDim">#{rank}</div>;
  }
}

function formatScore(score: number): string {
  return score.toFixed(1);
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString();
}

function LeaderboardEntry({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  const isComplete = entry.problem_sets_completed === entry.total_problem_sets;
  const completionRate = (entry.problem_sets_completed / entry.total_problem_sets) * 100;

  return (
    <AnimatedCard className="card p-6 hover:bg-[var(--surface-1)] transition-all duration-200">
      <div className="flex items-center gap-4">
        {/* Rank */}
        <div className="flex-shrink-0">
          {getRankIcon(rank)}
        </div>

        {/* Model Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-semibold truncate">{entry.model_name}</h3>
            <span className="text-sm text-textDim">({entry.provider_name})</span>
            {!isComplete && (
              <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-400">
                Incomplete
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-4 text-sm text-textDim">
            <div className="flex items-center gap-1">
              <Target size={14} />
              <span>{formatScore(entry.average_accuracy)}% avg accuracy</span>
            </div>
            <div className="flex items-center gap-1">
              <BarChart3 size={14} />
              <span>{entry.problem_sets_completed}/{entry.total_problem_sets} problem sets</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar size={14} />
              <span>Last run: {formatDate(entry.last_run_date)}</span>
            </div>
          </div>
        </div>

        {/* Score */}
        <div className="text-right">
          <div className="text-2xl font-bold text-[var(--accent)]">
            {isComplete ? formatScore(entry.final_score) : '--'}
          </div>
          <div className="text-sm text-textDim">
            {isComplete ? 'Final Score' : `${completionRate.toFixed(0)}% complete`}
          </div>
        </div>
      </div>

      {/* Problem Set Breakdown */}
      {isComplete && (
        <div className="mt-4 pt-4 border-t border-[var(--border)]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {entry.problem_set_scores.map((ps) => (
              <div key={ps.problem_set_id} className="flex justify-between items-center p-2 rounded bg-[var(--surface-1)]">
                <span className="text-sm truncate">{ps.problem_set_name}</span>
                <span className="text-sm font-medium text-[var(--accent)]">{formatScore(ps.accuracy)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </AnimatedCard>
  );
}

export default function LeaderboardPage() {
  const { data: leaderboard, isLoading, error } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: getLeaderboard,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6 text-center">
        <div className="text-red-400 mb-2">Failed to load leaderboard</div>
        <div className="text-sm text-textDim">{error instanceof Error ? error.message : 'Unknown error'}</div>
      </div>
    );
  }

  const completeEntries = leaderboard?.filter(entry => 
    entry.problem_sets_completed === entry.total_problem_sets
  ) || [];
  
  const incompleteEntries = leaderboard?.filter(entry => 
    entry.problem_sets_completed < entry.total_problem_sets
  ) || [];

  return (
    <FadeIn className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Trophy className="text-[var(--accent)]" size={28} />
            Overall Leaderboard
          </h1>
          <p className="text-textDim mt-1">
            Rankings based on performance across all benchmark problem sets
          </p>
        </div>
      </div>

      {/* Scoring Info */}
      <AnimatedCard className="card p-4 bg-[var(--surface-1)]">
        <div className="flex items-start gap-3">
          <Info size={20} className="text-[var(--accent)] mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <div className="font-medium mb-1">Scoring System</div>
            <div className="text-textDim">
              Models must complete runs across <strong>all problem sets</strong> to be eligible for ranking. 
              Final scores consider average accuracy, consistency across problem types, and recency of results.
            </div>
          </div>
        </div>
      </AnimatedCard>

      {/* Complete Rankings */}
      {completeEntries.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Trophy size={20} className="text-[var(--accent)]" />
            Official Rankings
          </h2>
          <AnimatedList className="space-y-4">
            {completeEntries.map((entry, index) => (
              <AnimatedListItem key={entry.model_id}>
                <LeaderboardEntry entry={entry} rank={index + 1} />
              </AnimatedListItem>
            ))}
          </AnimatedList>
        </div>
      )}

      {/* Incomplete Entries */}
      {incompleteEntries.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 size={20} className="text-textDim" />
            Incomplete Coverage
            <span className="text-sm font-normal text-textDim">
              (Need to complete all problem sets for ranking)
            </span>
          </h2>
          <AnimatedList className="space-y-4">
            {incompleteEntries.map((entry) => (
              <AnimatedListItem key={entry.model_id}>
                <LeaderboardEntry entry={entry} rank={0} />
              </AnimatedListItem>
            ))}
          </AnimatedList>
        </div>
      )}

      {/* Empty State */}
      {(!leaderboard || leaderboard.length === 0) && (
        <AnimatedCard className="card p-8 text-center">
          <Trophy size={48} className="text-textDim mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No Models Yet</h3>
          <p className="text-textDim">
            Run some benchmarks to see models appear on the leaderboard!
          </p>
        </AnimatedCard>
      )}
    </FadeIn>
  );
}