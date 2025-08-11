import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createProblemSet, listProblemSets, listProblems, createProblem, updateProblemSet, deleteProblemSet, deleteProblem, updateProblem, listRuns, deleteRunsByProblemSet } from '../../lib/api';
import { useForm } from 'react-hook-form';
import { useEffect, useState } from 'react';
import SandboxPreview from './SandboxPreview';
import { FolderOpen, Folder, Plus, Edit2, Trash2, Eye, X, AlertTriangle } from 'lucide-react';

function ConfirmDialog({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = 'Confirm', 
  cancelText = 'Cancel',
  variant = 'danger' 
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning';
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-[var(--surface-1)] rounded-lg shadow-lg border border-[var(--border)] w-full max-w-md">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 p-2 rounded-full ${
              variant === 'danger' ? 'bg-red-500/20' : 'bg-yellow-500/20'
            }`}>
              <AlertTriangle size={20} className={
                variant === 'danger' ? 'text-red-400' : 'text-yellow-400'
              } />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-medium mb-2">{title}</h3>
              <div className="text-sm text-textDim whitespace-pre-line leading-relaxed">
                {message}
              </div>
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 text-textDim hover:text-text border border-[var(--border)] rounded-md hover:bg-[rgba(255,255,255,0.05)]"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 px-4 py-2 rounded-md font-medium ${
                variant === 'danger' 
                  ? 'bg-red-600 hover:bg-red-700 text-white' 
                  : 'bg-yellow-600 hover:bg-yellow-700 text-white'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProblemSetsSidebar({ 
  sets, 
  activeSetId, 
  dragOverSetId,
  onSelectSet, 
  onDragOver,
  onDropProblem, 
  onRefresh, 
  onRequestDelete 
}: {
  sets: Array<{ id: string; name: string; description?: string | null }>;
  activeSetId: string | null;
  dragOverSetId: string | null;
  onSelectSet: (id: string) => void;
  onDragOver: (id: string | null) => void;
  onDropProblem: (problemId: string, targetSetId: string) => Promise<void>;
  onRefresh: () => void;
  onRequestDelete: (set: { id: string; name: string }) => Promise<void>;
}) {
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [showNewSetForm, setShowNewSetForm] = useState(false);
  
  // Get problem counts for each set
  const problemCounts = useQuery({
    queryKey: ['problemCounts'],
    queryFn: async () => {
      const counts: Record<string, number> = {};
      for (const set of sets) {
        try {
          const problems = await listProblems(set.id);
          counts[set.id] = problems.length;
        } catch {
          counts[set.id] = 0;
        }
      }
      return counts;
    },
    enabled: sets.length > 0,
  });

  return (
    <div className="card p-0 overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
        <h3 className="text-sm font-medium">Problem Sets</h3>
        <button
          onClick={() => setShowNewSetForm(true)}
          className="text-textDim hover:text-text p-1 rounded"
          title="New Problem Set"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Problem Sets List */}
      <div className="flex-1 overflow-auto">
        {sets.map((set, index) => (
          <div key={set.id} className="animate-slide-in-up" style={{ animationDelay: `${index * 0.1}s` }}>
            <ProblemSetItem
              set={set}
              problemCount={problemCounts.data?.[set.id] ?? 0}
              isActive={activeSetId === set.id}
              isEditing={editingSetId === set.id}
              isDragOver={dragOverSetId === set.id}
              onSelect={() => onSelectSet(set.id)}
              onEdit={() => setEditingSetId(set.id)}
              onCancelEdit={() => setEditingSetId(null)}
              onSave={async () => {
                setEditingSetId(null);
                onRefresh();
                problemCounts.refetch();
              }}
              onDelete={async () => {
                try {
                  await onRequestDelete(set);
                } catch (e) {
                  const errorMsg = String(e);
                  if (errorMsg.includes('existing runs')) {
                    alert(`Cannot delete "${set.name}" because it has been used in benchmark runs.\n\nTo delete this problem set, you must first delete all runs that use it.`);
                  } else {
                    alert(`Failed to delete problem set: ${errorMsg}`);
                  }
                }
              }}
              onDragOver={() => onDragOver(set.id)}
              onDragLeave={() => onDragOver(null)}
              onDrop={async (e) => {
                e.preventDefault();
                const problemId = e.dataTransfer.getData('text/plain');
                if (problemId) {
                  await onDropProblem(problemId, set.id);
                  problemCounts.refetch();
                }
                onDragOver(null);
              }}
            />
          </div>
        ))}
      </div>

      {/* New Set Form */}
      {showNewSetForm && (
        <div className="border-t border-[var(--border)] p-4">
          <NewProblemSetForm
            onCancel={() => setShowNewSetForm(false)}
            onCreated={() => {
              setShowNewSetForm(false);
              onRefresh();
              problemCounts.refetch();
            }}
          />
        </div>
      )}
    </div>
  );
}

function ProblemSetItem({
  set,
  problemCount,
  isActive,
  isEditing,
  isDragOver,
  onSelect,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
  onDragOver,
  onDragLeave,
  onDrop
}: {
  set: { id: string; name: string; description?: string | null };
  problemCount: number;
  isActive: boolean;
  isEditing: boolean;
  isDragOver: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => Promise<void>;
  onDelete: () => Promise<void>;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => Promise<void>;
}) {
  const { register, handleSubmit, reset } = useForm({
    defaultValues: { name: set.name, description: set.description || '' }
  });

  const updateMut = useMutation({
    mutationFn: (data: { name: string; description: string }) => 
      updateProblemSet(set.id, data)
  });

  if (isEditing) {
    return (
      <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--surface-2)]">
        <form 
          className="space-y-3"
          onSubmit={handleSubmit(async (data) => {
            try {
              await updateMut.mutateAsync(data);
              await onSave();
            } catch (e) {
              alert(`Failed to update problem set: ${String(e)}`);
            }
          })}
        >
          <div>
            <label className="block text-xs text-textDim mb-1">Problem Set Name</label>
            <input
              {...register('name', { required: true })}
              className="w-full px-3 py-2 text-sm bg-[var(--bg)] border border-[var(--border)] rounded focus-ring"
              placeholder="Enter problem set name"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs text-textDim mb-1">Description (optional)</label>
            <input
              {...register('description')}
              className="w-full px-3 py-2 text-sm bg-[var(--bg)] border border-[var(--border)] rounded focus-ring"
              placeholder="Enter description"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={updateMut.isPending}
              className="px-3 py-1.5 text-sm bg-[var(--accent)] text-black rounded font-medium hover:opacity-90 disabled:opacity-50"
            >
              {updateMut.isPending ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => {
                reset();
                onCancelEdit();
              }}
              className="px-3 py-1.5 text-sm text-textDim hover:text-text border border-[var(--border)] rounded hover:bg-[rgba(255,255,255,0.05)]"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div
      className={`group px-4 py-3 border-b border-[var(--border)] cursor-pointer transition-all duration-200 hover-lift ${
        isActive
          ? 'bg-[rgba(76,194,255,0.12)] border-l-2 border-l-[var(--accent)]'
          : 'hover:bg-[rgba(255,255,255,0.03)]'
      } ${
        isDragOver ? 'bg-[rgba(76,194,255,0.08)] ring-1 ring-[var(--accent)] animate-scale-in' : ''
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver();
      }}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1" onClick={onSelect}>
          <div className="flex items-center gap-2">
            {isActive ? <FolderOpen size={16} className="transition-transform duration-200" /> : <Folder size={16} className="transition-transform duration-200" />}
            <span className="text-sm font-medium">{set.name}</span>
            <span className="text-xs text-textDim bg-[var(--surface-2)] px-1.5 py-0.5 rounded transition-all duration-200 hover:scale-110">
              {problemCount}
            </span>
          </div>
          {set.description && (
            <p className="text-xs text-textDim mt-1 truncate">{set.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-1 text-textDim hover:text-text rounded hover:bg-[rgba(255,255,255,0.1)] transition-all duration-200 hover:scale-110"
            title="Edit problem set"
          >
            <Edit2 size={12} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 text-[var(--danger)] hover:opacity-80 rounded hover:bg-[rgba(255,255,255,0.1)] transition-all duration-200 hover:scale-110"
            title="Delete problem set"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

function NewProblemSetForm({ onCancel, onCreated }: {
  onCancel: () => void;
  onCreated: () => void;
}) {
  const { register, handleSubmit } = useForm<{ name: string; description?: string }>();
  const createMut = useMutation({ mutationFn: createProblemSet });

  return (
    <form
      className="space-y-2"
      onSubmit={handleSubmit(async (data) => {
        try {
          await createMut.mutateAsync(data);
          onCreated();
        } catch (e) {
          alert(String(e));
        }
      })}
    >
      <input
        {...register('name', { required: true })}
        className="w-full px-2 py-1 text-xs bg-surface2 border border-[var(--border)] rounded"
        placeholder="Problem set name"
        autoFocus
      />
      <input
        {...register('description')}
        className="w-full px-2 py-1 text-xs bg-surface2 border border-[var(--border)] rounded"
        placeholder="Description (optional)"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={createMut.isPending}
          className="px-2 py-1 text-xs bg-[var(--accent)] text-black rounded disabled:opacity-50"
        >
          {createMut.isPending ? 'Creating...' : 'Create'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-2 py-1 text-xs text-textDim hover:text-text"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function ProblemsGrid({
  problems,
  loading,
  editingProblemId,
  onEditProblem,
  onDeleteProblem,
  onSaveProblem
}: {
  problems: Array<{ id: string; type: string; prompt: string; expected_answer?: string | null; html_assets?: string | null }>;
  loading: boolean;
  editingProblemId: string | null;
  onEditProblem: (id: string | null) => void;
  onDeleteProblem: (id: string) => Promise<void>;
  onSaveProblem: () => Promise<void>;
}) {
  const [expandedProblemId, setExpandedProblemId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-textDim">
        Loading problems...
      </div>
    );
  }

  if (problems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-textDim">
        <p>No problems in this set yet.</p>
        <p className="text-xs mt-2">Click "New Problem" to add your first one.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 overflow-auto">
      {problems.map(problem => (
        <ProblemCard
          key={problem.id}
          problem={problem}
          isEditing={editingProblemId === problem.id}
          isExpanded={expandedProblemId === problem.id}
          onEdit={() => onEditProblem(editingProblemId === problem.id ? null : problem.id)}
          onDelete={() => onDeleteProblem(problem.id)}
          onToggleExpand={() => setExpandedProblemId(expandedProblemId === problem.id ? null : problem.id)}
          onSave={onSaveProblem}
        />
      ))}
    </div>
  );
}

function ProblemCard({
  problem,
  isEditing,
  isExpanded,
  onEdit,
  onDelete,
  onToggleExpand,
  onSave
}: {
  problem: { id: string; type: string; prompt: string; expected_answer?: string | null; html_assets?: string | null };
  isEditing: boolean;
  isExpanded: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleExpand: () => void;
  onSave: () => Promise<void>;
}) {
  const isHtml = problem.type.toLowerCase() === 'html';
  let htmlAssets: { html?: string; css?: string; js?: string } = {};
  
  if (isHtml && problem.html_assets) {
    try {
      htmlAssets = JSON.parse(problem.html_assets);
    } catch {}
  }

  return (
    <div
      className="border border-[var(--border)] rounded-lg p-4 bg-[var(--surface-1)] hover:bg-[var(--surface-2)] transition-colors"
    >
      {isEditing ? (
        <EditProblemForm
          problem={problem}
          onSave={onSave}
          onCancel={onEdit}
        />
      ) : (
        <>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-1 text-xs rounded font-medium ${
                  isHtml ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'
                }`}>
                  {problem.type.toUpperCase()}
                </span>
              </div>
              <p className="text-sm leading-relaxed">
                {problem.prompt.length > 150 && !isExpanded 
                  ? problem.prompt.slice(0, 150) + '...'
                  : problem.prompt
                }
              </p>
              {problem.prompt.length > 150 && (
                <button
                  onClick={onToggleExpand}
                  className="text-xs text-[var(--accent)] hover:opacity-80 mt-2"
                >
                  {isExpanded ? 'Show less' : 'Show more'}
                </button>
              )}
              {!isHtml && problem.expected_answer && (
                <div className="mt-3 p-2 bg-[var(--surface-2)] rounded text-xs">
                  <span className="text-textDim">Expected: </span>
                  <span>{problem.expected_answer}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 ml-4">
              {isHtml && (
                <button
                  onClick={onToggleExpand}
                  className="p-2 text-textDim hover:text-text rounded"
                  title="Toggle preview"
                >
                  <Eye size={16} />
                </button>
              )}
              <button
                onClick={onEdit}
                className="p-2 text-textDim hover:text-text rounded"
                title="Edit problem"
              >
                <Edit2 size={16} />
              </button>
              <button
                onClick={onDelete}
                className="p-2 text-[var(--danger)] hover:opacity-80 rounded"
                title="Delete problem"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
          
          {isExpanded && isHtml && (
            <div className="mt-4 border border-[var(--border)] rounded">
              <SandboxPreview 
                html={htmlAssets.html} 
                css={htmlAssets.css} 
                js={htmlAssets.js} 
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EditProblemForm({
  problem,
  onSave,
  onCancel
}: {
  problem: { id: string; type: string; prompt: string; expected_answer?: string | null; html_assets?: string | null };
  onSave: () => Promise<void>;
  onCancel: () => void;
}) {
  const isHtml = problem.type.toLowerCase() === 'html';
  let htmlAssets: { html?: string; css?: string; js?: string } = {};
  
  if (isHtml && problem.html_assets) {
    try {
      htmlAssets = JSON.parse(problem.html_assets);
    } catch {}
  }

  const { register, handleSubmit, watch } = useForm({
    defaultValues: {
      prompt: problem.prompt,
      expectedAnswer: problem.expected_answer || '',
      html: htmlAssets.html || '',
      css: htmlAssets.css || '',
      js: htmlAssets.js || ''
    }
  });

  const updateMut = useMutation({
    mutationFn: (data: any) => updateProblem(problem.id, isHtml ? {
      prompt: data.prompt,
      htmlAssets: { html: data.html, css: data.css, js: data.js }
    } : {
      prompt: data.prompt,
      expectedAnswer: data.expectedAnswer
    })
  });

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit(async (data) => {
        try {
          await updateMut.mutateAsync(data);
          await onSave();
        } catch (e) {
          alert(String(e));
        }
      })}
    >
      <div>
        <label className="block text-sm text-textDim mb-1">Prompt</label>
        <textarea
          {...register('prompt', { required: true })}
          rows={4}
          className="w-full px-3 py-2 bg-surface2 border border-[var(--border)] rounded-md focus-ring"
        />
      </div>

      {!isHtml && (
        <div>
          <label className="block text-sm text-textDim mb-1">Expected Answer</label>
          <input
            {...register('expectedAnswer')}
            className="w-full px-3 py-2 bg-surface2 border border-[var(--border)] rounded-md focus-ring"
          />
        </div>
      )}

      {isHtml && (
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-textDim mb-1">HTML</label>
            <textarea
              {...register('html')}
              rows={6}
              className="w-full px-3 py-2 bg-surface2 border border-[var(--border)] rounded-md focus-ring font-mono text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-textDim mb-1">CSS</label>
            <textarea
              {...register('css')}
              rows={6}
              className="w-full px-3 py-2 bg-surface2 border border-[var(--border)] rounded-md focus-ring font-mono text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-textDim mb-1">JavaScript</label>
            <textarea
              {...register('js')}
              rows={6}
              className="w-full px-3 py-2 bg-surface2 border border-[var(--border)] rounded-md focus-ring font-mono text-sm"
            />
          </div>
          <div className="md:col-span-3">
            <label className="block text-sm text-textDim mb-1">Preview</label>
            <SandboxPreview 
              html={watch('html')} 
              css={watch('css')} 
              js={watch('js')} 
            />
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={updateMut.isPending}
          className="px-4 py-2 bg-[var(--accent)] text-black rounded-md font-medium disabled:opacity-50"
        >
          {updateMut.isPending ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-textDim hover:text-text"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function NewProblemModal({
  isOpen,
  onClose,
  problemSets,
  defaultSetId,
  onCreated
}: {
  isOpen: boolean;
  onClose: () => void;
  problemSets: Array<{ id: string; name: string }>;
  defaultSetId: string;
  onCreated: () => void;
}) {
  const { register, handleSubmit, watch, reset } = useForm({
    defaultValues: {
      problemSetId: defaultSetId,
      type: 'text' as 'text' | 'html',
      prompt: '',
      expectedAnswer: '',
      html: '',
      css: '',
      js: ''
    }
  });

  const type = watch('type');
  const createMut = useMutation({
    mutationFn: (data: any) => createProblem({
      problemSetId: data.problemSetId,
      type: data.type,
      prompt: data.prompt,
      expectedAnswer: data.type === 'text' ? data.expectedAnswer : undefined,
      htmlAssets: data.type === 'html' ? { 
        html: data.html, 
        css: data.css, 
        js: data.js 
      } : undefined
    })
  });

  useEffect(() => {
    if (isOpen) {
      reset({
        problemSetId: defaultSetId,
        type: 'text',
        prompt: '',
        expectedAnswer: '',
        html: '',
        css: '',
        js: ''
      });
    }
  }, [isOpen, defaultSetId, reset]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-[var(--surface-1)] rounded-lg shadow-lg border border-[var(--border)] w-full max-w-4xl max-h-[90vh] overflow-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-medium">Create New Problem</h2>
            <button
              onClick={onClose}
              className="p-2 text-textDim hover:text-text rounded"
            >
              <X size={20} />
            </button>
          </div>

          <form
            className="space-y-4"
            onSubmit={handleSubmit(async (data) => {
              try {
                await createMut.mutateAsync(data);
                onCreated();
              } catch (e) {
                alert(String(e));
              }
            })}
          >
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-textDim mb-1">Target Problem Set</label>
                <select
                  {...register('problemSetId', { required: true })}
                  className="w-full px-3 py-2 bg-surface2 border border-[var(--border)] rounded-md focus-ring"
                >
                  {problemSets.map(set => (
                    <option key={set.id} value={set.id}>{set.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-textDim mb-1">Problem Type</label>
                <select
                  {...register('type')}
                  className="w-full px-3 py-2 bg-surface2 border border-[var(--border)] rounded-md focus-ring"
                >
                  <option value="text">Text Problem</option>
                  <option value="html">HTML Problem</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm text-textDim mb-1">Problem Prompt</label>
              <textarea
                {...register('prompt', { required: true })}
                rows={4}
                className="w-full px-3 py-2 bg-surface2 border border-[var(--border)] rounded-md focus-ring"
                placeholder="Describe what you want the AI to do..."
              />
            </div>

            {type === 'text' && (
              <div>
                <label className="block text-sm text-textDim mb-1">Expected Answer</label>
                <input
                  {...register('expectedAnswer')}
                  className="w-full px-3 py-2 bg-surface2 border border-[var(--border)] rounded-md focus-ring"
                  placeholder="What should the correct answer be?"
                />
              </div>
            )}

            {type === 'html' && (
              <div className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-textDim mb-1">HTML</label>
                    <textarea
                      {...register('html')}
                      rows={8}
                      className="w-full px-3 py-2 bg-surface2 border border-[var(--border)] rounded-md focus-ring font-mono text-sm"
                      placeholder="<div>Expected HTML structure...</div>"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-textDim mb-1">CSS</label>
                    <textarea
                      {...register('css')}
                      rows={8}
                      className="w-full px-3 py-2 bg-surface2 border border-[var(--border)] rounded-md focus-ring font-mono text-sm"
                      placeholder=".class { color: blue; }"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-textDim mb-1">JavaScript</label>
                    <textarea
                      {...register('js')}
                      rows={8}
                      className="w-full px-3 py-2 bg-surface2 border border-[var(--border)] rounded-md focus-ring font-mono text-sm"
                      placeholder="console.log('Expected behavior');"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-textDim mb-1">Live Preview</label>
                  <SandboxPreview 
                    html={watch('html')} 
                    css={watch('css')} 
                    js={watch('js')} 
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={createMut.isPending}
                className="px-4 py-2 bg-[var(--accent)] text-black rounded-md font-medium disabled:opacity-50"
              >
                {createMut.isPending ? 'Creating...' : 'Create Problem'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-textDim hover:text-text"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function ProblemSetsPage() {
  const qc = useQueryClient();
  const sets = useQuery({ queryKey: ['problemSets'], queryFn: listProblemSets });
  const [activeProblemSetId, setActiveProblemSetId] = useState<string | null>(null);
  const problems = useQuery({
    queryKey: ['problems', activeProblemSetId],
    enabled: !!activeProblemSetId,
    queryFn: () => listProblems(activeProblemSetId as string),
  });

  const [showNewProblemModal, setShowNewProblemModal] = useState(false);
  const [editingProblemId, setEditingProblemId] = useState<string | null>(null);
  const [dragOverSetId, setDragOverSetId] = useState<string | null>(null);

  // Dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    variant?: 'danger' | 'warning';
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  // Auto-select first set when available
  useEffect(() => {
    if (!activeProblemSetId && sets.data && sets.data.length > 0 && sets.data[0]) {
      setActiveProblemSetId(sets.data[0].id);
    }
  }, [activeProblemSetId, sets.data]);

  const activeSet = sets.data?.find((s) => s.id === activeProblemSetId);

  return (
    <div className="h-full flex gap-6">
      {/* Left Sidebar - Problem Sets */}
      <div className="w-80 flex flex-col gap-4">
        <ProblemSetsSidebar
          sets={sets.data || []}
          activeSetId={activeProblemSetId}
          dragOverSetId={dragOverSetId}
          onSelectSet={setActiveProblemSetId}
          onDragOver={setDragOverSetId}
          onDropProblem={async (problemId, targetSetId) => {
            try {
              await updateProblem(problemId, { problemSetId: targetSetId });
              await qc.invalidateQueries({ queryKey: ['problems', activeProblemSetId] });
              await qc.invalidateQueries({ queryKey: ['problems', targetSetId] });
              await qc.invalidateQueries({ queryKey: ['problemCounts'] });
            } catch (e) {
              alert(String(e));
            }
          }}
          onRefresh={() => qc.invalidateQueries({ queryKey: ['problemSets'] })}
          onRequestDelete={async (set) => {
            // Check runs using this problem set
            const runs = await listRuns({ problemSetId: set.id, limit: 200 });
            const runCount = runs.length;
            if (runCount > 0) {
              setConfirmDialog({
                isOpen: true,
                title: 'Cascade Delete',
                message: `Cannot delete "${set.name}" because it has been used in benchmark runs.\n\nTo proceed, you can delete all ${runCount} associated ${runCount === 1 ? 'run' : 'runs'} and then remove this problem set.`,
                confirmText: 'Delete runs, then problem set',
                variant: 'warning',
                onConfirm: async () => {
                  try {
                    await deleteRunsByProblemSet(set.id);
                    await deleteProblemSet(set.id);
                    await qc.invalidateQueries({ queryKey: ['problemSets'] });
                    await qc.invalidateQueries({ queryKey: ['problemCounts'] });
                    if (activeProblemSetId === set.id) setActiveProblemSetId(null);
                  } catch (e) {
                    alert(`Failed to cascade delete: ${String(e)}`);
                  } finally {
                    setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                  }
                },
              });
            } else {
              const problemCount = await listProblems(set.id).then((r) => r.length).catch(() => 0);
              const problemText = problemCount === 1 ? 'problem' : 'problems';
              setConfirmDialog({
                isOpen: true,
                title: 'Delete Problem Set',
                message: `Are you sure you want to delete "${set.name}"?\n\nThis will permanently delete:\n• The problem set\n• All ${problemCount} ${problemText} in this set\n\nThis action cannot be undone.`,
                confirmText: 'Delete',
                variant: 'danger',
                onConfirm: async () => {
                  try {
                    await deleteProblemSet(set.id);
                    await qc.invalidateQueries({ queryKey: ['problemSets'] });
                    await qc.invalidateQueries({ queryKey: ['problemCounts'] });
                    if (activeProblemSetId === set.id) setActiveProblemSetId(null);
                  } catch (e) {
                    alert(`Failed to delete problem set: ${String(e)}`);
                  } finally {
                    setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                  }
                },
              });
            }
          }}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Toolbar */}
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium">{activeSet ? activeSet.name : 'Select a Problem Set'}</h2>
              {activeSet?.description && <p className="text-sm text-textDim">{activeSet.description}</p>}
            </div>
            <button
              onClick={() => setShowNewProblemModal(true)}
              disabled={!activeProblemSetId}
              className="px-4 py-2 rounded-md bg-[var(--accent)] text-black font-medium shadow-[var(--elev-accent)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Plus size={16} />
              New Problem
            </button>
          </div>
        </div>

        {/* Problems Grid */}
        <div className="flex-1 card p-0 overflow-hidden">
          <ProblemsGrid
            problems={problems.data || []}
            loading={problems.isLoading}
            editingProblemId={editingProblemId}
            onEditProblem={setEditingProblemId}
            onDeleteProblem={async (problemId) => {
              // Use GUI modal instead of browser confirm; show confirm via dialog
              setConfirmDialog({
                isOpen: true,
                title: 'Delete Problem',
                message: 'Are you sure you want to delete this problem?\n\nThis action cannot be undone.',
                confirmText: 'Delete',
                variant: 'danger',
                onConfirm: async () => {
                  try {
                    await deleteProblem(problemId);
                    await qc.invalidateQueries({ queryKey: ['problems', activeProblemSetId] });
                    await qc.invalidateQueries({ queryKey: ['problemCounts'] });
                  } catch (e) {
                    alert(String(e));
                  } finally {
                    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                  }
                }
              });
            }}
            onSaveProblem={async () => {
              setEditingProblemId(null);
              await qc.invalidateQueries({ queryKey: ['problems', activeProblemSetId] });
            }}
          />
        </div>
      </div>

      {/* New Problem Modal */}
      <NewProblemModal
        isOpen={showNewProblemModal}
        onClose={() => setShowNewProblemModal(false)}
        problemSets={sets.data || []}
        defaultSetId={activeProblemSetId || ''}
        onCreated={async () => {
          setShowNewProblemModal(false);
          await qc.invalidateQueries({ queryKey: ['problems', activeProblemSetId] });
          await qc.invalidateQueries({ queryKey: ['problemCounts'] });
        }}
      />

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        variant={confirmDialog.variant}
      />
    </div>
  );
}


