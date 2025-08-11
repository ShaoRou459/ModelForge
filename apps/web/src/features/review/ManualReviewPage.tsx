import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPendingManualReviews, submitManualReview, type ManualReview } from '../../lib/api';
import SandboxPreview from '../problems/SandboxPreview';
import { CheckCircle, XCircle, Clock, AlertCircle, ExternalLink } from 'lucide-react';

export default function ManualReviewPage() {
  const [selectedReview, setSelectedReview] = useState<ManualReview | null>(null);
  const qc = useQueryClient();

  const { data: reviews, isLoading, error } = useQuery({
    queryKey: ['manual-reviews'],
    queryFn: () => getPendingManualReviews(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Group reviews by problem (question)
  const groupedReviews = reviews?.reduce((groups, review) => {
    const key = review.problem_id;
    if (!groups[key]) {
      groups[key] = {
        problem_id: review.problem_id,
        problem_prompt: review.problem_prompt,
        problem_set_name: review.problem_set_name,
        reviews: []
      };
    }
    groups[key].reviews.push(review);
    return groups;
  }, {} as Record<string, { problem_id: string; problem_prompt: string; problem_set_name: string; reviews: ManualReview[] }>) || {};

  const reviewMutation = useMutation({
    mutationFn: ({ decision }: { decision: 'pass' | 'fail' }) =>
      submitManualReview(selectedReview!.id, decision),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['manual-reviews'] });
      // Move to next review or clear selection
      if (reviews && reviews.length > 1) {
        const currentIndex = reviews.findIndex(r => r.id === selectedReview?.id);
        const nextReview = reviews[currentIndex + 1];
        setSelectedReview(nextReview ?? null);
      } else {
        setSelectedReview(null);
      }
    },
  });

  const handleReview = (decision: 'pass' | 'fail') => {
    if (!selectedReview) return;
    reviewMutation.mutate({ decision });
  };

  // Auto-select first review if none selected
  if (reviews && reviews.length > 0 && !selectedReview) {
    setSelectedReview(reviews[0] ?? null);
  }

  const extractHtml = (output: string) => {
    const htmlMatch = output.match(/```html\n([\s\S]*?)\n```/);
    return htmlMatch ? htmlMatch[1] : output;
  };

  const extractCss = (output: string) => {
    const cssMatch = output.match(/```css\n([\s\S]*?)\n```/);
    return cssMatch ? cssMatch[1] : '';
  };

  const extractJs = (output: string) => {
    const jsMatch = output.match(/```(?:js|javascript)\n([\s\S]*?)\n```/);
    return jsMatch ? jsMatch[1] : '';
  };

  const openHtmlFullscreen = (output: string) => {
    const html = extractHtml(output);
    const css = extractCss(output);
    const js = extractJs(output);
    
    const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>${css}</style>
</head>
<body>
  ${html}
  <script>${js}</script>
</body>
</html>`;
    
    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-textDim loading-pulse">Loading pending reviews...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-red-400">Error loading reviews: {String(error)}</div>
      </div>
    );
  }

  if (!reviews || reviews.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-textDim">
        <CheckCircle size={48} className="mb-4 text-green-400" />
        <h2 className="text-lg font-medium mb-2">All caught up!</h2>
        <p className="text-sm">No HTML problems are pending manual review.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
        <div>
          <h1 className="text-xl font-semibold">Manual Review</h1>
          <p className="text-sm text-textDim mt-1">
            Review HTML problems that require human judgment ({reviews.length} pending)
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-textDim">
          <Clock size={16} />
          <span>Auto-refreshes every 30s</span>
        </div>
      </div>

      {/* Three-Column Layout */}
      <div className="flex-1 min-h-0 grid grid-cols-[320px_1fr_280px] gap-0">
        {/* Column 1: Questions & Reviews Queue */}
        <div className="border-r border-[var(--border)] bg-[var(--surface-0)] flex flex-col min-h-0">
          <div className="p-4 border-b border-[var(--border)] flex-shrink-0">
            <h3 className="font-medium text-sm">Questions & Reviews</h3>
            <p className="text-xs text-textDim mt-1">Grouped by question ({Object.keys(groupedReviews).length} questions)</p>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            {Object.values(groupedReviews).map((group) => (
              <div key={group.problem_id} className="border-b border-[var(--border)]">
                {/* Question Header */}
                <div className="p-3 bg-[var(--surface-1)] border-b border-[var(--border)]">
                  <h4 className="font-medium text-sm text-[var(--accent)] mb-1">
                    {group.problem_set_name}
                  </h4>
                  <p className="text-xs text-textDim line-clamp-2 leading-relaxed">
                    {group.problem_prompt.slice(0, 120)}...
                  </p>
                  <div className="text-xs text-textDim mt-1">
                    {group.reviews.length} submission{group.reviews.length !== 1 ? 's' : ''}
                  </div>
                </div>

                {/* Submissions for this question */}
                <div className="max-h-48 overflow-y-auto">
                  {group.reviews.map((review) => (
                    <div
                      key={review.id}
                      className={`p-3 border-b border-[var(--border)] cursor-pointer transition-all duration-200 ${
                        selectedReview?.id === review.id
                          ? 'bg-[var(--accent)] bg-opacity-10 border-l-2 border-l-[var(--accent)]'
                          : 'hover:bg-[var(--surface-1)]'
                      }`}
                      onClick={() => setSelectedReview(review)}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex-1 min-w-0">
                          <h5 className="font-medium text-sm truncate">{review.model_name}</h5>
                          <p className="text-xs text-textDim">
                            {new Date(review.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <AlertCircle size={12} className="text-orange-400 mt-0.5 flex-shrink-0" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Column 2: HTML Preview */}
        <div className="flex flex-col bg-[var(--surface-0)]">
          {selectedReview ? (
            <>
              {/* Preview Header */}
              <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{selectedReview.model_name}</h3>
                  <p className="text-sm text-textDim">{selectedReview.problem_set_name}</p>
                </div>
                <button
                  className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border border-[var(--border)] hover:bg-[var(--surface-1)] transition-colors"
                  onClick={() => openHtmlFullscreen(selectedReview.output || '')}
                >
                  <ExternalLink size={14} />
                  Open in new tab
                </button>
              </div>

              {/* HTML Preview Area */}
              <div className="flex-1 p-4 overflow-hidden">
                <div className="h-full w-full rounded-lg overflow-hidden border border-[var(--border)]">
                  <SandboxPreview
                    html={extractHtml(selectedReview.output || '')}
                    css={extractCss(selectedReview.output || '')}
                    js={extractJs(selectedReview.output || '')}
                    height="100%"
                    bare
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-textDim">
              <div className="text-center">
                <AlertCircle size={48} className="mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">Select a review</p>
                <p className="text-sm">Choose a pending review from the left to start</p>
              </div>
            </div>
          )}
        </div>

        {/* Column 3: Controls & Info */}
        <div className="border-l border-[var(--border)] bg-[var(--surface-0)] flex flex-col">
          {selectedReview ? (
            <>
              {/* Problem Info */}
              <div className="p-4 border-b border-[var(--border)]">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle size={16} className="text-orange-400" />
                  <span className="text-sm font-medium text-orange-400">Needs Review</span>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-textDim mb-2">Problem</h4>
                    <div className="p-3 bg-[var(--surface-1)] rounded-md max-h-32 overflow-auto">
                      <p className="text-sm whitespace-pre-wrap">{selectedReview.problem_prompt}</p>
                    </div>
                  </div>

                  {selectedReview.expected_answer && (
                    <div>
                      <h4 className="text-sm font-medium text-textDim mb-2">Expected</h4>
                      <div className="p-3 bg-[var(--surface-1)] rounded-md max-h-24 overflow-auto">
                        <p className="text-sm whitespace-pre-wrap">{selectedReview.expected_answer}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Review Actions */}
              <div className="flex-1 p-4 flex flex-col justify-end">
                <div className="space-y-3">
                  <button
                    onClick={() => handleReview('pass')}
                    disabled={reviewMutation.isPending}
                    className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
                  >
                    <CheckCircle size={20} />
                    {reviewMutation.isPending ? 'Submitting...' : 'Pass'}
                  </button>
                  <button
                    onClick={() => handleReview('fail')}
                    disabled={reviewMutation.isPending}
                    className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
                  >
                    <XCircle size={20} />
                    {reviewMutation.isPending ? 'Submitting...' : 'Fail'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-textDim p-4">
              <div className="text-center">
                <p className="text-sm">Review controls will appear here when you select a pending review</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
